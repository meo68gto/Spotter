// Admin Jobs Management Edge Function
// Handles viewing job status, logs, and manual job triggers

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string;
  lastRun: string | null;
  lastStatus: 'success' | 'failed' | 'running' | null;
  nextRun: string | null;
  enabled: boolean;
}

interface JobRun {
  id: string;
  jobId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'failed';
  output: string | null;
  error: string | null;
  triggeredBy: 'schedule' | 'manual';
}

const JOB_DEFINITIONS: JobDefinition[] = [
  {
    id: 'billing-daily',
    name: 'Daily Billing',
    description: 'Process daily billing calculations and invoice generation',
    schedule: '0 2 * * *',
    lastRun: null,
    lastStatus: null,
    nextRun: null,
    enabled: true,
  },
  {
    id: 'reconciliation-hourly',
    name: 'Hourly Reconciliation',
    description: 'Reconcile payment transactions and balances',
    schedule: '0 * * * *',
    lastRun: null,
    lastStatus: null,
    nextRun: null,
    enabled: true,
  },
  {
    id: 'expiration-check',
    name: 'Expiration Checker',
    description: 'Check and process expired matches, sessions, and pending requests',
    schedule: '0 */6 * * *',
    lastRun: null,
    lastStatus: null,
    nextRun: null,
    enabled: true,
  },
  {
    id: 'trust-badge-award',
    name: 'Trust Badge Award',
    description: 'Calculate and award trust badges based on user activity',
    schedule: '0 3 * * *',
    lastRun: null,
    lastStatus: null,
    nextRun: null,
    enabled: true,
  },
  {
    id: 'reliability-calc',
    name: 'Reliability Calculator',
    description: 'Calculate user reliability scores from session completion data',
    schedule: '0 4 * * *',
    lastRun: null,
    lastStatus: null,
    nextRun: null,
    enabled: true,
  },
];

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
        if (path === 'jobs') {
          return handleGetJobs(supabaseClient, adminUserId);
        } else if (path === 'logs') {
          return handleGetJobLogs(supabaseClient, adminUserId, url);
        }
        return handleGetJobs(supabaseClient, adminUserId);

      case 'POST':
        const body = await req.json();
        const { action, jobId } = body;

        if (action === 'trigger' && jobId) {
          return handleTriggerJob(supabaseClient, adminUserId, jobId);
        }
        return new Response(
          JSON.stringify({ error: 'Invalid action', code: 'INVALID_ACTION' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Admin jobs error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleGetJobs(supabase: ReturnType<typeof createClient>, adminUserId: string) {
  // Fetch job run history from admin_job_runs table
  const { data: jobRuns } = await supabase
    .from('admin_job_runs')
    .select('*')
    .order('started_at', { ascending: false });

  // Build job status from definitions and run history
  const jobsWithStatus = JOB_DEFINITIONS.map((job) => {
    const runs = jobRuns?.filter((r) => r.job_id === job.id) ?? [];
    const lastRun = runs[0];

    return {
      ...job,
      lastRun: lastRun?.started_at ?? null,
      lastStatus: lastRun?.status ?? null,
      nextRun: calculateNextRun(job.schedule),
      runCount: runs.length,
    };
  });

  await logAdminAction(supabase, adminUserId, 'ADMIN_JOBS_VIEW', 'SUCCESS');

  return new Response(
    JSON.stringify({ success: true, data: jobsWithStatus }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGetJobLogs(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  url: URL
) {
  const jobId = url.searchParams.get('jobId');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('admin_job_runs')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (jobId) {
    query = query.eq('job_id', jobId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Job logs error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch job logs', code: 'FETCH_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await logAdminAction(supabase, adminUserId, 'ADMIN_JOB_LOGS_VIEW', 'SUCCESS', { jobId });

  return new Response(
    JSON.stringify({
      success: true,
      data: data ?? [],
      pagination: { total: count ?? 0, limit, offset },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleTriggerJob(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  jobId: string
) {
  const job = JOB_DEFINITIONS.find((j) => j.id === jobId);
  if (!job) {
    return new Response(
      JSON.stringify({ error: 'Job not found', code: 'JOB_NOT_FOUND' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create job run record
  const { data: runRecord, error: insertError } = await supabase
    .from('admin_job_runs')
    .insert({
      job_id: jobId,
      status: 'running',
      triggered_by: 'manual',
      triggered_by_user_id: adminUserId,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    await logAdminAction(supabase, adminUserId, 'ADMIN_JOB_TRIGGER', 'FAILED', { jobId, error: insertError.message });
    return new Response(
      JSON.stringify({ error: 'Failed to start job', code: 'START_FAILED' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Trigger the actual job function based on jobId
  try {
    const functionName = getJobFunctionName(jobId);
    if (functionName) {
      // Invoke the corresponding edge function
      const { error: invokeError } = await supabase.functions.invoke(functionName, {
        body: { triggeredBy: 'manual', runId: runRecord.id },
      });

      if (invokeError) throw invokeError;

      // Update run record as successful
      await supabase
        .from('admin_job_runs')
        .update({ status: 'success', completed_at: new Date().toISOString() })
        .eq('id', runRecord.id);
    }

    await logAdminAction(supabase, adminUserId, 'ADMIN_JOB_TRIGGER', 'SUCCESS', { jobId, runId: runRecord.id });

    return new Response(
      JSON.stringify({ success: true, message: 'Job triggered', runId: runRecord.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Update run record as failed
    await supabase
      .from('admin_job_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', runRecord.id);

    await logAdminAction(supabase, adminUserId, 'ADMIN_JOB_TRIGGER', 'FAILED', { jobId, error: error instanceof Error ? error.message : 'Unknown error' });

    return new Response(
      JSON.stringify({ error: 'Job execution failed', code: 'EXECUTION_FAILED' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

function getJobFunctionName(jobId: string): string | null {
  const mapping: Record<string, string> = {
    'billing-daily': 'billing-daily',
    'reconciliation-hourly': 'reconciliation-hourly',
    'expiration-check': 'expiration-check',
    'trust-badge-award': 'award-trust-badges',
    'reliability-calc': 'calculate-reliability',
  };
  return mapping[jobId] ?? null;
}

function calculateNextRun(schedule: string): string {
  // Simple cron parser - in production, use a proper cron library
  const now = new Date();
  const parts = schedule.split(' ');

  if (parts.length === 5) {
    const [minute, hour] = parts;
    const nextRun = new Date(now);
    nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun.toISOString();
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
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