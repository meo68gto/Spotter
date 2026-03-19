// Trust Vouch Remove Edge Function
// Revoke a vouch you previously gave
// Route: POST /trust-vouch-remove

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface VouchRemoveRequest {
  vouchId: string;
  reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'method_not_allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'missing_auth' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const body: VouchRemoveRequest = await req.json();
    const { vouchId, reason } = body;

    if (!vouchId) {
      return new Response(
        JSON.stringify({ error: 'vouchId required', code: 'missing_vouch_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is the voucher
    const { data: vouch, error: fetchError } = await supabase
      .from('vouches')
      .select('id, voucher_id, status')
      .eq('id', vouchId)
      .single();

    if (fetchError || !vouch) {
      return new Response(
        JSON.stringify({ error: 'Vouch not found', code: 'not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (vouch.voucher_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the voucher can revoke', code: 'unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (vouch.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Vouch is not active', code: 'not_active' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Revoke the vouch
    const { data: updated, error: updateError } = await supabase
      .from('vouches')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: reason || 'User revoked'
      })
      .eq('id', vouchId)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to revoke vouch', code: 'update_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        data: { 
          id: updated.id,
          status: 'revoked',
          revokedAt: updated.revoked_at
        } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Trust vouch remove error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
