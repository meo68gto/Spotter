// Admin Feature Flags Management Edge Function
// Handles CRUD operations for feature flags

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeatureFlag {
  id: string;
  key: string;
  environment: string;
  value: boolean;
  payload: Record<string, unknown>;
  updated_by: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
  usage_stats?: {
    enabled_count: number;
    total_requests: number;
    last_7d_requests: number;
  };
}

interface CreateFlagInput {
  key: string;
  environment: string;
  value: boolean;
  payload?: Record<string, unknown>;
}

interface UpdateFlagInput {
  value?: boolean;
  payload?: Record<string, unknown>;
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
    const { isAdmin, userId: adminUserId, email } = await verifyAdmin(supabaseClient);
    if (!isAdmin || !adminUserId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden', code: 'ADMIN_REQUIRED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    const flagId = path && path !== 'admin-feature-flags' ? path : null;

    switch (req.method) {
      case 'GET':
        if (flagId) {
          return handleGetFlag(supabaseClient, adminUserId, flagId);
        }
        return handleListFlags(supabaseClient, adminUserId, url);

      case 'POST':
        const createBody: CreateFlagInput = await req.json();
        return handleCreateFlag(supabaseClient, adminUserId, email, createBody);

      case 'PATCH':
        if (!flagId) {
          return new Response(
            JSON.stringify({ error: 'Flag ID required', code: 'MISSING_ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const updateBody: UpdateFlagInput = await req.json();
        return handleUpdateFlag(supabaseClient, adminUserId, email, flagId, updateBody);

      case 'DELETE':
        if (!flagId) {
          return new Response(
            JSON.stringify({ error: 'Flag ID required', code: 'MISSING_ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return handleDeleteFlag(supabaseClient, adminUserId, flagId);

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Admin feature flags error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleListFlags(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  url: URL
) {
  const environment = url.searchParams.get('environment');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('feature_flags')
    .select(
      `
      *,
      updated_by:users!feature_flags_updated_by_fkey(display_name, email)
    `,
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (environment) {
    query = query.eq('environment', environment);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('List flags error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch flags', code: 'FETCH_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Transform data to include user email
  const flags: FeatureFlag[] = (data || []).map((flag: any) => ({
    id: flag.id,
    key: flag.key,
    environment: flag.environment,
    value: flag.value,
    payload: flag.payload || {},
    updated_by: flag.updated_by,
    updated_by_email: flag.updated_by?.email || null,
    created_at: flag.created_at,
    updated_at: flag.updated_at,
    usage_stats: {
      enabled_count: 0,
      total_requests: 0,
      last_7d_requests: 0,
    },
  }));

  // Fetch usage stats if available
  try {
    const { data: stats } = await supabase
      .from('feature_flag_usage')
      .select('*')
      .in(
        'flag_id',
        flags.map((f) => f.id)
      );

    if (stats) {
      for (const flag of flags) {
        const flagStats = stats.find((s) => s.flag_id === flag.id);
        if (flagStats) {
          flag.usage_stats = {
            enabled_count: flagStats.enabled_count || 0,
            total_requests: flagStats.total_requests || 0,
            last_7d_requests: flagStats.last_7d_requests || 0,
          };
        }
      }
    }
  } catch {
    // Usage stats table may not exist
  }

  await logAdminAction(supabase, adminUserId, 'ADMIN_FLAGS_LIST', 'SUCCESS', { environment });

  return new Response(
    JSON.stringify({
      success: true,
      data: flags,
      pagination: { total: count ?? 0, limit, offset },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGetFlag(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  flagId: string
) {
  const { data: flag, error } = await supabase
    .from('feature_flags')
    .select(
      `
      *,
      updated_by:users!feature_flags_updated_by_fkey(display_name, email)
    `
    )
    .eq('id', flagId)
    .single();

  if (error || !flag) {
    return new Response(
      JSON.stringify({ error: 'Flag not found', code: 'FLAG_NOT_FOUND' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await logAdminAction(supabase, adminUserId, 'ADMIN_FLAG_VIEW', 'SUCCESS', { flagId });

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        id: flag.id,
        key: flag.key,
        environment: flag.environment,
        value: flag.value,
        payload: flag.payload || {},
        updated_by: flag.updated_by,
        updated_by_email: flag.updated_by?.email || null,
        created_at: flag.created_at,
        updated_at: flag.updated_at,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCreateFlag(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  email: string | null,
  input: CreateFlagInput
) {
  // Validate input
  if (!input.key || !input.environment) {
    return new Response(
      JSON.stringify({ error: 'Key and environment are required', code: 'MISSING_FIELDS' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('feature_flags')
    .select('id')
    .eq('key', input.key)
    .eq('environment', input.environment)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ error: 'Flag already exists for this environment', code: 'DUPLICATE_FLAG' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: flag, error } = await supabase
    .from('feature_flags')
    .insert({
      key: input.key,
      environment: input.environment,
      value: input.value ?? false,
      payload: input.payload || {},
      updated_by: adminUserId,
    })
    .select()
    .single();

  if (error) {
    await logAdminAction(supabase, adminUserId, 'ADMIN_FLAG_CREATE', 'FAILED', { input, error: error.message });
    return new Response(
      JSON.stringify({ error: 'Failed to create flag', code: 'CREATE_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await logAdminAction(supabase, adminUserId, 'ADMIN_FLAG_CREATE', 'SUCCESS', {
    flagId: flag.id,
    key: input.key,
    environment: input.environment,
    value: input.value,
  });

  return new Response(
    JSON.stringify({ success: true, data: flag }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateFlag(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  email: string | null,
  flagId: string,
  input: UpdateFlagInput
) {
  const { data: existingFlag } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('id', flagId)
    .single();

  if (!existingFlag) {
    return new Response(
      JSON.stringify({ error: 'Flag not found', code: 'FLAG_NOT_FOUND' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const updates: Record<string, unknown> = {
    updated_by: adminUserId,
    updated_at: new Date().toISOString(),
  };

  if (input.value !== undefined) {
    updates.value = input.value;
  }

  if (input.payload !== undefined) {
    updates.payload = input.payload;
  }

  const { data: flag, error } = await supabase
    .from('feature_flags')
    .update(updates)
    .eq('id', flagId)
    .select()
    .single();

  if (error) {
    await logAdminAction(supabase, adminUserId, 'ADMIN_FLAG_UPDATE', 'FAILED', { flagId, error: error.message });
    return new Response(
      JSON.stringify({ error: 'Failed to update flag', code: 'UPDATE_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await logAdminAction(supabase, adminUserId, 'ADMIN_FLAG_UPDATE', 'SUCCESS', {
    flagId,
    oldValue: existingFlag.value,
    newValue: input.value,
    key: existingFlag.key,
  });

  return new Response(
    JSON.stringify({ success: true, data: flag }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleDeleteFlag(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  flagId: string
) {
  const { data: existingFlag } = await supabase
    .from('feature_flags')
    .select('key, environment')
    .eq('id', flagId)
    .single();

  if (!existingFlag) {
    return new Response(
      JSON.stringify({ error: 'Flag not found', code: 'FLAG_NOT_FOUND' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { error } = await supabase.from('feature_flags').delete().eq('id', flagId);

  if (error) {
    await logAdminAction(supabase, adminUserId, 'ADMIN_FLAG_DELETE', 'FAILED', { flagId, error: error.message });
    return new Response(
      JSON.stringify({ error: 'Failed to delete flag', code: 'DELETE_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await logAdminAction(supabase, adminUserId, 'ADMIN_FLAG_DELETE', 'SUCCESS', {
    flagId,
    key: existingFlag.key,
    environment: existingFlag.environment,
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Flag deleted' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function verifyAdmin(
  supabase: ReturnType<typeof createClient>
): Promise<{ isAdmin: boolean; userId: string | null; email: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, userId: null, email: null };

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  return { isAdmin: !!adminData, userId: user.id, email: user.email ?? null };
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