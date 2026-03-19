// Connections Intro Edge Function
// Request and respond to introductions via mutual connections
// Routes: POST /connections/intro, POST /connections/intro/respond

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';
import { verifyInteractionAllowed } from '../_shared/enforcement.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RequestIntroBody {
  action: 'request';
  introducerId: string;
  targetUserId: string;
  message?: string;
}

interface RespondIntroBody {
  action: 'respond';
  introId: string;
  response: 'accept' | 'decline';
  reason?: string;
}

type RequestBody = RequestIntroBody | RespondIntroBody;

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
    // Create client with user's JWT for auth check
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
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route to appropriate handler
    if (body.action === 'request') {
      return await requestIntroduction(supabase, user.id, body);
    } else if (body.action === 'respond') {
      return await respondToIntroduction(supabase, user.id, body);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "request" or "respond"', code: 'invalid_action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Connections intro error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Request an introduction
 */
async function requestIntroduction(supabase: any, userId: string, body: RequestIntroBody) {
  const { introducerId, targetUserId, message } = body;

  if (!introducerId) {
    return new Response(
      JSON.stringify({ error: 'introducerId is required', code: 'missing_introducer_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!targetUserId) {
    return new Response(
      JSON.stringify({ error: 'targetUserId is required', code: 'missing_target_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prevent self-introduction
  if (targetUserId === userId) {
    return new Response(
      JSON.stringify({ error: 'Cannot request introduction to yourself', code: 'self_introduction' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (introducerId === userId) {
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

  // Verify introducer exists and is connected to both parties
  const { data: introducerConnection1, error: introError1 } = await supabase
    .from('user_connections')
    .select('id')
    .or(`and(user_id.eq.${userId},connected_user_id.eq.${introducerId}),and(user_id.eq.${introducerId},connected_user_id.eq.${userId})`)
    .eq('status', 'accepted')
    .maybeSingle();

  if (!introducerConnection1) {
    return new Response(
      JSON.stringify({ error: 'You must be connected with the introducer', code: 'not_connected_introducer' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: introducerConnection2, error: introError2 } = await supabase
    .from('user_connections')
    .select('id')
    .or(`and(user_id.eq.${introducerId},connected_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},connected_user_id.eq.${introducerId})`)
    .eq('status', 'accepted')
    .maybeSingle();

  if (!introducerConnection2) {
    return new Response(
      JSON.stringify({ error: 'Introducer must be connected with the target user', code: 'introducer_not_connected' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if already connected with target
  const { data: existingConnection } = await supabase
    .from('user_connections')
    .select('id, status')
    .or(`and(user_id.eq.${userId},connected_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},connected_user_id.eq.${userId})`)
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
    .from('introduction_requests')
    .select('id, status')
    .eq('requester_id', userId)
    .eq('target_user_id', targetUserId)
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

  // Verify target user allows intros
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, allow_intros')
    .eq('id', targetUserId)
    .single();

  if (targetUser?.allow_intros === false) {
    return new Response(
      JSON.stringify({ error: 'User does not accept introduction requests', code: 'intros_disabled' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Same-tier enforcement: Verify requester and target are in same tier
  const interactionCheck = await verifyInteractionAllowed(supabase, userId, targetUserId);
  if (!interactionCheck.allowed) {
    return new Response(
      JSON.stringify({ error: interactionCheck.error, code: interactionCheck.code }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create introduction request
  const { data: intro, error: introError } = await supabase
    .from('introduction_requests')
    .insert({
      requester_id: userId,
      introducer_id: introducerId,
      target_user_id: targetUserId,
      message: message || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id, requester_id, introducer_id, target_user_id, message, status, created_at')
    .single();

  if (introError || !intro) {
    return new Response(
      JSON.stringify({ error: 'Failed to create introduction request', code: 'create_failed', details: introError?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Send notification to introducer
  await sendNotification(supabase, {
    userId: introducerId,
    type: 'introduction_request',
    title: 'New Introduction Request',
    body: 'Someone is asking you to make an introduction',
    data: {
      introId: intro.id,
      requesterId: userId,
      targetUserId
    }
  });

  return new Response(
    JSON.stringify({ 
      data: {
        id: intro.id,
        requesterId: intro.requester_id,
        introducerId: intro.introducer_id,
        targetUserId: intro.target_user_id,
        message: intro.message,
        status: intro.status,
        createdAt: intro.created_at
      }
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Respond to an introduction request
 */
async function respondToIntroduction(supabase: any, userId: string, body: RespondIntroBody) {
  const { introId, response, reason } = body;

  if (!introId) {
    return new Response(
      JSON.stringify({ error: 'introId is required', code: 'missing_intro_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!response || !['accept', 'decline'].includes(response)) {
    return new Response(
      JSON.stringify({ error: 'response must be "accept" or "decline"', code: 'invalid_response' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the introduction request
  const { data: intro, error: introError } = await supabase
    .from('introduction_requests')
    .select('id, requester_id, introducer_id, target_user_id, status')
    .eq('id', introId)
    .eq('introducer_id', userId) // User must be the introducer
    .eq('status', 'pending')
    .single();

  if (introError || !intro) {
    return new Response(
      JSON.stringify({ error: 'Introduction request not found', code: 'intro_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const newStatus = response === 'accept' ? 'accepted' : 'declined';

  // Update introduction status
  const { data: updatedIntro, error: updateError } = await supabase
    .from('introduction_requests')
    .update({
      status: newStatus,
      decline_reason: response === 'decline' ? reason || null : null,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', introId)
    .select('id, requester_id, introducer_id, target_user_id, status, responded_at')
    .single();

  if (updateError || !updatedIntro) {
    return new Response(
      JSON.stringify({ error: 'Failed to update introduction', code: 'update_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (response === 'accept') {
    // Create connection between requester and target
    await supabase
      .from('user_connections')
      .insert({
        user_id: intro.requester_id,
        connected_user_id: intro.target_user_id,
        status: 'accepted',
        intro_source: 'introduction',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    // Consume intro credits from requester
    await consumeIntroCredit(supabase, intro.requester_id);

    // Increment introducer's referral count
    await incrementReferralCount(supabase, userId);

    // Send notification to requester
    await sendNotification(supabase, {
      userId: intro.requester_id,
      type: 'introduction_accepted',
      title: 'Introduction Accepted',
      body: 'Your introduction request was accepted',
      data: {
        introId: intro.id,
        introducerId: userId,
        targetUserId: intro.target_user_id
      }
    });

    // Send notification to target
    await sendNotification(supabase, {
      userId: intro.target_user_id,
      type: 'new_connection',
      title: 'New Connection',
      body: 'You have been introduced to a new connection',
      data: {
        connectionId: intro.requester_id,
        introId: intro.id,
        introducerId: userId
      }
    });

    // Recalculate reputation for all parties
    await calculateReputation(supabase, intro.requester_id);
    await calculateReputation(supabase, intro.target_user_id);
    await calculateReputation(supabase, userId);

  } else {
    // Send notification to requester about decline
    await sendNotification(supabase, {
      userId: intro.requester_id,
      type: 'introduction_declined',
      title: 'Introduction Declined',
      body: 'Your introduction request was declined',
      data: {
        introId: intro.id,
        introducerId: userId,
        reason
      }
    });
  }

  return new Response(
    JSON.stringify({ 
      data: {
        id: updatedIntro.id,
        requesterId: updatedIntro.requester_id,
        introducerId: updatedIntro.introducer_id,
        targetUserId: updatedIntro.target_user_id,
        status: updatedIntro.status,
        respondedAt: updatedIntro.responded_at
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Consume intro credit from requester
 */
async function consumeIntroCredit(supabase: any, userId: string) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('intro_credits_remaining, membership_tiers(slug, features)')
      .eq('id', userId)
      .single();

    const tier = user?.membership_tiers as { slug: TierSlug; features: any } | null;
    const features = tier?.features || getTierFeatures(TIER_SLUGS.FREE);

    // Only decrement if not unlimited
    if (features?.introCreditsMonthly !== null && user?.intro_credits_remaining !== null) {
      await supabase
        .from('users')
        .update({ intro_credits_remaining: Math.max(0, user.intro_credits_remaining - 1) })
        .eq('id', userId);
    }
  } catch (error) {
    console.error('Error consuming intro credit:', error);
  }
}

/**
 * Increment referral count for introducer
 */
async function incrementReferralCount(supabase: any, userId: string) {
  try {
    await supabase.rpc('increment_referral_count', { user_id: userId });
  } catch (error) {
    // Fallback: direct update
    try {
      const { data: rep } = await supabase
        .from('user_reputation')
        .select('referrals_count')
        .eq('user_id', userId)
        .maybeSingle();
      
      await supabase
        .from('user_reputation')
        .upsert({
          user_id: userId,
          referrals_count: (rep?.referrals_count || 0) + 1,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (innerError) {
      console.error('Error incrementing referral count:', innerError);
    }
  }
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

/**
 * Calculate reputation for user
 */
async function calculateReputation(supabase: any, userId: string) {
  try {
    // Get user's connections count
    const { count: networkSize } = await supabase
      .from('user_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'accepted');

    // Get referrals count
    const { count: referralsCount } = await supabase
      .from('introduction_requests')
      .select('*', { count: 'exact', head: true })
      .eq('introducer_id', userId)
      .eq('status', 'accepted');

    // Update reputation
    await supabase
      .from('user_reputation')
      .upsert({
        user_id: userId,
        network_size: networkSize || 0,
        referrals_count: referralsCount || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

  } catch (error) {
    console.error('Error calculating reputation:', error);
  }
}
