// Connections Request Edge Function
// Send connection requests and respond to them
// Routes: POST /connections/request, POST /connections/respond

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendRequestBody {
  action: 'request';
  recipientId: string;
  message?: string;
}

interface RespondRequestBody {
  action: 'respond';
  connectionId: string;
  response: 'accept' | 'decline';
}

type RequestBody = SendRequestBody | RespondRequestBody;

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
      return await sendConnectionRequest(supabase, user.id, body);
    } else if (body.action === 'respond') {
      return await respondToRequest(supabase, user.id, body);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "request" or "respond"', code: 'invalid_action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Connections request error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Send a connection request
 */
async function sendConnectionRequest(supabase: any, userId: string, body: SendRequestBody) {
  const { recipientId, message } = body;

  if (!recipientId) {
    return new Response(
      JSON.stringify({ error: 'recipientId is required', code: 'missing_recipient_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prevent self-connection
  if (recipientId === userId) {
    return new Response(
      JSON.stringify({ error: 'Cannot connect with yourself', code: 'self_connection' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get sender's tier info
  const { data: sender, error: senderError } = await supabase
    .from('users')
    .select(`
      id,
      tier_id,
      tier_status,
      membership_tiers (
        id,
        slug
      )
    `)
    .eq('id', userId)
    .single();

  if (senderError || !sender) {
    return new Response(
      JSON.stringify({ error: 'Sender not found', code: 'sender_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const senderTier = sender.membership_tiers as { slug: TierSlug } | null;
  const senderTierSlug = senderTier?.slug || TIER_SLUGS.FREE;
  const senderFeatures = getTierFeatures(senderTierSlug);

  // Check tier status
  if (sender.tier_status !== 'active') {
    return new Response(
      JSON.stringify({ error: 'Your membership is not active', code: 'tier_not_active' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // FREE tier cannot send connection requests
  if (!senderFeatures.canSendIntros && senderTierSlug === TIER_SLUGS.FREE) {
    return new Response(
      JSON.stringify({ 
        error: 'Your tier does not allow sending connection requests. Upgrade to Select or Summit.', 
        code: 'tier_insufficient',
        currentTier: senderTierSlug,
        requiredTier: TIER_SLUGS.SELECT
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check max connections limit
  if (senderFeatures.maxConnections !== null) {
    const { count: currentConnections } = await supabase
      .from('user_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if ((currentConnections || 0) >= senderFeatures.maxConnections) {
      return new Response(
        JSON.stringify({ 
          error: `You have reached your maximum of ${senderFeatures.maxConnections} connections`, 
          code: 'connection_limit_reached',
          limit: senderFeatures.maxConnections,
          current: currentConnections
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Get recipient's tier info
  const { data: recipient, error: recipientError } = await supabase
    .from('users')
    .select(`
      id,
      tier_id,
      tier_status,
      allow_connections,
      membership_tiers (
        id,
        slug
      )
    `)
    .eq('id', recipientId)
    .single();

  if (recipientError || !recipient) {
    return new Response(
      JSON.stringify({ error: 'Recipient not found', code: 'recipient_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if recipient allows connections
  if (recipient.allow_connections === false) {
    return new Response(
      JSON.stringify({ error: 'User does not accept connection requests', code: 'connections_disabled' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const recipientTier = recipient.membership_tiers as { slug: TierSlug } | null;
  const recipientTierSlug = recipientTier?.slug || TIER_SLUGS.FREE;

  // Check same-tier visibility (same tier only)
  if (senderTierSlug !== recipientTierSlug) {
    return new Response(
      JSON.stringify({ 
        error: 'You can only connect with users in the same tier', 
        code: 'tier_mismatch',
        senderTier: senderTierSlug,
        recipientTier: recipientTierSlug
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if connection already exists
  const { data: existingConnection } = await supabase
    .from('user_connections')
    .select('id, status')
    .or(`and(user_id.eq.${userId},connected_user_id.eq.${recipientId}),and(user_id.eq.${recipientId},connected_user_id.eq.${userId})`)
    .maybeSingle();

  if (existingConnection) {
    return new Response(
      JSON.stringify({ 
        error: 'Connection already exists', 
        code: 'connection_exists',
        status: existingConnection.status
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create connection request
  const { data: connection, error: connectionError } = await supabase
    .from('user_connections')
    .insert({
      user_id: userId,
      connected_user_id: recipientId,
      status: 'pending',
      message: message || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id, user_id, connected_user_id, status, message, created_at')
    .single();

  if (connectionError || !connection) {
    return new Response(
      JSON.stringify({ error: 'Failed to create connection request', code: 'create_failed', details: connectionError?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Send notification to recipient
  await sendNotification(supabase, {
    userId: recipientId,
    type: 'connection_request',
    title: 'New Connection Request',
    body: `Someone wants to connect with you`,
    data: {
      connectionId: connection.id,
      senderId: userId
    }
  });

  return new Response(
    JSON.stringify({ 
      data: {
        id: connection.id,
        userId: connection.user_id,
        connectedUserId: connection.connected_user_id,
        status: connection.status,
        message: connection.message,
        createdAt: connection.created_at
      }
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Respond to a connection request
 */
async function respondToRequest(supabase: any, userId: string, body: RespondRequestBody) {
  const { connectionId, response } = body;

  if (!connectionId) {
    return new Response(
      JSON.stringify({ error: 'connectionId is required', code: 'missing_connection_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!response || !['accept', 'decline'].includes(response)) {
    return new Response(
      JSON.stringify({ error: 'response must be "accept" or "decline"', code: 'invalid_response' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the connection request
  const { data: connection, error: connectionError } = await supabase
    .from('user_connections')
    .select('id, user_id, connected_user_id, status')
    .eq('id', connectionId)
    .eq('connected_user_id', userId) // User must be the recipient
    .eq('status', 'pending')
    .single();

  if (connectionError || !connection) {
    return new Response(
      JSON.stringify({ error: 'Connection request not found', code: 'request_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const newStatus = response === 'accept' ? 'accepted' : 'declined';

  // Update connection status
  const { data: updatedConnection, error: updateError } = await supabase
    .from('user_connections')
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', connectionId)
    .select('id, user_id, connected_user_id, status, created_at, responded_at')
    .single();

  if (updateError || !updatedConnection) {
    return new Response(
      JSON.stringify({ error: 'Failed to update connection', code: 'update_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate reputation on accept
  if (response === 'accept') {
    // Calculate reputation for both users
    await calculateReputation(supabase, connection.user_id);
    await calculateReputation(supabase, connection.connected_user_id);

    // Send notification to requester
    await sendNotification(supabase, {
      userId: connection.user_id,
      type: 'connection_accepted',
      title: 'Connection Accepted',
      body: 'Your connection request was accepted',
      data: {
        connectionId: connection.id,
        recipientId: userId
      }
    });
  } else {
    // Send notification to requester about decline
    await sendNotification(supabase, {
      userId: connection.user_id,
      type: 'connection_declined',
      title: 'Connection Declined',
      body: 'Your connection request was declined',
      data: {
        connectionId: connection.id,
        recipientId: userId
      }
    });
  }

  return new Response(
    JSON.stringify({ 
      data: {
        id: updatedConnection.id,
        userId: updatedConnection.user_id,
        connectedUserId: updatedConnection.connected_user_id,
        status: updatedConnection.status,
        createdAt: updatedConnection.created_at,
        respondedAt: updatedConnection.responded_at
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Update reputation network_size
    await supabase
      .from('user_reputation')
      .upsert({
        user_id: userId,
        network_size: networkSize || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

  } catch (error) {
    console.error('Error calculating reputation:', error);
  }
}
