// Network Save Member Edge Function
// Save/unsave members and manage saved member tiers/tags
// Routes: POST /network/save, DELETE /network/save, PATCH /network/save

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyInteractionAllowed } from '../_shared/enforcement.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SaveMemberBody {
  action: 'save' | 'unsave' | 'update';
  userId: string;
  tier?: 'favorite' | 'standard' | 'archived';
  notes?: string;
  tags?: string[];
}

interface SavedMemberResponse {
  id: string;
  saverId: string;
  savedId: string;
  tier: 'favorite' | 'standard' | 'archived';
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  member: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    tier: string;
  };
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    // Route based on method
    if (req.method === 'POST') {
      return await saveMember(supabase, user.id, req);
    } else if (req.method === 'DELETE') {
      return await unsaveMember(supabase, user.id, req);
    } else if (req.method === 'PATCH') {
      return await updateSavedMember(supabase, user.id, req);
    } else if (req.method === 'GET') {
      return await listSavedMembers(supabase, user.id, req);
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed', code: 'method_not_allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Network save member error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Save a member
 */
async function saveMember(supabase: any, userId: string, req: Request) {
  let body: SaveMemberBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { userId: targetUserId, tier = 'standard', notes, tags = [] } = body;

  if (!targetUserId) {
    return new Response(
      JSON.stringify({ error: 'userId is required', code: 'missing_user_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prevent self-save
  if (targetUserId === userId) {
    return new Response(
      JSON.stringify({ error: 'Cannot save yourself', code: 'self_save' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Same-tier enforcement: Verify interaction is allowed
  const interactionCheck = await verifyInteractionAllowed(supabase, userId, targetUserId);
  if (!interactionCheck.allowed) {
    return new Response(
      JSON.stringify({ error: interactionCheck.error, code: interactionCheck.code }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if target user exists
  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('id, tier_id, display_name, avatar_url, membership_tiers(slug)')
    .eq('id', targetUserId)
    .single();

  if (targetError || !targetUser) {
    return new Response(
      JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if already saved
  const { data: existing } = await supabase
    .from('saved_members')
    .select('id')
    .eq('saver_id', userId)
    .eq('saved_id', targetUserId)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ error: 'Member already saved', code: 'already_saved' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if there's an existing connection
  const { data: connection } = await supabase
    .from('user_connections')
    .select('id')
    .or(`and(user_id.eq.${userId},connected_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},connected_user_id.eq.${userId})`)
    .eq('status', 'accepted')
    .maybeSingle();

  // Create saved member record
  const { data: savedMember, error: saveError } = await supabase
    .from('saved_members')
    .insert({
      saver_id: userId,
      saved_id: targetUserId,
      tier,
      notes: notes || null,
      tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id, saver_id, saved_id, tier, notes, tags, created_at, updated_at')
    .single();

  if (saveError || !savedMember) {
    return new Response(
      JSON.stringify({ error: 'Failed to save member', code: 'save_failed', details: saveError?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update connection saved status if connection exists
  if (connection) {
    await supabase
      .from('user_connections')
      .update({ 
        saved_by_user_a: connection.user_id === userId ? true : undefined,
        saved_by_user_b: connection.connected_user_id === userId ? true : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);
  }

  const response: SavedMemberResponse = {
    id: savedMember.id,
    saverId: savedMember.saver_id,
    savedId: savedMember.saved_id,
    tier: savedMember.tier,
    notes: savedMember.notes,
    tags: savedMember.tags || [],
    createdAt: savedMember.created_at,
    updatedAt: savedMember.updated_at,
    member: {
      id: targetUser.id,
      displayName: targetUser.display_name,
      avatarUrl: targetUser.avatar_url,
      tier: targetUser.membership_tiers?.slug || 'free'
    }
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Unsave a member
 */
async function unsaveMember(supabase: any, userId: string, req: Request) {
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get('userId');

  if (!targetUserId) {
    return new Response(
      JSON.stringify({ error: 'userId query parameter is required', code: 'missing_user_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Delete saved member record
  const { error: deleteError } = await supabase
    .from('saved_members')
    .delete()
    .eq('saver_id', userId)
    .eq('saved_id', targetUserId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: 'Failed to unsave member', code: 'unsave_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update connection saved status
  const { data: connection } = await supabase
    .from('user_connections')
    .select('id, user_id, connected_user_id')
    .or(`and(user_id.eq.${userId},connected_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},connected_user_id.eq.${userId})`)
    .maybeSingle();

  if (connection) {
    const isUserA = connection.user_id === userId;
    await supabase
      .from('user_connections')
      .update({ 
        saved_by_user_a: isUserA ? false : connection.saved_by_user_a,
        saved_by_user_b: !isUserA ? false : connection.saved_by_user_b,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Update saved member (tier, notes, tags)
 */
async function updateSavedMember(supabase: any, userId: string, req: Request) {
  let body: SaveMemberBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { userId: targetUserId, tier, notes, tags } = body;

  if (!targetUserId) {
    return new Response(
      JSON.stringify({ error: 'userId is required', code: 'missing_user_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build update object
  const updates: any = { updated_at: new Date().toISOString() };
  if (tier !== undefined) updates.tier = tier;
  if (notes !== undefined) updates.notes = notes;
  if (tags !== undefined) updates.tags = tags;

  // Update saved member
  const { data: savedMember, error: updateError } = await supabase
    .from('saved_members')
    .update(updates)
    .eq('saver_id', userId)
    .eq('saved_id', targetUserId)
    .select('id, saver_id, saved_id, tier, notes, tags, created_at, updated_at')
    .single();

  if (updateError || !savedMember) {
    return new Response(
      JSON.stringify({ error: 'Failed to update saved member', code: 'update_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get target user info
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, membership_tiers(slug)')
    .eq('id', targetUserId)
    .single();

  const response: SavedMemberResponse = {
    id: savedMember.id,
    saverId: savedMember.saver_id,
    savedId: savedMember.saved_id,
    tier: savedMember.tier,
    notes: savedMember.notes,
    tags: savedMember.tags || [],
    createdAt: savedMember.created_at,
    updatedAt: savedMember.updated_at,
    member: {
      id: targetUser.id,
      displayName: targetUser.display_name,
      avatarUrl: targetUser.avatar_url,
      tier: targetUser.membership_tiers?.slug || 'free'
    }
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * List saved members
 */
async function listSavedMembers(supabase: any, userId: string, req: Request) {
  const url = new URL(req.url);
  const tier = url.searchParams.get('tier');
  const tag = url.searchParams.get('tag');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('saved_members')
    .select(`
      id,
      saver_id,
      saved_id,
      tier,
      notes,
      tags,
      created_at,
      updated_at,
      saved_user:saved_id!inner(
        id,
        display_name,
        avatar_url,
        membership_tiers(slug),
        user_professional_identities(role, company),
        user_golf_identities(handicap)
      )
    `, { count: 'exact' })
    .eq('saver_id', userId);

  // Apply filters
  if (tier) {
    query = query.eq('tier', tier);
  }
  if (tag) {
    query = query.contains('tags', [tag]);
  }

  // Apply pagination
  query = query
    .order('tier', { ascending: false }) // favorite first
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: savedMembers, count, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch saved members', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const transformed = (savedMembers || []).map((sm: any) => {
    const user = sm.saved_user;
    const professional = user?.user_professional_identities?.[0];
    const golf = user?.user_golf_identities?.[0];

    return {
      id: sm.id,
      saverId: sm.saver_id,
      savedId: sm.saved_id,
      tier: sm.tier,
      notes: sm.notes,
      tags: sm.tags || [],
      createdAt: sm.created_at,
      updatedAt: sm.updated_at,
      member: {
        id: user.id,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        tier: user.membership_tiers?.slug || 'free',
        professional: professional ? {
          role: professional.role,
          company: professional.company
        } : undefined,
        golf: golf ? {
          handicap: golf.handicap
        } : undefined
      }
    };
  });

  return new Response(
    JSON.stringify({
      data: transformed,
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