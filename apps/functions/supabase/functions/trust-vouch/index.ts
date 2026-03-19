// Trust Vouch Edge Function
// Create a vouch for another user
// Route: POST /trust-vouch

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface VouchRequest {
  vouchedId: string;
  notes?: string;
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

    const body: VouchRequest = await req.json();
    const { vouchedId, notes } = body;

    if (!vouchedId) {
      return new Response(
        JSON.stringify({ error: 'vouchedId required', code: 'missing_vouched_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (vouchedId === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot vouch for yourself', code: 'self_vouch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already vouched
    const { data: existing } = await supabase
      .from('vouches')
      .select('id, status')
      .eq('voucher_id', user.id)
      .eq('vouched_id', vouchedId)
      .maybeSingle();

    if (existing?.status === 'active') {
      return new Response(
        JSON.stringify({ error: 'Already vouched for this user', code: 'duplicate_vouch' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if can give vouch (max 5)
    const { data: canGive } = await supabase
      .rpc('can_give_vouch', { p_voucher_id: user.id });

    if (!canGive) {
      return new Response(
        JSON.stringify({ error: 'Maximum vouches reached (5)', code: 'vouch_limit' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count shared rounds (must have 3+)
    const { count: sharedRounds, error: countError } = await supabase
      .from('round_participants')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', user.id)
      .eq('status', 'checked_in')
      .in('round_id', (
        supabase
          .from('round_participants')
          .select('round_id')
          .eq('member_id', vouchedId)
          .eq('status', 'checked_in')
      ));

    if (countError) throw countError;

    if ((sharedRounds || 0) < 3) {
      return new Response(
        JSON.stringify({ 
          error: 'Must play 3+ rounds together to vouch', 
          code: 'insufficient_rounds',
          sharedRounds: sharedRounds || 0
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create vouch
    const { data: vouch, error: insertError } = await supabase
      .from('vouches')
      .insert({
        voucher_id: user.id,
        vouched_id: vouchedId,
        round_count_at_vouch: 3,
        shared_rounds_count: sharedRounds,
        status: 'active',
        notes: notes || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create vouch', code: 'insert_failed', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        data: { 
          id: vouch.id,
          vouchedId,
          status: 'active',
          expiresAt: vouch.expires_at
        } 
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Trust vouch error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
