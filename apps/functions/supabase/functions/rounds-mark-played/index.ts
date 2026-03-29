// GAP 1: Round Lifecycle State Machine - rounds-mark-played Edge Function
// Allows round creator to mark a round as played, transitioning lifecycle_status to 'played'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MarkPlayedRequest {
  roundId: string;
}

interface MarkPlayedResponse {
  id: string;
  lifecycleStatus: string;
  playedAt: string;
  reviewWindowClosesAt: string;
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

    const body: MarkPlayedRequest = await req.json();

    if (!body.roundId) {
      return new Response(
        JSON.stringify({ error: 'round_id is required', code: 'missing_round_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('id, creator_id, lifecycle_status, scheduled_at')
      .eq('id', body.roundId)
      .single();

    if (roundError || !round) {
      return new Response(
        JSON.stringify({ error: 'Round not found', code: 'round_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only creator can mark round as played
    if (round.creator_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the round creator can mark it as played', code: 'not_creator' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate lifecycle_status allows transition to 'played'
    const validTransitions = ['confirmed'];
    if (!validTransitions.includes(round.lifecycle_status)) {
      return new Response(
        JSON.stringify({ 
          error: `Cannot mark round as played from status '${round.lifecycle_status}'. Round must be in 'confirmed' status.`,
          code: 'invalid_transition'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    // Set review window to close 7 days from now
    const reviewWindowClosesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Update round lifecycle_status to 'played'
    const { data: updatedRound, error: updateError } = await supabase
      .from('rounds')
      .update({ 
        lifecycle_status: 'played',
        played_at: now.toISOString(),
        review_window_closes_at: reviewWindowClosesAt
      })
      .eq('id', body.roundId)
      .select('id, lifecycle_status, played_at, review_window_closes_at')
      .single();

    if (updateError || !updatedRound) {
      return new Response(
        JSON.stringify({ error: 'Failed to update round', code: 'update_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response: MarkPlayedResponse = {
      id: updatedRound.id,
      lifecycleStatus: updatedRound.lifecycle_status,
      playedAt: updatedRound.played_at,
      reviewWindowClosesAt: updatedRound.review_window_closes_at
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rounds mark played error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
