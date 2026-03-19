// Admin Users Management Edge Function
// Handles user search, filtering, and account management operations

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserSearchFilters {
  query?: string;
  status?: 'active' | 'suspended' | 'pending_deletion' | 'all';
  role?: string;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
}

interface UserDetails {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  status: 'active' | 'suspended' | 'pending_deletion';
  matches_count: number;
  sessions_count: number;
  deletion_request: {
    id: string;
    status: string;
    requested_at: string;
  } | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    // Verify admin access
    const { isAdmin, userId: adminUserId } = await verifyAdmin(supabaseClient);
    if (!isAdmin || !adminUserId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden', code: 'ADMIN_REQUIRED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (req.method) {
      case 'GET':
        if (path === 'search') {
          return handleUserSearch(supabaseClient, adminUserId, url);
        } else if (path) {
          return handleGetUserDetails(supabaseClient, adminUserId, path);
        }
        return handleUserSearch(supabaseClient, adminUserId, url);

      case 'POST':
        const body = await req.json();
        const { action, userId, reason } = body;

        switch (action) {
          case 'suspend':
            return handleSuspendUser(supabaseClient, adminUserId, userId, reason);
          case 'activate':
            return handleActivateUser(supabaseClient, adminUserId, userId);
          case 'process_deletion':
            return handleProcessDeletion(supabaseClient, adminUserId, userId);
          default:
            return new Response(
              JSON.stringify({ error: 'Invalid action', code: 'INVALID_ACTION' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Admin users error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleUserSearch(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  url: URL
) {
  const filters: UserSearchFilters = {
    query: url.searchParams.get('query') || undefined,
    status: (url.searchParams.get('status') as UserSearchFilters['status']) || 'all',
    role: url.searchParams.get('role') || undefined,
    createdAfter: url.searchParams.get('createdAfter') || undefined,
    createdBefore: url.searchParams.get('createdBefore') || undefined,
    limit: parseInt(url.searchParams.get('limit') || '50'),
    offset: parseInt(url.searchParams.get('offset') || '0'),
  };

  // Build query
  let query = supabase
    .from('users')
    .select(
      `
      id,
      display_name,
      avatar_url,
      created_at,
      updated_at,
      auth:auth.users!inner(
        email,
        last_sign_in_at,
        raw_user_meta_data
      ),
      matches_count:matches!requester_user_id(count),
      deletion_request:user_deletion_requests(id, status, requested_at)
    `,
      { count: 'exact' }
    );

  // Apply filters
  if (filters.query) {
    query = query.or(`display_name.ilike.%${filters.query}%,auth.users.email.ilike.%${filters.query}%`);
  }

  if (filters.createdAfter) {
    query = query.gte('created_at', filters.createdAfter);
  }

  if (filters.createdBefore) {
    query = query.lte('created_at', filters.createdBefore);
  }

  // Apply pagination
  query = query
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('User search error:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed', code: 'SEARCH_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Transform data
  const users = data.map((user: any) => ({
    id: user.id,
    display_name: user.display_name,
    email: user.auth?.[0]?.email ?? null,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    last_sign_in_at: user.auth?.[0]?.last_sign_in_at ?? null,
    status: user.deletion_request?.[0] ? 'pending_deletion' : 'active',
    matches_count: user.matches_count?.[0]?.count ?? 0,
    deletion_request: user.deletion_request?.[0] ?? null,
  }));

  await logAdminAction(supabase, adminUserId, 'ADMIN_USER_SEARCH', 'SUCCESS', { filters });

  return new Response(
    JSON.stringify({
      success: true,
      data: users,
      pagination: {
        total: count ?? 0,
        limit: filters.limit,
        offset: filters.offset,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGetUserDetails(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  userId: string
) {
  const { data: user, error } = await supabase
    .from('users')
    .select(
      `
      *,
      auth:auth.users!inner(email, last_sign_in_at, email_confirmed_at, created_at as auth_created_at),
      matches:matches(count),
      sessions:sessions(count),
      deletion_request:user_deletion_requests(*)
    `
    )
    .eq('id', userId)
    .single();

  if (error || !user) {
    return new Response(
      JSON.stringify({ error: 'User not found', code: 'USER_NOT_FOUND' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await logAdminAction(supabase, adminUserId, 'ADMIN_USER_VIEW', 'SUCCESS', { targetUserId: userId });

  return new Response(
    JSON.stringify({ success: true, data: user }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleSuspendUser(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  userId: string,
  reason?: string
) {
  // Create suspension record
  const { error } = await supabase.from('user_suspensions').insert({
    user_id: userId,
    suspended_by: adminUserId,
    reason: reason || 'Administrative suspension',
    suspended_at: new Date().toISOString(),
  });

  if (error) {
    await logAdminAction(supabase, adminUserId, 'ADMIN_USER_SUSPEND', 'FAILED', { userId, error: error.message });
    return new Response(
      JSON.stringify({ error: 'Failed to suspend user', code: 'SUSPEND_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await logAdminAction(supabase, adminUserId, 'ADMIN_USER_SUSPEND', 'SUCCESS', { userId, reason });

  return new Response(
    JSON.stringify({ success: true, message: 'User suspended' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleActivateUser(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  userId: string
) {
  // Remove suspension record
  const { error } = await supabase.from('user_suspensions').delete().eq('user_id', userId);

  if (error) {
    await logAdminAction(supabase, adminUserId, 'ADMIN_USER_ACTIVATE', 'FAILED', { userId, error: error.message });
    return new Response(
      JSON.stringify({ error: 'Failed to activate user', code: 'ACTIVATE_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await logAdminAction(supabase, adminUserId, 'ADMIN_USER_ACTIVATE', 'SUCCESS', { userId });

  return new Response(
    JSON.stringify({ success: true, message: 'User activated' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleProcessDeletion(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  userId: string
) {
  // Get pending deletion request
  const { data: request } = await supabase
    .from('user_deletion_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single();

  if (!request) {
    return new Response(
      JSON.stringify({ error: 'No pending deletion request found', code: 'NO_DELETION_REQUEST' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update request status to processing
  await supabase
    .from('user_deletion_requests')
    .update({ status: 'processing', processing_started_at: new Date().toISOString() })
    .eq('id', request.id);

  // Call the admin-process-deletion edge function
  try {
    const { error: processError } = await supabase.functions.invoke('admin-process-deletion', {
      body: { requestId: request.id, userId },
    });

    if (processError) throw processError;

    await logAdminAction(supabase, adminUserId, 'ADMIN_PROCESS_DELETION', 'SUCCESS', { userId, requestId: request.id });

    return new Response(
      JSON.stringify({ success: true, message: 'Deletion processing initiated' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Update request with failure
    await supabase
      .from('user_deletion_requests')
      .update({
        status: 'failed',
        failure_reason: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', request.id);

    await logAdminAction(supabase, adminUserId, 'ADMIN_PROCESS_DELETION', 'FAILED', { userId, requestId: request.id, error: error instanceof Error ? error.message : 'Unknown error' });

    return new Response(
      JSON.stringify({ error: 'Deletion processing failed', code: 'DELETION_FAILED' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function verifyAdmin(supabase: ReturnType<typeof createClient>): Promise<{ isAdmin: boolean; userId: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, userId: null };

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  return { isAdmin: !!adminData, userId: user.id };
}

async function logAdminAction(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  action: string,
  status: 'SUCCESS' | 'FAILED',
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.from('admin_audit_logs').insert({
      admin_user_id: adminUserId,
      action,
      status,
      metadata,
      ip_address: 'edge-function',
      user_agent: 'edge-function',
    });
  } catch (e) {
    console.error('Failed to log admin action:', e);
  }
}