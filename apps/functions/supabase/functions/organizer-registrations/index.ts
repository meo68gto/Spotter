// Organizer Registrations Edge Function
// Handles event registrations, cancellations, and check-ins

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, TierSlug } from '../_shared/tier-gate.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PERMISSION_LEVELS = {
  owner: 3,
  admin: 2,
  editor: 1,
  viewer: 0
};

type OrganizerRole = keyof typeof PERMISSION_LEVELS;

interface RegisterRequest {
  eventId: string;
  userId?: string; // For organizers registering on behalf of users
  paymentMethodId?: string;
}

interface CancelRequest {
  registrationId: string;
  reason?: string;
}

interface CheckInRequest {
  registrationId: string;
}

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

    if (lastPath === 'register' && method === 'POST') {
      return await handleRegister(req, supabase, user.id);
    } else if (lastPath === 'cancel' && method === 'POST') {
      return await handleCancel(req, supabase, user.id);
    } else if (lastPath === 'list' && method === 'GET') {
      return await handleListRegistrations(url, supabase, user.id);
    } else if (lastPath === 'check-in' && method === 'POST') {
      return await handleCheckIn(req, supabase, user.id);
    }

    return new Response(
      JSON.stringify({ error: 'Not found', code: 'not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Organizer registrations error:', error);
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
): Promise<{ allowed: boolean; role: OrganizerRole | null }> {
  const { data: membership, error } = await supabase
    .from('organizer_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organizer_id', organizerId)
    .eq('status', 'active')
    .single();

  if (error || !membership) {
    return { allowed: false, role: null };
  }

  const requiredLevel = PERMISSION_LEVELS[minRole];
  const userLevel = PERMISSION_LEVELS[membership.role as OrganizerRole] || 0;

  return {
    allowed: userLevel >= requiredLevel,
    role: membership.role as OrganizerRole
  };
}

async function handleRegister(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: RegisterRequest;
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

  // Get event details
  const { data: event, error: eventError } = await supabase
    .from('organizer_events')
    .select(`
      id, 
      organizer_id, 
      status, 
      event_date, 
      registration_deadline,
      target_tiers,
      max_registrations,
      price,
      requires_approval
    `)
    .eq('id', body.eventId)
    .single();

  if (eventError || !event) {
    return new Response(
      JSON.stringify({ error: 'Event not found', code: 'event_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if event is open
  if (event.status !== 'published') {
    return new Response(
      JSON.stringify({ error: 'Event is not open for registration', code: 'event_not_open' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check registration deadline
  if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
    return new Response(
      JSON.stringify({ error: 'Registration deadline has passed', code: 'registration_closed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Determine who is being registered
  const isOrganizerAction = body.userId && body.userId !== userId;
  let targetUserId = body.userId || userId;

  // If organizer is registering on behalf, check permission
  if (isOrganizerAction) {
    const { allowed } = await checkOrganizerPermission(supabase, userId, event.organizer_id, 'editor');
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Check if user exists and get their tier
  const { data: targetUser, error: userError } = await supabase
    .from('users')
    .select('id, tier_id, tier_status, membership_tiers (slug)')
    .eq('id', targetUserId)
    .single();

  if (userError || !targetUser) {
    return new Response(
      JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userTier = (targetUser.membership_tiers as { slug: TierSlug } | null)?.slug || TIER_SLUGS.FREE;

  // Check if user's tier is in target_tiers
  const targetTiers: TierSlug[] = event.target_tiers || [TIER_SLUGS.FREE, TIER_SLUGS.SELECT, TIER_SLUGS.SUMMIT];
  if (!targetTiers.includes(userTier)) {
    return new Response(
      JSON.stringify({ 
        error: 'Your tier is not eligible for this event', 
        code: 'tier_not_eligible',
        userTier,
        requiredTiers: targetTiers
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if already registered
  const { data: existingReg, error: existingError } = await supabase
    .from('organizer_registrations')
    .select('id, status')
    .eq('event_id', body.eventId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (existingReg && existingReg.status !== 'cancelled') {
    return new Response(
      JSON.stringify({ error: 'Already registered for this event', code: 'already_registered' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check capacity
  if (event.max_registrations) {
    const { count: currentCount, error: countError } = await supabase
      .from('organizer_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', body.eventId)
      .eq('status', 'confirmed');

    if (!countError && (currentCount || 0) >= event.max_registrations) {
      return new Response(
        JSON.stringify({ error: 'Event is full', code: 'event_full' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle payment if required
  let paymentStatus = 'not_required';
  let paymentIntentId: string | null = null;
  let clientSecret: string | null = null;

  if (event.price > 0) {
    if (!body.paymentMethodId && !isOrganizerAction) {
      return new Response(
        JSON.stringify({ error: 'Payment method required', code: 'payment_required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    paymentStatus = 'pending';
    // TODO: Create Stripe payment intent
    // const stripeRes = await createPaymentIntent(event.price, body.paymentMethodId);
    // paymentIntentId = stripeRes.id;
    // clientSecret = stripeRes.client_secret;
  }

  // Create or update registration
  const registrationStatus = event.requires_approval ? 'pending_approval' : 'confirmed';
  const registeredAt = new Date().toISOString();

  let registration;
  if (existingReg) {
    // Update cancelled registration
    const { data: updated, error: updateError } = await supabase
      .from('organizer_registrations')
      .update({
        status: registrationStatus,
        payment_status: paymentStatus,
        payment_intent_id: paymentIntentId,
        registered_at: registeredAt,
        updated_at: registeredAt
      })
      .eq('id', existingReg.id)
      .select()
      .single();

    if (updateError || !updated) {
      return new Response(
        JSON.stringify({ error: 'Failed to update registration', code: 'update_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    registration = updated;
  } else {
    // Create new registration
    const { data: created, error: createError } = await supabase
      .from('organizer_registrations')
      .insert({
        event_id: body.eventId,
        user_id: targetUserId,
        status: registrationStatus,
        payment_status: paymentStatus,
        payment_amount: event.price,
        payment_intent_id: paymentIntentId,
        registered_at: registeredAt
      })
      .select()
      .single();

    if (createError || !created) {
      return new Response(
        JSON.stringify({ error: 'Failed to create registration', code: 'create_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    registration = created;
  }

  return new Response(
    JSON.stringify({
      data: {
        registration,
        paymentClientSecret: clientSecret
      }
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCancel(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: CancelRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.registrationId) {
    return new Response(
      JSON.stringify({ error: 'registrationId is required', code: 'missing_registration_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get registration with event details
  const { data: registration, error: regError } = await supabase
    .from('organizer_registrations')
    .select(`
      id,
      user_id,
      status,
      payment_status,
      payment_amount,
      event:event_id (
        id,
        organizer_id,
        status,
        event_date,
        price
      )
    `)
    .eq('id', body.registrationId)
    .single();

  if (regError || !registration) {
    return new Response(
      JSON.stringify({ error: 'Registration not found', code: 'registration_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const event = registration.event as any;

  // Check permission - user can cancel their own, organizers can cancel anyone's
  const isOwnRegistration = registration.user_id === userId;
  if (!isOwnRegistration) {
    const { allowed } = await checkOrganizerPermission(supabase, userId, event.organizer_id, 'editor');
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Check if already cancelled
  if (registration.status === 'cancelled') {
    return new Response(
      JSON.stringify({ error: 'Registration already cancelled', code: 'already_cancelled' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update registration status
  const { data: updated, error: updateError } = await supabase
    .from('organizer_registrations')
    .update({
      status: 'cancelled',
      cancellation_reason: body.reason || null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', body.registrationId)
    .select()
    .single();

  if (updateError || !updated) {
    return new Response(
      JSON.stringify({ error: 'Failed to cancel registration', code: 'cancel_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Handle refund if payment was made
  if (registration.payment_status === 'completed' && registration.payment_amount > 0) {
    // TODO: Process refund via Stripe
    // await createRefund(registration.payment_intent_id);
    await supabase
      .from('organizer_registrations')
      .update({ payment_status: 'refunded' })
      .eq('id', body.registrationId);
  }

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleListRegistrations(url: URL, supabase: any, userId: string): Promise<Response> {
  const eventId = url.searchParams.get('eventId');
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

  if (!eventId) {
    return new Response(
      JSON.stringify({ error: 'eventId is required', code: 'missing_event_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get event
  const { data: event, error: eventError } = await supabase
    .from('organizer_events')
    .select('id, organizer_id')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
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

  let query = supabase
    .from('organizer_registrations')
    .select(`
      id,
      event_id,
      user_id,
      status,
      payment_status,
      payment_amount,
      registered_at,
      checked_in_at,
      cancelled_at,
      user:user_id (
        id,
        display_name,
        email,
        avatar_url,
        membership_tiers (slug)
      )
    `, { count: 'exact' })
    .eq('event_id', eventId);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: registrations, error, count } = await query
    .order('registered_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch registrations', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      data: registrations,
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

async function handleCheckIn(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: CheckInRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.registrationId) {
    return new Response(
      JSON.stringify({ error: 'registrationId is required', code: 'missing_registration_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get registration with event details
  const { data: registration, error: regError } = await supabase
    .from('organizer_registrations')
    .select(`
      id,
      user_id,
      status,
      checked_in_at,
      event:event_id (
        id,
        organizer_id,
        status,
        event_date
      )
    `)
    .eq('id', body.registrationId)
    .single();

  if (regError || !registration) {
    return new Response(
      JSON.stringify({ error: 'Registration not found', code: 'registration_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const event = registration.event as any;

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, event.organizer_id, 'editor');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if registration is confirmed
  if (registration.status !== 'confirmed') {
    return new Response(
      JSON.stringify({ error: 'Registration is not confirmed', code: 'not_confirmed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if already checked in
  if (registration.checked_in_at) {
    return new Response(
      JSON.stringify({ error: 'Already checked in', code: 'already_checked_in' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update check-in
  const { data: updated, error: updateError } = await supabase
    .from('organizer_registrations')
    .update({
      checked_in_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', body.registrationId)
    .select()
    .single();

  if (updateError || !updated) {
    return new Response(
      JSON.stringify({ error: 'Failed to check in', code: 'checkin_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
