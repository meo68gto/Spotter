// Admin Dashboard Data Edge Function
// Provides system overview statistics for admin dashboard

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DashboardStats {
  users: {
    total: number;
    activeToday: number;
    activeThisWeek: number;
    newToday: number;
    newThisWeek: number;
  };
  sessions: {
    total: number;
    proposed: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  matches: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    expired: number;
  };
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
  errors: {
    recent: Array<{
      id: string;
      error_type: string;
      message: string;
      user_id: string | null;
      created_at: string;
    }>;
    count24h: number;
  };
  deletionRequests: {
    pending: number;
    processing: number;
    completed: number;
  };
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
    const isAdmin = await verifyAdmin(supabaseClient);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden', code: 'ADMIN_REQUIRED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch user statistics
    const { count: totalUsers } = await supabaseClient
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: newToday } = await supabaseClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    const { count: newThisWeek } = await supabaseClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString());

    // Active users (based on last activity from sessions or auth)
    const { count: activeToday } = await supabaseClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', todayStart.toISOString());

    const { count: activeThisWeek } = await supabaseClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', weekStart.toISOString());

    // Session statistics
    const { data: sessionStats } = await supabaseClient
      .from('sessions')
      .select('status');

    const sessionCounts = {
      total: sessionStats?.length ?? 0,
      proposed: sessionStats?.filter(s => s.status === 'proposed').length ?? 0,
      confirmed: sessionStats?.filter(s => s.status === 'confirmed').length ?? 0,
      completed: sessionStats?.filter(s => s.status === 'completed').length ?? 0,
      cancelled: sessionStats?.filter(s => s.status === 'cancelled').length ?? 0,
    };

    // Match statistics
    const { data: matchStats } = await supabaseClient
      .from('matches')
      .select('status');

    const matchCounts = {
      total: matchStats?.length ?? 0,
      pending: matchStats?.filter(m => m.status === 'pending').length ?? 0,
      accepted: matchStats?.filter(m => m.status === 'accepted').length ?? 0,
      rejected: matchStats?.filter(m => m.status === 'rejected').length ?? 0,
      expired: matchStats?.filter(m => m.status === 'expired').length ?? 0,
    };

    // Revenue from payments table (if exists)
    let revenue = { today: 0, thisWeek: 0, thisMonth: 0, total: 0 };
    try {
      const { data: payments } = await supabaseClient
        .from('payments')
        .select('amount, created_at, status')
        .eq('status', 'completed');

      if (payments) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        revenue.total = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
        revenue.thisMonth = payments
          .filter(p => new Date(p.created_at) >= monthStart)
          .reduce((sum, p) => sum + (p.amount ?? 0), 0);
        revenue.thisWeek = payments
          .filter(p => new Date(p.created_at) >= weekStart)
          .reduce((sum, p) => sum + (p.amount ?? 0), 0);
        revenue.today = payments
          .filter(p => new Date(p.created_at) >= todayStart)
          .reduce((sum, p) => sum + (p.amount ?? 0), 0);
      }
    } catch {
      // Revenue table may not exist
      revenue = { today: 0, thisWeek: 0, thisMonth: 0, total: 0 };
    }

    // Recent errors
    const { data: recentErrors } = await supabaseClient
      .from('error_logs')
      .select('id, error_type, message, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    const { count: errorCount24h } = await supabaseClient
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', day24hAgo.toISOString());

    // Deletion requests
    const { data: deletionStats } = await supabaseClient
      .from('user_deletion_requests')
      .select('status');

    const deletionCounts = {
      pending: deletionStats?.filter(d => d.status === 'pending').length ?? 0,
      processing: deletionStats?.filter(d => d.status === 'processing').length ?? 0,
      completed: deletionStats?.filter(d => d.status === 'completed').length ?? 0,
    };

    const stats: DashboardStats = {
      users: {
        total: totalUsers ?? 0,
        activeToday: activeToday ?? 0,
        activeThisWeek: activeThisWeek ?? 0,
        newToday: newToday ?? 0,
        newThisWeek: newThisWeek ?? 0,
      },
      sessions: sessionCounts,
      matches: matchCounts,
      revenue,
      errors: {
        recent: recentErrors ?? [],
        count24h: errorCount24h ?? 0,
      },
      deletionRequests: deletionCounts,
    };

    // Log dashboard access
    await logAdminAction(supabaseClient, 'ADMIN_DASHBOARD_VIEW', 'SUCCESS');

    return new Response(
      JSON.stringify({ success: true, data: stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function verifyAdmin(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  return !!adminData;
}

async function logAdminAction(
  supabase: ReturnType<typeof createClient>,
  action: string,
  status: 'SUCCESS' | 'FAILED',
  metadata: Record<string, unknown> = {}
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('admin_audit_logs').insert({
      admin_user_id: user.id,
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