// Network Introduction Respond Edge Function
// Connector or target responds to introduction request
// Routes: POST /network/introductions/respond

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RespondIntroductionBody {
  introId: string;
  action: 'accept' | 'decline';
  message?: string;
  declineReason?: string;
}

interface IntroductionResponse {
  id: string;
  requesterId: string;
  targetId: string;
  connectorId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  connectorMessage: string | null;
  targetMessage: string | null;
  declineReason: string | null;
  respondedAt: string;
  createdAt: string;
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
    let body: RespondIntroductionBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return await respondToIntroduction(supabase, user.id, body);

  } catch (error) {
    console.error('Network introduction respond error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Respond to an introduction request
 */
async function respondToIntroduction(
  supabase: any,
  userId: string,
  body: RespondIntroductionBody
) {
  const { introId, action, message, declineReason } = body;

  // Validate required fields
  if (!introId) {
    return new Response(
      JSON.stringify({ error: 'introId is required', code: 'missing_intro_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!action || !['accept', 'decline'].includes(action)) {
    return new Response(
      JSON.stringify({ error: 'action must be "accept" or "decline"', code: 'invalid_action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the introduction request
  const { data: intro, error: introError } = await supabase
    .from('introductions')
    .select(`
      id, 
      requester_id, 
      target_id, 
      connector_id, 
      status, 
      expires_at
    `)
    .eq('id', introId)
    .eq('status', 'pending')
    .single();

  if (introError || !intro) {
    return new Response(
      JSON.stringify({ error: 'Introduction request not found', code: 'intro_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is the connector
  const isConnector = intro.connector_id === userId;
  
  if (!isConnector) {
    return new Response(
      JSON.stringify({ error: 'Only the connector can respond to introduction requests', code: 'not_connector' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if expired
  if (new Date(intro.expires_at) < new Date()) {
    await supabase
      .from('introductions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', introId);
    
    return new Response(
      JSON.stringify({ error: 'Introduction request has expired', code: 'intro_expired' }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined';

  // Update introduction
  const updates: any = {
    status: newStatus,
    responded_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isConnector) {
    updates.connector_message = message || null;
  }

  if (action === 'decline') {
    updates.decline_reason = declineReason || null;
  }

  const { data: updatedIntro, error: updateError } = await supabase
    .from('introductions')
    .update(updates)
    .eq('id', introId)
    .select('id, requester_id, target_id, connector_id, status, connector_message, target_message, decline_reason, responded_at, created_at')
    .single();

  if (updateError || !updatedIntro) {
    return new Response(
      JSON.stringify({ error: 'Failed to update introduction', code: 'update_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (action === 'accept') {
    // Create connection between requester and target
    await supabase
      .from('user_connections')
      .insert({
        user_id: intro.requester_id,
        connected_user_id: intro.target_id,
        status: 'accepted',
        intro_source: 'introduction',
        relationship_state: 'matched',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    // Consume intro credits from requester
    await consumeIntroCredit(supabase, intro.requester_id);

    // Increment connector's referral count
    await incrementReferralCount(supabase, intro.connector_id);

    // Send notification to requester
    await sendNotification(supabase, {
      userId: intro.requester_id,
      type: 'introduction_accepted',
      title: 'Introduction Accepted',
      body: `${message || 'Your introduction request was accepted'}`,
      data: {
        introId: intro.id,
        connectorId,
        targetId: intro.target_id
      }
    });

    // Send notification to target
    await sendNotification(supabase, {
      userId: intro.target_id,
      type: 'new_connection',
      title: 'New Connection',
      body: 'You have been introduced to a new connection',
      data: {
        connectionId: intro.requester_id,
        introId: intro.id,
        connectorId: intro.connector_id
      }
    });

    // Recalculate reputation for all parties
    await calculateReputation(supabase, intro.requester_id);
    await calculateReputation(supabase, intro.target_id);
    await calculateReputation(supabase, intro.connector_id);

  } else {
    // Send notification to requester about decline
    await sendNotification(supabase, {
      userId: intro.requester_id,
      type: 'introduction_declined',
      title: 'Introduction Declined',
      body: 'Your introduction request was declined',
      data: {
        introId: intro.id,
        connectorId,
        reason: declineReason
      }
    });
  }

  const response: IntroductionResponse = {
    id: updatedIntro.id,
    requesterId: updatedIntro.requester_id,
    targetId: updatedIntro.target_id,
    connectorId: updatedIntro.connector_id,
    status: updatedIntro.status,
    connectorMessage: updatedIntro.connector_message,
    targetMessage: updatedIntro.target_message,
    declineReason: updatedIntro.decline_reason,
    respondedAt: updatedIntro.responded_at,
    createdAt: updatedIntro.created_at
  };

  return new Response(
    JSON.stringify({ data: response }),
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
 * Increment referral count for connector
 */
async function incrementReferralCount(supabase: any, userId: string) {
  try {
    // Try RPC first
    await supabase.rpc('increment_referral_count', { p_user_id: userId });
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
      .or(`user_id.eq.${userId},connected_user_id.eq.${userId}`)
      .eq('status', 'accepted');

    // Get referrals count
    const { count: referralsCount } = await supabase
      .from('introductions')
      .select('*', { count: 'exact', head: true })
      .eq('connector_id', userId)
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