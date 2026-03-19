// Organizer Analytics Edge Function
// Handles dashboard data, event analytics, and data exports

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, TierSlug } from '../_shared/tier-gate.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PERMISSION_LEVELS = {
  owner: 3,
  admin: 2,
  editor: 1,
  viewer: 0
};

type OrganizerRole = keyof typeof PERMISSION_LEVELS;

interface ExportRequest {
  organizerId: string;
  format: 'csv' | 'json';
  dateFrom?: string;
  dateTo?: string;
  dataType: 'registrations' | 'events' | 'revenue' | 'all';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const lastPath = pathParts[pathParts.length - 1] || '';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'missing_auth_header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const method = req.method;

    if (lastPath === 'dashboard' && method === 'GET') {
      return await handleDashboard(url, supabase, user.id);
    } else if (lastPath.startsWith('event/') && method === 'GET') {
      const eventId = lastPath.replace('event/', '');
      return await handleEventAnalytics(eventId, supabase, user.id);
    } else if (lastPath === 'export' && method === 'POST') {
      return await handleExport(req, supabase, user.id);
    }

    return new Response(
      JSON.stringify({ error: 'Not found', code: 'not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Organizer analytics error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkOrganizerPermission(
  supabase: any,
  userId: string,
  organizerId: string,
  minRole: OrganizerRole = 'viewer'
): Promise<{ allowed: boolean; role: OrganizerRole | null; organizer: any | null }> {
  const { data: membership, error } = await supabase
    .from('organizer_members')
    .select('role, organizer:organizer_id (id, tier)')
    .eq('user_id', userId)
    .eq('organizer_id', organizerId)
    .eq('status', 'active')
    .single();

  if (error || !membership) {
    return { allowed: false, role: null, organizer: null };
  }

  const requiredLevel = PERMISSION_LEVELS[minRole];
  const userLevel = PERMISSION_LEVELS[membership.role as OrganizerRole] || 0;

  return {
    allowed: userLevel >= requiredLevel,
    role: membership.role as OrganizerRole,
    organizer: membership.organizer
  };
}

function getDateRange(range: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();

  switch (range) {
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '90d':
      from.setDate(from.getDate() - 90);
      break;
    case '1y':
      from.setFullYear(from.getFullYear() - 1);
      break;
    default:
      from.setDate(from.getDate() - 30);
  }

  return { from, to };
}

async function handleDashboard(url: URL, supabase: any, userId: string): Promise<Response> {
  const organizerId = url.searchParams.get('organizerId');
  const range = url.searchParams.get('range') || '30d';

  if (!organizerId) {
    return new Response(
      JSON.stringify({ error: 'organizerId is required', code: 'missing_organizer_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, organizerId, 'viewer');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { from, to } = getDateRange(range);

  // Get events in range
  const { data: events, error: eventsError } = await supabase
    .from('organizer_events')
    .select('id, status, event_date, price, created_at')
    .eq('organizer_id', organizerId)
    .gte('event_date', from.toISOString())
    .lte('event_date', to.toISOString());

  if (eventsError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch events', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const eventIds = events?.map((e: any) => e.id) || [];

  // Get registrations for these events
  const { data: registrations, error: regsError } = await supabase
    .from('organizer_registrations')
    .select('id, event_id, status, payment_status, payment_amount, registered_at, checked_in_at')
    .in('event_id', eventIds);

  if (regsError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch registrations', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate metrics
  const totalEvents = events?.length || 0;
  const publishedEvents = events?.filter((e: any) => e.status === 'published').length || 0;
  const completedEvents = events?.filter((e: any) => e.status === 'completed').length || 0;
  const cancelledEvents = events?.filter((e: any) => e.status === 'cancelled').length || 0;

  const totalRegistrations = registrations?.length || 0;
  const confirmedRegistrations = registrations?.filter((r: any) => r.status === 'confirmed').length || 0;
  const checkedInCount = registrations?.filter((r: any) => r.checked_in_at).length || 0;

  const totalRevenue = registrations?.reduce((sum: number, r: any) => {
    return sum + (r.payment_status === 'completed' ? (r.payment_amount || 0) : 0);
  }, 0) || 0;

  const attendanceRate = confirmedRegistrations > 0 
    ? Math.round((checkedInCount / confirmedRegistrations) * 100) 
    : 0;

  // Time series data (by day)
  const dailyData: Record<string, { registrations: number; revenue: number }> = {};
  registrations?.forEach((r: any) => {
    const date = new Date(r.registered_at).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { registrations: 0, revenue: 0 };
    }
    dailyData[date].registrations++;
    if (r.payment_status === 'completed') {
      dailyData[date].revenue += r.payment_amount || 0;
    }
  });

  const timeSeries = Object.entries(dailyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  // Recent activity
  const recentRegistrations = registrations
    ?.sort((a: any, b: any) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())
    .slice(0, 5);

  const response = {
    summary: {
      totalEvents,
      publishedEvents,
      completedEvents,
      cancelledEvents,
      totalRegistrations,
      confirmedRegistrations,
      checkedInCount,
      attendanceRate,
      totalRevenue
    },
    timeSeries,
    recentActivity: recentRegistrations,
    range: { from: from.toISOString(), to: to.toISOString() }
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleEventAnalytics(eventId: string, supabase: any, userId: string): Promise<Response> {
  // Get event
  const { data: event, error: eventError } = await supabase
    .from('organizer_events')
    .select('id, organizer_id, name, event_date, status, price, max_registrations')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return new Response(
      JSON.stringify({ error: 'Event not found', code: 'event_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, event.organizer_id, 'viewer');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get registrations with user tier info
  const { data: registrations, error: regsError } = await supabase
    .from('organizer_registrations')
    .select(`
      id,
      status,
      payment_status,
      payment_amount,
      registered_at,
      checked_in_at,
      user:user_id (
        membership_tiers (slug)
      )
    `)
    .eq('event_id', eventId);

  if (regsError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch registrations', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Registration funnel
  const total = registrations?.length || 0;
  const pending = registrations?.filter((r: any) => r.status === 'pending_approval').length || 0;
  const confirmed = registrations?.filter((r: any) => r.status === 'confirmed').length || 0;
  const cancelled = registrations?.filter((r: any) => r.status === 'cancelled').length || 0;
  const checkedIn = registrations?.filter((r: any) => r.checked_in_at).length || 0;

  // Attendance rate
  const attendanceRate = confirmed > 0 ? Math.round((checkedIn / confirmed) * 100) : 0;

  // Revenue breakdown
  const completedPayments = registrations?.filter((r: any) => r.payment_status === 'completed') || [];
  const totalRevenue = completedPayments.reduce((sum: number, r: any) => sum + (r.payment_amount || 0), 0);
  const pendingRevenue = registrations?.filter((r: any) => r.payment_status === 'pending')
    .reduce((sum: number, r: any) => sum + (r.payment_amount || 0), 0) || 0;
  const refundedAmount = registrations?.filter((r: any) => r.payment_status === 'refunded')
    .reduce((sum: number, r: any) => sum + (r.payment_amount || 0), 0) || 0;

  // Tier breakdown
  const tierBreakdown: Record<string, number> = {};
  registrations?.forEach((r: any) => {
    const tier = r.user?.membership_tiers?.slug || 'free';
    tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1;
  });

  // Registration timeline
  const timeline: Record<string, number> = {};
  registrations?.forEach((r: any) => {
    const date = new Date(r.registered_at).toISOString().split('T')[0];
    timeline[date] = (timeline[date] || 0) + 1;
  });
  
  const registrationTimeline = Object.entries(timeline)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Conversion rates
  const conversionRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const fillRate = event.max_registrations ? Math.round((confirmed / event.max_registrations) * 100) : 0;

  const response = {
    event: {
      id: event.id,
      name: event.name,
      eventDate: event.event_date,
      status: event.status,
      price: event.price,
      maxRegistrations: event.max_registrations
    },
    funnel: {
      total,
      pending,
      confirmed,
      cancelled,
      checkedIn,
      conversionRate
    },
    attendance: {
      confirmed,
      checkedIn,
      attendanceRate,
      noShows: confirmed - checkedIn
    },
    revenue: {
      total: totalRevenue,
      pending: pendingRevenue,
      refunded: refundedAmount,
      net: totalRevenue - refundedAmount
    },
    tierBreakdown,
    registrationTimeline,
    fillRate
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleExport(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: ExportRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.organizerId) {
    return new Response(
      JSON.stringify({ error: 'organizerId is required', code: 'missing_organizer_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed, organizer } = await checkOrganizerPermission(supabase, userId, body.organizerId, 'viewer');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Gold tier only feature
  const organizerTier = (organizer?.tier as TierSlug) || TIER_SLUGS.FREE;
  if (organizerTier !== TIER_SLUGS.SUMMIT) {
    return new Response(
      JSON.stringify({ error: 'Export feature requires Gold tier', code: 'tier_insufficient' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const dateFrom = body.dateFrom ? new Date(body.dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const dateTo = body.dateTo ? new Date(body.dateTo) : new Date();

  // Build query based on data type
  let data: any[] = [];

  if (body.dataType === 'registrations' || body.dataType === 'all') {
    const { data: regs } = await supabase
      .from('organizer_registrations')
      .select(`
        id,
        event:event_id (name, event_date),
        user:user_id (display_name, email, membership_tiers (slug)),
        status,
        payment_status,
        payment_amount,
        registered_at,
        checked_in_at,
        cancelled_at
      `)
      .eq('event.organizer_id', body.organizerId)
      .gte('registered_at', dateFrom.toISOString())
      .lte('registered_at', dateTo.toISOString());
    
    data = regs || [];
  } else if (body.dataType === 'events') {
    const { data: events } = await supabase
      .from('organizer_events')
      .select('*')
      .eq('organizer_id', body.organizerId)
      .gte('created_at', dateFrom.toISOString())
      .lte('created_at', dateTo.toISOString());
    
    data = events || [];
  } else if (body.dataType === 'revenue') {
    const { data: regs } = await supabase
      .from('organizer_registrations')
      .select(`
        id,
        event:event_id (name),
        payment_status,
        payment_amount,
        registered_at
      `)
      .eq('event.organizer_id', body.organizerId)
      .gte('registered_at', dateFrom.toISOString())
      .lte('registered_at', dateTo.toISOString())
      .not('payment_amount', 'is', null);
    
    data = regs || [];
  }

  // Format output
  let output: string;
  let contentType: string;
  let filename: string;

  if (body.format === 'csv') {
    // Convert to CSV
    if (data.length === 0) {
      output = 'No data available';
    } else {
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map((row: any) => {
        return Object.values(row).map((v: any) => {
          if (v === null || v === undefined) return '';
          if (typeof v === 'object') return JSON.stringify(v);
          const str = String(v);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',');
      });
      output = [headers, ...rows].join('\n');
    }
    contentType = 'text/csv';
    filename = `export-${body.dataType}-${new Date().toISOString().split('T')[0]}.csv`;
  } else {
    output = JSON.stringify(data, null, 2);
    contentType = 'application/json';
    filename = `export-${body.dataType}-${new Date().toISOString().split('T')[0]}.json`;
  }

  return new Response(output, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
