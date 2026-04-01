/**
 * Eagle AI Coach — Spotter Supabase Edge Function
 *
 * Bridges Spotter mobile app → Eagle AI MCP tools for drill generation,
 * outcome tracking, and coaching analytics.
 *
 * Tools exposed:
 *   POST /eagle-ai-coach  { action: "generate_drill", problem, playerLevel }
 *   POST /eagle-ai-coach  { action: "track_outcome", drillId, completed, improvement, feedback }
 *   POST /eagle-ai-coach  { action: "get_user_drills", limit }
 *   POST /eagle-ai-coach  { action: "get_user_outcomes", limit }
 *   POST /eagle-ai-coach  { action: "get_drill", drillId }
 *   POST /eagle-ai-coach  { action: "get_analytics" }
 *
 * MCP Server URL: configured via DENO_PRIVATE_EAGLE_MCP_URL env var
 * Default: local Unix socket for MCP-over-stdio bridge
 */

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MCP_SERVER_URL = Deno.env.get('DENO_PRIVATE_EAGLE_MCP_URL') ?? 'http://localhost:18789/eagle-ai';

// ---------------------------------------------------------------------------
// MCP stdio bridge — spawns the MCP process and sends JSON-RPC requests
// ---------------------------------------------------------------------------

/**
 * Call a tool on the Eagle AI MCP server via stdio bridge.
 * Falls back to direct Supabase REST calls when MCP is unavailable.
 */
async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs = 60000
): Promise<unknown> {
  const mcpUrl = MCP_SERVER_URL;

  try {
    // Try MCP HTTP bridge endpoint first (if configured)
    if (!mcpUrl.includes('localhost') && !mcpUrl.includes('127.0.0.1')) {
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: crypto.randomUUID(),
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) {
        const data = await response.json() as { result?: unknown; error?: { message: string } };
        if (data.error) throw new Error(data.error.message);
        return data.result;
      }
    }

    // Fallback: direct Supabase REST (when MCP stdio bridge is not available in edge)
    // The MCP tools ultimately read/write to Supabase, so we can call them directly here
    return await callSupabaseDirect(toolName, args);
  } catch (err) {
    console.error(`[eagle-ai-coach] MCP call failed: ${err}`);
    // Return graceful degradation — don't crash the app
    return { error: `Eagle AI unavailable: ${err instanceof Error ? err.message : String(err)}`, _degraded: true };
  }
}

// ---------------------------------------------------------------------------
// Direct Supabase fallback (edge runtime compatible)
// ---------------------------------------------------------------------------

function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function callSupabaseDirect(
  action: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const supabase = createServiceClient();

  switch (action) {
    case 'get_user_drills': {
      const userId = args['userId'] as string;
      const limit = (args['limit'] as number) ?? 20;

      // Get distinct drill IDs from user's outcomes
      const { data: outcomes } = await supabase
        .from('eagle_ai_outcomes')
        .select('drill_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!outcomes || outcomes.length === 0) return { drills: [], count: 0 };

      const drillIds = [...new Set(outcomes.map((o: any) => o.drill_id))];
      const { data: drills } = await supabase
        .from('eagle_ai_drills')
        .select('*')
        .in('id', drillIds.slice(0, 20))
        .order('created_at', { ascending: false });

      return { drills: drills ?? [], count: drills?.length ?? 0 };
    }

    case 'get_user_outcomes': {
      const userId = args['userId'] as string;
      const limit = (args['limit'] as number) ?? 50;

      const { data: outcomes } = await supabase
        .from('eagle_ai_outcomes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return { outcomes: outcomes ?? [], count: outcomes?.length ?? 0 };
    }

    case 'get_drill': {
      const drillId = args['drillId'] as string;
      const { data: drill } = await supabase
        .from('eagle_ai_drills')
        .select('*')
        .eq('id', drillId)
        .single();

      return { drill };
    }

    case 'track_outcome': {
      const drillId = args['drillId'] as string;
      const userId = args['userId'] as string;
      const completed = args['completed'] as boolean;
      const improvement = args['improvement'] as number | undefined;
      const feedback = args['feedback'] as string | undefined;

      // Determine userId: use the auth user if not provided
      const effectiveUserId = userId || 'anonymous';

      const { data: outcome, error } = await supabase
        .from('eagle_ai_outcomes')
        .insert({
          drill_id: drillId,
          user_id: effectiveUserId,
          completed,
          improvement_score: improvement,
          feedback,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return { success: true, outcomeId: outcome.id };
    }

    case 'generate_drill': {
      // Cannot generate drills directly in edge runtime — Ollama not accessible
      // Return a helpful error message
      return {
        error: 'Drill generation requires the Eagle AI MCP server. Please use the Spotter app with an active MCP connection.',
        _degraded: true,
      };
    }

    case 'get_analytics': {
      const userId = args['userId'] as string;

      // Count drills per problem type
      const { data: drillOutcomes } = await supabase
        .from('eagle_ai_outcomes')
        .select('drill_id')
        .eq('user_id', userId);

      if (!drillOutcomes || drillOutcomes.length === 0) {
        return { problemStats: [], totalDrills: 0, avgImprovement: null };
      }

      const drillIds = [...new Set(drillOutcomes.map((o: any) => o.drill_id))];
      const { data: drills } = await supabase
        .from('eagle_ai_drills')
        .select('id, input_problem, confidence_score')
        .in('id', drillIds)
        .eq('overall_pass', true);

      // Compute avg improvement per problem
      const { data: outcomes } = await supabase
        .from('eagle_ai_outcomes')
        .select('drill_id, improvement_score, completed')
        .in('drill_id', drillIds)
        .eq('user_id', userId);

      // Group by problem
      const problemMap: Record<string, { total: number; improvements: number[]; completions: number }> = {};
      for (const drill of drills ?? []) {
        const problem = drill.input_problem ?? 'unknown';
        if (!problemMap[problem]) problemMap[problem] = { total: 0, improvements: [], completions: 0 };
        problemMap[problem].total++;
      }

      for (const outcome of outcomes ?? []) {
        const drill = drills?.find((d: any) => d.id === outcome.drill_id);
        if (!drill) continue;
        const problem = drill.input_problem ?? 'unknown';
        if (outcome.improvement_score !== null) {
          problemMap[problem].improvements.push(outcome.improvement_score);
        }
        if (outcome.completed) problemMap[problem].completions++;
      }

      const problemStats = Object.entries(problemMap).map(([problem, stats]) => ({
        problem,
        drillCount: stats.total,
        avgImprovement: stats.improvements.length > 0
          ? stats.improvements.reduce((a, b) => a + b, 0) / stats.improvements.length
          : null,
        completionRate: stats.total > 0 ? stats.completions / stats.total : 0,
      }));

      const allImprovements = outcomes?.map((o: any) => o.improvement_score).filter((s: any) => s !== null) ?? [];
      const avgImprovement = allImprovements.length > 0
        ? allImprovements.reduce((a: number, b: number) => a + b, 0) / allImprovements.length
        : null;

      return {
        problemStats: problemStats.sort((a: any, b: any) => b.drillCount - a.drillCount),
        totalDrills: drillIds.length,
        avgImprovement,
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth: verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as { action: string; [key: string]: unknown };
    const { action, ...args } = body;

    // Inject authenticated userId into args
    const enrichedArgs = { ...args, userId: user.id };

    const result = await callMcpTool(action, enrichedArgs as Record<string, unknown>);

    // If degraded, include a flag so the mobile app can show a degraded-state UI
    const degraded = (result as any)?._degraded === true;

    return new Response(
      JSON.stringify({ success: true, data: result, degraded }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[eagle-ai-coach] Error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
