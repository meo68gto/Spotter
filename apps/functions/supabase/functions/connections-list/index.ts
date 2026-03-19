// Connections List Edge Function
// List user's connections and find mutual connections
// Routes: GET /connections/list, GET /connections/mutual

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

interface Connection {
  id: string;
  userId: string;
  connectedUserId: string;
  status: 'pending_sent' | 'pending_received' | 'accepted' | 'declined';
  message: string | null;
  connectedAt: string | null;
  member: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    tier: string;
    bio: string | null;
  };
}

interface MutualConnection {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  tier: string;
  connectionDate: string;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow GET
  if (req.method !== 'GET') {
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

    // Parse URL to determine endpoint
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.includes('/mutual')) {
      // Get target user ID from query param
      const targetUserId = url.searchParams.get('userId');
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'userId query parameter is required', code: 'missing_user_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await getMutualConnections(supabase, user.id, targetUserId);
    } else {
      // List connections
      const filter = url.searchParams.get('filter') || 'all';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
      return await listConnections(supabase, user.id, filter, page, limit);
    }

  } catch (error) {
    console.error('Connections list error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * List user's connections
 */
async function listConnections(
  supabase: any,
  userId: string,
  filter: string,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;

  // Build query based on filter
  let query = supabase
    .from('user_connections')
    .select(`
      id,
      user_id,
      connected_user_id,
      status,
      message,
      created_at,
      responded_at,
      connected_user:user_id!inner(
        id,
        display_name,
        avatar_url,
        bio,
        membership_tiers(slug)
      ),
      requesting_user:connected_user_id!inner(
        id,
        display_name,
        avatar_url,
        bio,
        membership_tiers(slug)
      )
    `, { count: 'exact' })
    .or(`user_id.eq.${userId},connected_user_id.eq.${userId}`);

  // Apply filters
  if (filter === 'accepted') {
    query = query.eq('status', 'accepted');
  } else if (filter === 'pending_sent') {
    query = query.eq('status', 'pending').eq('user_id', userId);
  } else if (filter === 'pending_received') {
    query = query.eq('status', 'pending').eq('connected_user_id', userId);
  } else if (filter === 'all') {
    // No additional filter
  } else {
    return new Response(
      JSON.stringify({ error: 'Invalid filter. Use: all, accepted, pending_sent, pending_received', code: 'invalid_filter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Apply pagination
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: connections, count, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch connections', code: 'fetch_failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Transform connections
  const transformedConnections: Connection[] = (connections || []).map((conn: any) => {
    const isRequester = conn.user_id === userId;
    const memberData = isRequester ? conn.requesting_user : conn.connected_user;
    const tier = memberData?.membership_tiers?.slug || 'free';

    let status: Connection['status'];
    if (conn.status === 'pending') {
      status = isRequester ? 'pending_sent' : 'pending_received';
    } else {
      status = conn.status;
    }

    return {
      id: conn.id,
      userId: conn.user_id,
      connectedUserId: conn.connected_user_id,
      status,
      message: conn.message,
      connectedAt: conn.status === 'accepted' ? conn.responded_at : null,
      member: {
        id: memberData.id,
        displayName: memberData.display_name,
        avatarUrl: memberData.avatar_url,
        tier,
        bio: memberData.bio
      }
    };
  });

  return new Response(
    JSON.stringify({
      data: transformedConnections,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Get mutual connections between current user and target user
 */
async function getMutualConnections(
  supabase: any,
  userId: string,
  targetUserId: string
) {
  // Validate target user exists
  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('id')
    .eq('id', targetUserId)
    .single();

  if (targetError || !targetUser) {
    return new Response(
      JSON.stringify({ error: 'Target user not found', code: 'user_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get current user's connections
  const { data: userConnections, error: userError } = await supabase
    .from('user_connections')
    .select('user_id, connected_user_id')
    .or(`and(user_id.eq.${userId},status.eq.accepted),and(connected_user_id.eq.${userId},status.eq.accepted)`);

  if (userError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch connections', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get target user's connections
  const { data: targetConnections, error: targetConnError } = await supabase
    .from('user_connections')
    .select('user_id, connected_user_id')
    .or(`and(user_id.eq.${targetUserId},status.eq.accepted),and(connected_user_id.eq.${targetUserId},status.eq.accepted)`);

  if (targetConnError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch target connections', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Extract connection user IDs for current user
  const userConnectionIds = new Set<string>();
  for (const conn of userConnections || []) {
    if (conn.user_id === userId) {
      userConnectionIds.add(conn.connected_user_id);
    } else {
      userConnectionIds.add(conn.user_id);
    }
  }

  // Extract connection user IDs for target user
  const targetConnectionIds = new Set<string>();
  for (const conn of targetConnections || []) {
    if (conn.user_id === targetUserId) {
      targetConnectionIds.add(conn.connected_user_id);
    } else {
      targetConnectionIds.add(conn.user_id);
    }
  }

  // Find mutual connections
  const mutualIds = [...userConnectionIds].filter(id => targetConnectionIds.has(id) && id !== userId && id !== targetUserId);

  if (mutualIds.length === 0) {
    return new Response(
      JSON.stringify({ data: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get detailed info for mutual connections
  const { data: mutualUsers, error: mutualError } = await supabase
    .from('users')
    .select(`
      id,
      display_name,
      avatar_url,
      membership_tiers(slug)
    `)
    .in('id', mutualIds);

  if (mutualError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch mutual connections', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get connection dates
  const { data: connectionDates } = await supabase
    .from('user_connections')
    .select('user_id, connected_user_id, responded_at')
    .in('user_id', mutualIds.concat([userId]))
    .in('connected_user_id', mutualIds.concat([userId]))
    .eq('status', 'accepted');

  const connectionDateMap = new Map<string, string>();
  for (const conn of connectionDates || []) {
    const otherId = conn.user_id === userId ? conn.connected_user_id : conn.user_id;
    if (!connectionDateMap.has(otherId) || conn.responded_at > connectionDateMap.get(otherId)!) {
      connectionDateMap.set(otherId, conn.responded_at);
    }
  }

  const mutualConnections: MutualConnection[] = (mutualUsers || []).map((u: any) => ({
    id: u.id,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    tier: u.membership_tiers?.slug || 'free',
    connectionDate: connectionDateMap.get(u.id) || new Date().toISOString()
  }));

  return new Response(
    JSON.stringify({
      data: mutualConnections,
      count: mutualConnections.length,
      targetUserId
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
