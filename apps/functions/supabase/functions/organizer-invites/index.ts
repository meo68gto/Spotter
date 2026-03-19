// Organizer Invites Edge Function
// Handles invite sending, responses, and management

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

// Monthly invite quotas by organizer tier
const MONTHLY_INVITE_QUOTAS: Record<TierSlug, number | null> = {
  [TIER_SLUGS.FREE]: 0,
  [TIER_SLUGS.SELECT]: 100,
  [TIER_SLUGS.SUMMIT]: null // unlimited
};

interface SendInviteRequest {
  organizerId: string;
  eventId?: string;
  userId?: string;
  email?: string;
  message?: string;
}

interface RespondInviteRequest {
  inviteId: string;
  response: 'accept' | 'decline';
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

    if (lastPath === 'send' && method === 'POST') {
      return await handleSendInvite(req, supabase, user.id);
    } else if (lastPath === 'respond' && method === 'POST') {
      return await handleRespondInvite(req, supabase, user.id);
    } else if (lastPath === 'list' && method === 'GET') {
      return await handleListInvites(url, supabase, user.id);
    }

    return new Response(
      JSON.stringify({ error: 'Not found', code: 'not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Organizer invites error:', error);
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
    .select('role, organizer:organizer_id (id, tier, monthly_invites_used, monthly_invites_reset_at)')
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

async function handleSendInvite(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: SendInviteRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.organizerId) {
    return new Response(
      JSON.stringify({ error: 'organizerId is required', code: 'missing_organizer_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.userId && !body.email) {
    return new Response(
      JSON.stringify({ error: 'userId or email is required', code: 'missing_recipient' }),
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

  // Check monthly invite quota
  const organizerTier = (organizer?.tier as TierSlug) || TIER_SLUGS.FREE;
  const quota = MONTHLY_INVITE_QUOTAS[organizerTier];

  if (quota !== null) {
    const now = new Date();
    const resetAt = organizer?.monthly_invites_reset_at ? new Date(organizer.monthly_invites_reset_at) : null;

    if (!resetAt || resetAt < new Date(now.getFullYear(), now.getMonth(), 1)) {
      // Reset quota
      await supabase
        .from('organizers')
        .update({ monthly_invites_used: 0, monthly_invites_reset_at: now.toISOString() })
        .eq('id', body.organizerId);
    } else if ((organizer?.monthly_invites_used || 0) >= quota) {
      return new Response(
        JSON.stringify({ error: 'Monthly invite quota exceeded', code: 'quota_exceeded', quota }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Validate event if provided
  if (body.eventId) {
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

    if (event.organizer_id !== body.organizerId) {
      return new Response(
        JSON.stringify({ error: 'Event does not belong to this organizer', code: 'event_mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Resolve recipient
  let recipientUserId = body.userId;
  let recipientEmail = body.email;

  if (body.userId) {
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', body.userId)
      .single();
    
    if (targetUser) {
      recipientEmail = targetUser.email;
    }
  } else if (body.email) {
    // Try to find user by email
    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', body.email)
      .single();
    
    if (targetUser) {
      recipientUserId = targetUser.id;
    }
  }

  // Check if already invited
  if (recipientUserId && body.eventId) {
    const { data: existingInvite } = await supabase
      .from('organizer_invites')
      .select('id, status')
      .eq('event_id', body.eventId)
      .eq('user_id', recipientUserId)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: 'Already invited to this event', code: 'already_invited' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Create invite
  const { data: invite, error: inviteError } = await supabase
    .from('organizer_invites')
    .insert({
      organizer_id: body.organizerId,
      event_id: body.eventId || null,
      user_id: recipientUserId || null,
      email: recipientEmail,
      message: body.message || null,
      status: 'pending',
      invited_by: userId
    })
    .select()
    .single();

  if (inviteError || !invite) {
    console.error('Error creating invite:', inviteError);
    return new Response(
      JSON.stringify({ error: 'Failed to create invite', code: 'create_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update quota usage
  if (quota !== null) {
    await supabase
      .from('organizers')
      .update({ monthly_invites_used: (organizer?.monthly_invites_used || 0) + 1 })
      .eq('id', body.organizerId);
  }

  // Send notification/email
  // TODO: Send email notification
  // await sendInviteEmail(invite);

  return new Response(
    JSON.stringify({ data: invite }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRespondInvite(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: RespondInviteRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.inviteId) {
    return new Response(
      JSON.stringify({ error: 'inviteId is required', code: 'missing_invite_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get invite
  const { data: invite, error: inviteError } = await supabase
    .from('organizer_invites')
    .select('*, event:event_id (*), organizer:organizer_id (*)')
    .eq('id', body.inviteId)
    .single();

  if (inviteError || !invite) {
    return new Response(
      JSON.stringify({ error: 'Invite not found', code: 'invite_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is the recipient
  const isRecipient = invite.user_id === userId || invite.email === (await supabase.auth.getUser()).data.user?.email;
  if (!isRecipient) {
    return new Response(
      JSON.stringify({ error: 'Not authorized to respond to this invite', code: 'not_recipient' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if already responded
  if (invite.status !== 'pending') {
    return new Response(
      JSON.stringify({ error: `Invite already ${invite.status}`, code: 'already_responded' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update invite status
  const newStatus = body.response === 'accept' ? 'accepted' : 'declined';
  const { data: updated, error: updateError } = await supabase
    .from('organizer_invites')
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', body.inviteId)
    .select()
    .single();

  if (updateError || !updated) {
    return new Response(
      JSON.stringify({ error: 'Failed to update invite', code: 'update_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // If accepted and has event, create registration
  if (body.response === 'accept' && invite.event_id) {
    const event = invite.event as any;
    
    // Check if already registered
    const { data: existingReg } = await supabase
      .from('organizer_registrations')
      .select('id')
      .eq('event_id', invite.event_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingReg) {
      await supabase
        .from('organizer_registrations')
        .insert({
          event_id: invite.event_id,
          user_id: userId,
          status: event.requires_approval ? 'pending_approval' : 'confirmed',
          payment_status: event.price > 0 ? 'pending' : 'not_required',
          payment_amount: event.price || 0,
          registered_at: new Date().toISOString()
        });
    }
  }

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleListInvites(url: URL, supabase: any, userId: string): Promise<Response> {
  const organizerId = url.searchParams.get('organizerId');
  const eventId = url.searchParams.get('eventId');
  const status = url.searchParams.get('status');
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
    .from('organizer_invites')
    .select(`
      *,
      event:event_id (name, event_date),
      user:user_id (display_name, email, avatar_url),
      invitedByUser:invited_by (display_name)
    `, { count: 'exact' })
    .eq('organizer_id', organizerId);

  if (eventId) {
    query = query.eq('event_id', eventId);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data: invites, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch invites', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      data: invites,
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
