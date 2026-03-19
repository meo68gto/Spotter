// Network Introduction Request Edge Function
// Request an introduction through a mutual connection
// Routes: POST /network/introductions/request

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';
import { verifyInteractionAllowed } from '../_shared/enforcement.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RequestIntroductionBody {
  connectorId: string;
  targetId: string;
  connectorMessage?: string;
}

interface IntroductionResponse {
  id: string;
  requesterId: string;
  targetId: string;
  connectorId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  connectorMessage: string | null;
  expiresAt: string;
  createdAt: string;
  connector: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  target: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'method_not_allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'missing_auth_header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Create client with user's JWT
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: RequestIntroductionBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return await requestIntroduction(supabase, user.id, body);

  } catch (error) {
    console.error('Network introduction request error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Request an introduction
 */
async function requestIntroduction(
  supabase: any,
  userId: string,
  body: RequestIntroductionBody
) {
  const { connectorId, targetId, connectorMessage } = body;

  // Validate required fields
  if (!connectorId) {
    return new Response(
      JSON.stringify({ error: 'connectorId is required', code: 'missing_connector_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!targetId) {
    return new Response(
      JSON.stringify({ error: 'targetId is required', code: 'missing_target_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prevent self-introduction
  if (targetId === userId) {
    return new Response(
      JSON.stringify({ error: 'Cannot request introduction to yourself', code: 'self_introduction' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (connectorId === userId) {
    return new Response(
      JSON.stringify({ error: 'Cannot request introduction from yourself', code: 'self_introducer' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get requester's tier info
  const { data: requester, error: requesterError } = await supabase
    .from('users')
    .select(`
      id,
      tier_id,
      tier_status,
      intro_credits_remaining,
      intro_credits_reset_at,
      membership_tiers (
        id,
        slug
      )
    `)
    .eq('id', userId)
    .single();

  if (requesterError || !requester) {
    return new Response(
      JSON.stringify({ error: 'Requester not found', code: 'requester_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const requesterTier = requester.membership_tiers as { slug: TierSlug } | null;
  const requesterTierSlug = requesterTier?.slug || TIER_SLUGS.FREE;
  const requesterFeatures = getTierFeatures(requesterTierSlug);

  // Check tier status
  if (requester.tier_status !== 'active') {
    return new Response(
      JSON.stringify({ error: 'Your membership is not active', code: 'tier_not_active' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // FREE tier cannot send intros
  if (!requesterFeatures.canSendIntros) {
    return new Response(
      JSON.stringify({ 
        error: 'Your tier does not allow sending introduction requests. Upgrade to Select or Summit.', 
        code: 'tier_insufficient',
        currentTier: requesterTierSlug,
        requiredTier: TIER_SLUGS.SELECT
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check intro credits (for non-unlimited tiers)
  if (requesterFeatures.introCreditsMonthly !== null) {
    // Check if credits need reset
    const now = new Date();
    const resetAt = requester.intro_credits_reset_at ? new Date(requester.intro_credits_reset_at) : null;
    
    if (resetAt && now >= resetAt) {
      // Reset credits
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      
      await supabase
        .from('users')
        .update({
          intro_credits_remaining: requesterFeatures.introCreditsMonthly,
          intro_credits_reset_at: nextMonth.toISOString()
        })
        .eq('id', userId);
      
      requester.intro_credits_remaining = requesterFeatures.introCreditsMonthly;
    }

    // Check if user has credits
    if ((requester.intro_credits_remaining || 0) <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'You have no introduction credits remaining', 
          code: 'no_intro_credits',
          creditsRemaining: 0,
          creditsTotal: requesterFeatures.introCreditsMonthly,
          resetsAt: requester.intro_credits_reset_at
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Verify connector exists and is connected to both parties
  const { data: connectorConnection1, error: connError1 } = await supabase
    .from('user_connections')
    .select('id')
    .or(`and(user_id.eq.${userId},connected_user_id.eq.${connectorId}),and(user_id.eq.${connectorId},connected_user_id.eq.${userId})`)
    .eq('status', 'accepted')
    .maybeSingle();

  if (!connectorConnection1) {
    return new Response(
      JSON.stringify({ error: 'You must be connected with the connector', code: 'not_connected_connector' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: connectorConnection2, error: connError2 } = await supabase
    .from('user_connections')
    .select('id')
    .or(`and(user_id.eq.${connectorId},connected_user_id.eq.${targetId}),and(user_id.eq.${targetId},connected_user_id.eq.${connectorId})`)
    .eq('status', 'accepted')
    .maybeSingle();

  if (!connectorConnection2) {
    return new Response(
      JSON.stringify({ error: 'Connector must be connected with the target user', code: 'connector_not_connected' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if already connected with target
  const { data: existingConnection } = await supabase
    .from('user_connections')
    .select('id, status')
    .or(`and(user_id.eq.${userId},connected_user_id.eq.${targetId}),and(user_id.eq.${targetId},connected_user_id.eq.${userId})`)
    .maybeSingle();

  if (existingConnection) {
    return new Response(
      JSON.stringify({ 
        error: 'Already connected or pending with this user', 
        code: 'already_connected',
        status: existingConnection.status
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if intro already exists
  const { data: existingIntro } = await supabase
    .from('introductions')
    .select('id, status')
    .eq('requester_id', userId)
    .eq('target_id', targetId)
    .in('status', ['pending', 'accepted'])
    .maybeSingle();

  if (existingIntro) {
    return new Response(
      JSON.stringify({ 
        error: 'Introduction request already exists', 
        code: 'intro_exists',
        status: existingIntro.status
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Same-tier enforcement: Verify interaction is allowed with target
  const targetInteractionCheck = await verifyInteractionAllowed(supabase, userId, targetId);
  if (!targetInteractionCheck.allowed) {
    return new Response(
      JSON.stringify({ error: targetInteractionCheck.error, code: targetInteractionCheck.code }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Same-tier enforcement: Verify interaction is allowed with connector
  const connectorInteractionCheck = await verifyInteractionAllowed(supabase, userId, connectorId);
  if (!connectorInteractionCheck.allowed) {
    return new Response(
      JSON.stringify({ error: connectorInteractionCheck.error, code: connectorInteractionCheck.code }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify target user allows intros
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, allow_intros, display_name, avatar_url')
    .eq('id', targetId)
    .single();

  if (targetUser?.allow_intros === false) {
    return new Response(
      JSON.stringify({ error: 'User does not accept introduction requests', code: 'intros_disabled' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get connector info
  const { data: connector } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .eq('id', connectorId)
    .single();

  // Create introduction request
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

  const { data: intro, error: introError } = await supabase
    .from('introductions')
    .insert({
      requester_id: userId,
      target_id: targetId,
      connector_id: connectorId,
      status: 'pending',
      connector_message: connectorMessage || null,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id, requester_id, target_id, connector_id, status, connector_message, expires_at, created_at')
    .single();

  if (introError || !intro) {
    return new Response(
      JSON.stringify({ error: 'Failed to create introduction request', code: 'create_failed', details: introError?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Send notification to connector
  await sendNotification(supabase, {
    userId: connectorId,
    type: 'introduction_request',
    title: 'New Introduction Request',
    body: 'Someone is asking you to make an introduction',
    data: {
      introId: intro.id,
      requesterId: userId,
      targetId
    }
  });

  const response: IntroductionResponse = {
    id: intro.id,
    requesterId: intro.requester_id,
    targetId: intro.target_id,
    connectorId: intro.connector_id,
    status: intro.status,
    connectorMessage: intro.connector_message,
    expiresAt: intro.expires_at,
    createdAt: intro.created_at,
    connector: {
      id: connector.id,
      displayName: connector.display_name,
      avatarUrl: connector.avatar_url
    },
    target: {
      id: targetUser.id,
      displayName: targetUser.display_name,
      avatarUrl: targetUser.avatar_url
    }
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Send notification
 */
async function sendNotification(supabase: any, params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}) {
  try {
    await supabase.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data || {},
      read: false,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}