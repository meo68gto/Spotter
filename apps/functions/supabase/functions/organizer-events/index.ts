// Organizer Events Edge Function
// Handles event CRUD operations with tier/permission checks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, TierSlug, TIER_PRIORITY } from '../_shared/tier-gate.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Permission levels for organizers
const PERMISSION_LEVELS = {
  owner: 3,
  admin: 2,
  editor: 1,
  viewer: 0
};

type OrganizerRole = keyof typeof PERMISSION_LEVELS;

interface CreateEventRequest {
  organizerId: string;
  name: string;
  description?: string;
  location: string;
  eventDate: string;
  registrationDeadline?: string;
  maxRegistrations?: number;
  targetTiers?: TierSlug[];
  price?: number;
  isPrivate?: boolean;
  requiresApproval?: boolean;
}

interface UpdateEventRequest {
  eventId: string;
  name?: string;
  description?: string;
  location?: string;
  eventDate?: string;
  registrationDeadline?: string;
  maxRegistrations?: number;
  targetTiers?: TierSlug[];
  price?: number;
  isPrivate?: boolean;
  requiresApproval?: boolean;
  status?: 'draft' | 'published' | 'cancelled' | 'completed';
}

interface EventResponse {
  id: string;
  organizerId: string;
  name: string;
  description: string | null;
  location: string;
  eventDate: string;
  registrationDeadline: string | null;
  maxRegistrations: number | null;
  currentRegistrations: number;
  targetTiers: TierSlug[];
  price: number;
  isPrivate: boolean;
  requiresApproval: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Monthly quotas by organizer tier
const MONTHLY_EVENT_QUOTAS: Record<TierSlug, number | null> = {
  [TIER_SLUGS.FREE]: 0,
  [TIER_SLUGS.SELECT]: 5,
  [TIER_SLUGS.SUMMIT]: null // unlimited
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const lastPath = pathParts[pathParts.length - 1] || '';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'missing_auth_header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const method = req.method;

    if (lastPath === 'create' && method === 'POST') {
      return await handleCreateEvent(req, supabase, user.id);
    } else if (lastPath === 'list' && method === 'GET') {
      return await handleListEvents(url, supabase, user.id);
    } else if (lastPath.startsWith('get/') && method === 'GET') {
      const eventId = lastPath.replace('get/', '');
      return await handleGetEvent(eventId, supabase, user.id);
    } else if (lastPath === 'update' && method === 'POST') {
      return await handleUpdateEvent(req, supabase, user.id);
    } else if (lastPath === 'publish' && method === 'POST') {
      return await handlePublishEvent(req, supabase, user.id);
    } else if (lastPath === 'cancel' && method === 'POST') {
      return await handleCancelEvent(req, supabase, user.id);
    }

    return new Response(
      JSON.stringify({ error: 'Not found', code: 'not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Organizer events error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkOrganizerPermission(
  supabase: any,
  userId: string,
  organizerId: string,
  minRole: OrganizerRole = 'viewer'
): Promise<{ allowed: boolean; role: OrganizerRole | null; organizer: any | null }> {
  const { data: membership, error } = await supabase
    .from('organizer_members')
    .select('role, organizer:organizer_id (id, tier, monthly_events_used, monthly_events_reset_at)')
    .eq('user_id', userId)
    .eq('organizer_id', organizerId)
    .eq('status', 'active')
    .single();

  if (error || !membership) {
    return { allowed: false, role: null, organizer: null };
  }

  const requiredLevel = PERMISSION_LEVELS[minRole];
  const userLevel = PERMISSION_LEVELS[membership.role as OrganizerRole] || 0;

  return {
    allowed: userLevel >= requiredLevel,
    role: membership.role as OrganizerRole,
    organizer: membership.organizer
  };
}

async function handleCreateEvent(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: CreateEventRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.organizerId || !body.name || !body.location || !body.eventDate) {
    return new Response(
      JSON.stringify({ error: 'organizerId, name, location, and eventDate are required', code: 'missing_fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed, organizer } = await checkOrganizerPermission(supabase, userId, body.organizerId, 'editor');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check monthly quota
  const organizerTier = (organizer?.tier as TierSlug) || TIER_SLUGS.FREE;
  const quota = MONTHLY_EVENT_QUOTAS[organizerTier];

  if (quota !== null) {
    // Check if we need to reset monthly quota
    const now = new Date();
    const resetAt = organizer?.monthly_events_reset_at ? new Date(organizer.monthly_events_reset_at) : null;

    if (!resetAt || resetAt < new Date(now.getFullYear(), now.getMonth(), 1)) {
      // Reset quota
      await supabase
        .from('organizers')
        .update({ monthly_events_used: 0, monthly_events_reset_at: now.toISOString() })
        .eq('id', body.organizerId);
    } else if ((organizer?.monthly_events_used || 0) >= quota) {
      return new Response(
        JSON.stringify({ error: 'Monthly event quota exceeded', code: 'quota_exceeded', quota }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Validate event date is in future
  const eventDate = new Date(body.eventDate);
  if (eventDate < new Date()) {
    return new Response(
      JSON.stringify({ error: 'eventDate must be in the future', code: 'invalid_date' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create event
  const { data: event, error: eventError } = await supabase
    .from('organizer_events')
    .insert({
      organizer_id: body.organizerId,
      name: body.name,
      description: body.description || null,
      location: body.location,
      event_date: body.eventDate,
      registration_deadline: body.registrationDeadline || null,
      max_registrations: body.maxRegistrations || null,
      target_tiers: body.targetTiers || [TIER_SLUGS.FREE, TIER_SLUGS.SELECT, TIER_SLUGS.SUMMIT],
      price: body.price || 0,
      is_private: body.isPrivate || false,
      requires_approval: body.requiresApproval || false,
      status: 'draft',
      created_by: userId
    })
    .select('id, organizer_id, name, description, location, event_date, registration_deadline, max_registrations, target_tiers, price, is_private, requires_approval, status, created_at, updated_at')
    .single();

  if (eventError || !event) {
    console.error('Error creating event:', eventError);
    return new Response(
      JSON.stringify({ error: 'Failed to create event', code: 'create_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update quota usage
  if (quota !== null) {
    await supabase
      .from('organizers')
      .update({ monthly_events_used: (organizer?.monthly_events_used || 0) + 1 })
      .eq('id', body.organizerId);
  }

  const response: EventResponse = {
    id: event.id,
    organizerId: event.organizer_id,
    name: event.name,
    description: event.description,
    location: event.location,
    eventDate: event.event_date,
    registrationDeadline: event.registration_deadline,
    maxRegistrations: event.max_registrations,
    currentRegistrations: 0,
    targetTiers: event.target_tiers,
    price: event.price,
    isPrivate: event.is_private,
    requiresApproval: event.requires_approval,
    status: event.status,
    createdAt: event.created_at,
    updatedAt: event.updated_at
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleListEvents(url: URL, supabase: any, userId: string): Promise<Response> {
  const organizerId = url.searchParams.get('organizerId');
  const status = url.searchParams.get('status');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  if (!organizerId) {
    return new Response(
      JSON.stringify({ error: 'organizerId is required', code: 'missing_organizer_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, organizerId, 'viewer');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let query = supabase
    .from('organizer_events')
    .select('id, organizer_id, name, description, location, event_date, registration_deadline, max_registrations, target_tiers, price, is_private, requires_approval, status, created_at, updated_at', { count: 'exact' })
    .eq('organizer_id', organizerId);

  if (status) {
    query = query.eq('status', status);
  }
  if (dateFrom) {
    query = query.gte('event_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('event_date', dateTo);
  }

  const { data: events, error, count } = await query
    .order('event_date', { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch events', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get registration counts
  const eventIds = events?.map((e: any) => e.id) || [];
  const { data: regCounts } = await supabase
    .from('organizer_registrations')
    .select('event_id, status')
    .in('event_id', eventIds)
    .eq('status', 'confirmed');

  const countsByEvent: Record<string, number> = {};
  regCounts?.forEach((r: any) => {
    countsByEvent[r.event_id] = (countsByEvent[r.event_id] || 0) + 1;
  });

  const response = events?.map((e: any) => ({
    id: e.id,
    organizerId: e.organizer_id,
    name: e.name,
    description: e.description,
    location: e.location,
    eventDate: e.event_date,
    registrationDeadline: e.registration_deadline,
    maxRegistrations: e.max_registrations,
    currentRegistrations: countsByEvent[e.id] || 0,
    targetTiers: e.target_tiers,
    price: e.price,
    isPrivate: e.is_private,
    requiresApproval: e.requires_approval,
    status: e.status,
    createdAt: e.created_at,
    updatedAt: e.updated_at
  }));

  return new Response(
    JSON.stringify({
      data: response,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGetEvent(eventId: string, supabase: any, userId: string): Promise<Response> {
  const { data: event, error } = await supabase
    .from('organizer_events')
    .select('id, organizer_id, name, description, location, event_date, registration_deadline, max_registrations, target_tiers, price, is_private, requires_approval, status, created_at, updated_at')
    .eq('id', eventId)
    .single();

  if (error || !event) {
    return new Response(
      JSON.stringify({ error: 'Event not found', code: 'event_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, event.organizer_id, 'viewer');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get registrations with user data
  const { data: registrations } = await supabase
    .from('organizer_registrations')
    .select(`
      id,
      user_id,
      status,
      payment_status,
      payment_amount,
      registered_at,
      checked_in_at,
      user:user_id (id, display_name, email, avatar_url)
    `)
    .eq('event_id', eventId);

  // Get basic analytics
  const confirmedCount = registrations?.filter((r: any) => r.status === 'confirmed').length || 0;
  const checkedInCount = registrations?.filter((r: any) => r.checked_in_at).length || 0;
  const totalRevenue = registrations?.reduce((sum: number, r: any) => sum + (r.payment_amount || 0), 0) || 0;

  const response = {
    event: {
      id: event.id,
      organizerId: event.organizer_id,
      name: event.name,
      description: event.description,
      location: event.location,
      eventDate: event.event_date,
      registrationDeadline: event.registration_deadline,
      maxRegistrations: event.max_registrations,
      currentRegistrations: confirmedCount,
      targetTiers: event.target_tiers,
      price: event.price,
      isPrivate: event.is_private,
      requiresApproval: event.requires_approval,
      status: event.status,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    },
    registrations: registrations || [],
    analytics: {
      totalRegistrations: registrations?.length || 0,
      confirmed: confirmedCount,
      checkedIn: checkedInCount,
      attendanceRate: confirmedCount > 0 ? Math.round((checkedInCount / confirmedCount) * 100) : 0,
      totalRevenue
    }
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateEvent(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: UpdateEventRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.eventId) {
    return new Response(
      JSON.stringify({ error: 'eventId is required', code: 'missing_event_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get event
  const { data: event, error: eventError } = await supabase
    .from('organizer_events')
    .select('id, organizer_id, status')
    .eq('id', body.eventId)
    .single();

  if (eventError || !event) {
    return new Response(
      JSON.stringify({ error: 'Event not found', code: 'event_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, event.organizer_id, 'editor');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build update
  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.location !== undefined) updateData.location = body.location;
  if (body.eventDate !== undefined) updateData.event_date = body.eventDate;
  if (body.registrationDeadline !== undefined) updateData.registration_deadline = body.registrationDeadline;
  if (body.maxRegistrations !== undefined) updateData.max_registrations = body.maxRegistrations;
  if (body.targetTiers !== undefined) updateData.target_tiers = body.targetTiers;
  if (body.price !== undefined) updateData.price = body.price;
  if (body.isPrivate !== undefined) updateData.is_private = body.isPrivate;
  if (body.requiresApproval !== undefined) updateData.requires_approval = body.requiresApproval;
  if (body.status !== undefined) updateData.status = body.status;
  updateData.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('organizer_events')
    .update(updateData)
    .eq('id', body.eventId)
    .select()
    .single();

  if (updateError || !updated) {
    return new Response(
      JSON.stringify({ error: 'Failed to update event', code: 'update_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handlePublishEvent(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: { eventId: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.eventId) {
    return new Response(
      JSON.stringify({ error: 'eventId is required', code: 'missing_event_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get event
  const { data: event, error: eventError } = await supabase
    .from('organizer_events')
    .select('id, organizer_id, name, event_date, location, status')
    .eq('id', body.eventId)
    .single();

  if (eventError || !event) {
    return new Response(
      JSON.stringify({ error: 'Event not found', code: 'event_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, event.organizer_id, 'editor');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate required fields
  if (!event.name || !event.event_date || !event.location) {
    return new Response(
      JSON.stringify({ error: 'Event is missing required fields', code: 'missing_required_fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update status to published
  const { data: updated, error: updateError } = await supabase
    .from('organizer_events')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', body.eventId)
    .select()
    .single();

  if (updateError || !updated) {
    return new Response(
      JSON.stringify({ error: 'Failed to publish event', code: 'publish_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCancelEvent(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: { eventId: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.eventId) {
    return new Response(
      JSON.stringify({ error: 'eventId is required', code: 'missing_event_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get event
  const { data: event, error: eventError } = await supabase
    .from('organizer_events')
    .select('id, organizer_id, status, price')
    .eq('id', body.eventId)
    .single();

  if (eventError || !event) {
    return new Response(
      JSON.stringify({ error: 'Event not found', code: 'event_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, event.organizer_id, 'admin');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update status to cancelled
  const { data: updated, error: updateError } = await supabase
    .from('organizer_events')
    .update({
      status: 'cancelled',
      cancellation_reason: body.reason || null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', body.eventId)
    .select()
    .single();

  if (updateError || !updated) {
    return new Response(
      JSON.stringify({ error: 'Failed to cancel event', code: 'cancel_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Notify registered members
  const { data: registrations } = await supabase
    .from('organizer_registrations')
    .select('user_id, status, payment_status, payment_amount')
    .eq('event_id', body.eventId)
    .eq('status', 'confirmed');

  // TODO: Send notifications to registered users
  // TODO: Handle refunds if needed (trigger refund process for paid events)

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
