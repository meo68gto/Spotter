// Admin Authentication Edge Function
// Verifies admin role and returns admin session info

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminUser {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  last_sign_in_at: string | null;
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

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: adminData, error: adminError } = await supabaseClient
      .from('admin_users')
      .select('role, permissions')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminData) {
      // Log unauthorized admin access attempt
      await logAdminAction(supabaseClient, user.id, 'ADMIN_ACCESS_DENIED', 'FAILED', { reason: 'Not an admin user' });
      
      return new Response(
        JSON.stringify({ error: 'Forbidden', code: 'ADMIN_REQUIRED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user details
    const { data: userData } = await supabaseClient
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .single();

    const adminUser: AdminUser = {
      id: user.id,
      email: user.email ?? '',
      role: adminData.role,
      display_name: userData?.display_name ?? null,
      last_sign_in_at: user.last_sign_in_at,
    };

    // Log successful admin authentication
    await logAdminAction(supabaseClient, user.id, 'ADMIN_LOGIN', 'SUCCESS', { role: adminData.role });

    return new Response(
      JSON.stringify({
        success: true,
        data: adminUser,
        permissions: adminData.permissions ?? [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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