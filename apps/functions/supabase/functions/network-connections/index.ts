// Network Connections Edge Function
// List user's connections with network graph data
// Routes: GET /network/connections

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

interface NetworkConnection {
  id: string;
  userId: string;
  connectedUserId: string;
  status: 'pending_sent' | 'pending_received' | 'accepted' | 'declined';
  relationshipState: 'matched' | 'invited' | 'played_together' | 'regular_partner';
  strengthScore: number;
  isSavedByMe: boolean;
  roundsCount: number;
  lastInteractionAt: string | null;
  connectedAt: string | null;
  member: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    tier: string;
    bio: string | null;
    professional?: {
      role?: string;
      company?: string;
      industry?: string;
    };
    golf?: {
      handicap?: number;
    };
  };
}

interface NetworkStats {
  totalConnections: number;
  savedConnections: number;
  regularPartners: number;
  avgStrengthScore: number;
  pendingIntroductions: number;
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

    // Parse URL parameters
    const url = new URL(req.url);
    const filter = url.searchParams.get('filter') || 'all';
    const state = url.searchParams.get('state');
    const savedOnly = url.searchParams.get('saved') === 'true';
    const minStrength = parseInt(url.searchParams.get('minStrength') || '0');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const includeStats = url.searchParams.get('stats') === 'true';

    return await listNetworkConnections(
      supabase, 
      user.id, 
      { filter, state, savedOnly, minStrength, page, limit, includeStats }
    );

  } catch (error) {
    console.error('Network connections error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * List network connections with filtering
 */
async function listNetworkConnections(
  supabase: any,
  userId: string,
  options: {
    filter: string;
    state: string | null;
    savedOnly: boolean;
    minStrength: number;
    page: number;
    limit: number;
    includeStats: boolean;
  }
) {
  const { filter, state, savedOnly, minStrength, page, limit, includeStats } = options;
  const offset = (page - 1) * limit;

  // Build base query
  let query = supabase
    .from('user_connections')
    .select(`
      id,
      user_id,
      connected_user_id,
      status,
      relationship_state,
      strength_score,
      saved_by_user_a,
      saved_by_user_b,
      rounds_count,
      last_interaction_at,
      created_at,
      responded_at,
      connected_user:user_id!inner(
        id,
        display_name,
        avatar_url,
        bio,
        membership_tiers(slug),
        user_professional_identities(role, company, industry),
        user_golf_identities(handicap)
      ),
      requesting_user:connected_user_id!inner(
        id,
        display_name,
        avatar_url,
        bio,
        membership_tiers(slug),
        user_professional_identities(role, company, industry),
        user_golf_identities(handicap)
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
  }

  // Filter by relationship state
  if (state) {
    query = query.eq('relationship_state', state);
  }

  // Filter saved connections
  if (savedOnly) {
    query = query.or(`and(user_id.eq.${userId},saved_by_user_a.eq.true),and(connected_user_id.eq.${userId},saved_by_user_b.eq.true)`);
  }

  // Filter by minimum strength score
  if (minStrength > 0) {
    query = query.gte('strength_score', minStrength);
  }

  // Apply pagination and sorting
  query = query
    .order('strength_score', { ascending: false })
    .order('last_interaction_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data: connections, count, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch connections', code: 'fetch_failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Transform connections
  const transformedConnections: NetworkConnection[] = (connections || []).map((conn: any) => {
    const isRequester = conn.user_id === userId;
    const memberData = isRequester ? conn.requesting_user : conn.connected_user;
    const tier = memberData?.membership_tiers?.slug || 'free';
    const isSavedByMe = isRequester ? conn.saved_by_user_a : conn.saved_by_user_b;

    let status: NetworkConnection['status'];
    if (conn.status === 'pending') {
      status = isRequester ? 'pending_sent' : 'pending_received';
    } else {
      status = conn.status;
    }

    const professional = memberData?.user_professional_identities?.[0];
    const golf = memberData?.user_golf_identities?.[0];

    return {
      id: conn.id,
      userId: conn.user_id,
      connectedUserId: conn.connected_user_id,
      status,
      relationshipState: conn.relationship_state || 'matched',
      strengthScore: conn.strength_score || 0,
      isSavedByMe,
      roundsCount: conn.rounds_count || 0,
      lastInteractionAt: conn.last_interaction_at,
      connectedAt: conn.status === 'accepted' ? conn.responded_at : null,
      member: {
        id: memberData.id,
        displayName: memberData.display_name,
        avatarUrl: memberData.avatar_url,
        tier,
        bio: memberData.bio,
        professional: professional ? {
          role: professional.role,
          company: professional.company,
          industry: professional.industry
        } : undefined,
        golf: golf ? {
          handicap: golf.handicap
        } : undefined
      }
    };
  });

  const response: any = {
    data: transformedConnections,
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.ceil((count || 0) / limit)
    }
  };

  // Include network stats if requested
  if (includeStats) {
    const { data: stats } = await supabase.rpc('get_network_stats', { p_user_id: userId });
    if (stats && stats[0]) {
      response.stats = {
        totalConnections: parseInt(stats[0].total_connections) || 0,
        savedConnections: parseInt(stats[0].saved_connections) || 0,
        regularPartners: parseInt(stats[0].regular_partners) || 0,
        avgStrengthScore: Math.round(parseFloat(stats[0].avg_strength_score) || 0),
        pendingIntroductions: parseInt(stats[0].pending_introductions) || 0
      } as NetworkStats;
    }
  }

  return new Response(
    JSON.stringify(response),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}