// Organizer API Keys Edge Function
// Gold tier only - manages API keys for external integrations

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

interface CreateKeyRequest {
  organizerId: string;
  name: string;
  permissions?: string[];
  expiresAt?: string;
}

interface RevokeKeyRequest {
  organizerId: string;
  keyId: string;
}

// Generate a secure API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'sk_live_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function hashApiKey(key: string): string {
  // Simple hash for storage - in production use proper hashing
  return btoa(key).slice(0, 64);
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

    if (lastPath === 'keys' && method === 'GET') {
      return await handleListKeys(url, supabase, user.id);
    } else if (lastPath === 'create' && method === 'POST') {
      return await handleCreateKey(req, supabase, user.id);
    } else if (lastPath === 'revoke' && method === 'POST') {
      return await handleRevokeKey(req, supabase, user.id);
    } else if (lastPath === 'usage' && method === 'GET') {
      return await handleGetUsage(url, supabase, user.id);
    }

    return new Response(
      JSON.stringify({ error: 'Not found', code: 'not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Organizer API error:', error);
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

async function checkGoldTier(organizer: any): Promise<boolean> {
  const tier = (organizer?.tier as TierSlug) || TIER_SLUGS.FREE;
  return tier === TIER_SLUGS.SUMMIT;
}

async function handleListKeys(url: URL, supabase: any, userId: string): Promise<Response> {
  const organizerId = url.searchParams.get('organizerId');

  if (!organizerId) {
    return new Response(
      JSON.stringify({ error: 'organizerId is required', code: 'missing_organizer_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed, organizer } = await checkOrganizerPermission(supabase, userId, organizerId, 'admin');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Gold tier check
  const isGold = await checkGoldTier(organizer);
  if (!isGold) {
    return new Response(
      JSON.stringify({ error: 'API keys require Gold tier', code: 'tier_insufficient' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: keys, error } = await supabase
    .from('organizer_api_keys')
    .select('id, name, permissions, created_at, last_used_at, expires_at, is_revoked')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch API keys', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ data: keys }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCreateKey(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: CreateKeyRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.organizerId || !body.name) {
    return new Response(
      JSON.stringify({ error: 'organizerId and name are required', code: 'missing_fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed, organizer } = await checkOrganizerPermission(supabase, userId, body.organizerId, 'admin');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Gold tier check
  const isGold = await checkGoldTier(organizer);
  if (!isGold) {
    return new Response(
      JSON.stringify({ error: 'API keys require Gold tier', code: 'tier_insufficient' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate API key
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);

  // Create key record
  const { data: keyRecord, error } = await supabase
    .from('organizer_api_keys')
    .insert({
      organizer_id: body.organizerId,
      name: body.name,
      key_hash: keyHash,
      permissions: body.permissions || ['read:events', 'read:registrations'],
      created_by: userId,
      expires_at: body.expiresAt || null
    })
    .select('id, name, permissions, created_at, expires_at')
    .single();

  if (error || !keyRecord) {
    console.error('Error creating API key:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create API key', code: 'create_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      data: {
        ...keyRecord,
        key: apiKey // Only returned once on creation
      }
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRevokeKey(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: RevokeKeyRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.organizerId || !body.keyId) {
    return new Response(
      JSON.stringify({ error: 'organizerId and keyId are required', code: 'missing_fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, body.organizerId, 'admin');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get key
  const { data: key, error: keyError } = await supabase
    .from('organizer_api_keys')
    .select('id, organizer_id, is_revoked')
    .eq('id', body.keyId)
    .single();

  if (keyError || !key) {
    return new Response(
      JSON.stringify({ error: 'API key not found', code: 'key_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (key.organizer_id !== body.organizerId) {
    return new Response(
      JSON.stringify({ error: 'Key does not belong to this organizer', code: 'key_mismatch' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (key.is_revoked) {
    return new Response(
      JSON.stringify({ error: 'Key is already revoked', code: 'already_revoked' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Revoke key
  const { data: updated, error } = await supabase
    .from('organizer_api_keys')
    .update({
      is_revoked: true,
      revoked_at: new Date().toISOString(),
      revoked_by: userId,
      updated_at: new Date().toISOString()
    })
    .eq('id', body.keyId)
    .select()
    .single();

  if (error || !updated) {
    return new Response(
      JSON.stringify({ error: 'Failed to revoke key', code: 'revoke_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGetUsage(url: URL, supabase: any, userId: string): Promise<Response> {
  const organizerId = url.searchParams.get('organizerId');
  const range = url.searchParams.get('range') || '30d';

  if (!organizerId) {
    return new Response(
      JSON.stringify({ error: 'organizerId is required', code: 'missing_organizer_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed, organizer } = await checkOrganizerPermission(supabase, userId, organizerId, 'admin');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Gold tier check
  const isGold = await checkGoldTier(organizer);
  if (!isGold) {
    return new Response(
      JSON.stringify({ error: 'API usage requires Gold tier', code: 'tier_insufficient' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const days = parseInt(range) || 30;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  // Get API usage stats
  const { data: usage, error } = await supabase
    .from('organizer_api_usage')
    .select('key_id, endpoint, method, status_code, created_at')
    .eq('organizer_id', organizerId)
    .gte('created_at', fromDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch usage', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Aggregate stats
  const totalCalls = usage?.length || 0;
  const successCalls = usage?.filter((u: any) => u.status_code >= 200 && u.status_code < 300).length || 0;
  const errorCalls = usage?.filter((u: any) => u.status_code >= 400).length || 0;

  const endpointStats: Record<string, number> = {};
  usage?.forEach((u: any) => {
    const key = `${u.method} ${u.endpoint}`;
    endpointStats[key] = (endpointStats[key] || 0) + 1;
  });

  const dailyUsage: Record<string, number> = {};
  usage?.forEach((u: any) => {
    const date = u.created_at.split('T')[0];
    dailyUsage[date] = (dailyUsage[date] || 0) + 1;
  });

  const timeSeries = Object.entries(dailyUsage)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const response = {
    summary: {
      totalCalls,
      successCalls,
      errorCalls,
      successRate: totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0
    },
    endpoints: endpointStats,
    timeSeries
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
