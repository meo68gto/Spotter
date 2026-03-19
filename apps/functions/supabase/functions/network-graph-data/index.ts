// Network Graph Data Edge Function
// Provide nodes/edges for network visualization
// Routes: GET /network/graph

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

interface GraphNode {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  tier: string;
  isMe: boolean;
  isSaved: boolean;
  professional?: {
    role?: string;
    company?: string;
    industry?: string;
  };
  golf?: {
    handicap?: number;
  };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipState: 'matched' | 'invited' | 'played_together' | 'regular_partner';
  strengthScore: number;
  roundsCount: number;
  lastInteractionAt: string | null;
}

interface NetworkGraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    avgStrength: number;
    savedNodes: number;
    regularPartners: number;
  };
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
    const depth = Math.min(parseInt(url.searchParams.get('depth') || '1'), 2); // Max depth 2
    const includeSaved = url.searchParams.get('includeSaved') !== 'false';
    const minStrength = parseInt(url.searchParams.get('minStrength') || '0');

    return await getNetworkGraph(
      supabase, 
      user.id, 
      { depth, includeSaved, minStrength }
    );

  } catch (error) {
    console.error('Network graph data error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Get network graph data for visualization
 */
async function getNetworkGraph(
  supabase: any,
  userId: string,
  options: {
    depth: number;
    includeSaved: boolean;
    minStrength: number;
  }
) {
  const { depth, includeSaved, minStrength } = options;

  // Get user's tier info
  const { data: currentUser } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, tier_id, membership_tiers(slug)')
    .eq('id', userId)
    .single();

  if (!currentUser) {
    return new Response(
      JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userTierId = currentUser.tier_id;

  // Collect all nodes and edges
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  // Add current user as first node
  nodes.set(userId, {
    id: userId,
    displayName: currentUser.display_name,
    avatarUrl: currentUser.avatar_url,
    tier: currentUser.membership_tiers?.slug || 'free',
    isMe: true,
    isSaved: false
  });

  // Get user's saved members
  const { data: savedMembers } = await supabase
    .from('saved_members')
    .select('saved_id, tier')
    .eq('saver_id', userId);

  const savedMemberIds = new Set(savedMembers?.map((sm: any) => sm.saved_id) || []);
  const savedMemberTiers = new Map(savedMembers?.map((sm: any) => [sm.saved_id, sm.tier]) || []);

  // Get direct connections (depth 1)
  let directConnectionIds: string[] = [];
  
  let query = supabase
    .from('user_connections')
    .select(`
      id,
      user_id,
      connected_user_id,
      relationship_state,
      strength_score,
      saved_by_user_a,
      saved_by_user_b,
      rounds_count,
      last_interaction_at,
      user:user_id!inner(
        id, display_name, avatar_url, tier_id,
        membership_tiers(slug),
        user_professional_identities(role, company, industry),
        user_golf_identities(handicap)
      ),
      connected_user:connected_user_id!inner(
        id, display_name, avatar_url, tier_id,
        membership_tiers(slug),
        user_professional_identities(role, company, industry),
        user_golf_identities(handicap)
      )
    `)
    .or(`user_id.eq.${userId},connected_user_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (minStrength > 0) {
    query = query.gte('strength_score', minStrength);
  }

  const { data: directConnections } = await query;

  if (directConnections) {
    for (const conn of directConnections) {
      const isUserA = conn.user_id === userId;
      const otherUserId = isUserA ? conn.connected_user_id : conn.user_id;
      const otherUser = isUserA ? conn.connected_user : conn.user;
      const isSaved = isUserA ? conn.saved_by_user_a : conn.saved_by_user_b;
      
      // Same-tier check
      if (otherUser.tier_id !== userTierId) continue;

      directConnectionIds.push(otherUserId);

      // Add edge
      edges.set(conn.id, {
        id: conn.id,
        source: conn.user_id,
        target: conn.connected_user_id,
        relationshipState: conn.relationship_state || 'matched',
        strengthScore: conn.strength_score || 0,
        roundsCount: conn.rounds_count || 0,
        lastInteractionAt: conn.last_interaction_at
      });

      // Add node if not exists
      if (!nodes.has(otherUserId)) {
        const professional = otherUser.user_professional_identities?.[0];
        const golf = otherUser.user_golf_identities?.[0];

        nodes.set(otherUserId, {
          id: otherUserId,
          displayName: otherUser.display_name,
          avatarUrl: otherUser.avatar_url,
          tier: otherUser.membership_tiers?.slug || 'free',
          isMe: false,
          isSaved: isSaved || savedMemberIds.has(otherUserId),
          professional: professional ? {
            role: professional.role,
            company: professional.company,
            industry: professional.industry
          } : undefined,
          golf: golf ? {
            handicap: golf.handicap
          } : undefined
        });
      }
    }
  }

  // Get depth 2 (connections of connections) if requested
  if (depth >= 2 && directConnectionIds.length > 0) {
    const depth2Query = supabase
      .from('user_connections')
      .select(`
        id,
        user_id,
        connected_user_id,
        relationship_state,
        strength_score,
        saved_by_user_a,
        saved_by_user_b,
        rounds_count,
        last_interaction_at,
        user:user_id!inner(
          id, display_name, avatar_url, tier_id,
          membership_tiers(slug),
          user_professional_identities(role, company, industry),
          user_golf_identities(handicap)
        ),
        connected_user:connected_user_id!inner(
          id, display_name, avatar_url, tier_id,
          membership_tiers(slug),
          user_professional_identities(role, company, industry),
          user_golf_identities(handicap)
        )
      `)
      .or(directConnectionIds.map((id: string) => `user_id.eq.${id}`).join(','))
      .or(directConnectionIds.map((id: string) => `connected_user_id.eq.${id}`).join(','))
      .eq('status', 'accepted');

    if (minStrength > 0) {
      depth2Query.gte('strength_score', minStrength);
    }

    const { data: depth2Connections } = await depth2Query;

    if (depth2Connections) {
      for (const conn of depth2Connections) {
        // Skip if edge already exists
        if (edges.has(conn.id)) continue;

        // Get the other user (not in direct connections)
        const isUserA = directConnectionIds.includes(conn.user_id);
        const isUserB = directConnectionIds.includes(conn.connected_user_id);
        
        // Only include edges between direct connections
        if (!isUserA || !isUserB) continue;

        // Same-tier check for both users
        if (conn.user.tier_id !== userTierId || conn.connected_user.tier_id !== userTierId) continue;

        // Add edge
        edges.set(conn.id, {
          id: conn.id,
          source: conn.user_id,
          target: conn.connected_user_id,
          relationshipState: conn.relationship_state || 'matched',
          strengthScore: conn.strength_score || 0,
          roundsCount: conn.rounds_count || 0,
          lastInteractionAt: conn.last_interaction_at
        });
      }
    }
  }

  // Include saved members that aren't connections
  if (includeSaved && savedMemberIds.size > 0) {
    const savedOnlyIds = [...savedMemberIds].filter(id => !nodes.has(id));
    
    if (savedOnlyIds.length > 0) {
      const { data: savedUsers } = await supabase
        .from('users')
        .select(`
          id, display_name, avatar_url, tier_id,
          membership_tiers(slug),
          user_professional_identities(role, company, industry),
          user_golf_identities(handicap)
        `)
        .in('id', savedOnlyIds)
        .eq('tier_id', userTierId); // Same tier only

      if (savedUsers) {
        for (const u of savedUsers) {
          const professional = u.user_professional_identities?.[0];
          const golf = u.user_golf_identities?.[0];

          nodes.set(u.id, {
            id: u.id,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            tier: u.membership_tiers?.slug || 'free',
            isMe: false,
            isSaved: true,
            professional: professional ? {
              role: professional.role,
              company: professional.company,
              industry: professional.industry
            } : undefined,
            golf: golf ? {
              handicap: golf.handicap
            } : undefined
          });
        }
      }
    }
  }

  // Calculate stats
  const nodesArray = Array.from(nodes.values());
  const edgesArray = Array.from(edges.values());
  const avgStrength = edgesArray.length > 0 
    ? edgesArray.reduce((sum, e) => sum + e.strengthScore, 0) / edgesArray.length 
    : 0;
  const regularPartners = edgesArray.filter(e => e.relationshipState === 'regular_partner').length;
  const savedNodes = nodesArray.filter(n => n.isSaved).length;

  const response: NetworkGraphResponse = {
    nodes: nodesArray,
    edges: edgesArray,
    stats: {
      totalNodes: nodesArray.length,
      totalEdges: edgesArray.length,
      avgStrength: Math.round(avgStrength),
      savedNodes,
      regularPartners
    }
  };

  return new Response(
    JSON.stringify(response),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}