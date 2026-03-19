// Epic 5: Round Rating Submission Edge Function
// Handles post-round player ratings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RatingInput {
  rateeId: string;
  punctuality: number;
  golfEtiquette: number;
  enjoyment: number;
  businessValue?: number;
  playAgain: boolean;
  wouldIntroduce: boolean;
  privateNote?: string;
  publicCompliment?: string;
}

interface RateRoundRequest {
  roundId: string;
  ratings: RatingInput[];
}

interface RateRoundResponse {
  submittedCount: number;
  roundStatus: string;
  reviewComplete: boolean;
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

    const body: RateRoundRequest = await req.json();

    // Validation
    if (!body.roundId) {
      return new Response(
        JSON.stringify({ error: 'roundId is required', code: 'missing_round_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.ratings || body.ratings.length === 0) {
      return new Response(
        JSON.stringify({ error: 'ratings array is required', code: 'missing_ratings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('id, lifecycle_status, review_window_closes_at')
      .eq('id', body.roundId)
      .single();

    if (roundError || !round) {
      return new Response(
        JSON.stringify({ error: 'Round not found', code: 'round_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if rating window is open
    if (!['played', 'review_pending'].includes(round.lifecycle_status)) {
      return new Response(
        JSON.stringify({ 
          error: `Cannot rate round in ${round.lifecycle_status} status`, 
          code: 'invalid_round_status' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if review window has closed
    if (round.review_window_closes_at && new Date(round.review_window_closes_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Rating window has closed', code: 'review_window_closed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user was a participant
    const { data: participant, error: participantError } = await supabase
      .from('round_participants_v2')
      .select('round_id')
      .eq('round_id', body.roundId)
      .eq('user_id', user.id)
      .single();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({ error: 'You must be a round participant to submit ratings', code: 'not_participant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all participants to validate ratee_ids
    const { data: participants } = await supabase
      .from('round_participants_v2')
      .select('user_id')
      .eq('round_id', body.roundId);

    const participantIds = new Set(participants?.map(p => p.user_id) || []);

    // Validate ratings
    for (const rating of body.ratings) {
      // Cannot rate self
      if (rating.rateeId === user.id) {
        return new Response(
          JSON.stringify({ error: 'Cannot rate yourself', code: 'cannot_rate_self', details: { rateeId: rating.rateeId } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Ratee must be a participant
      if (!participantIds.has(rating.rateeId)) {
        return new Response(
          JSON.stringify({ error: 'Ratee was not a participant', code: 'invalid_ratee', details: { rateeId: rating.rateeId } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate ratings are 1-5
      if (rating.punctuality < 1 || rating.punctuality > 5 ||
          rating.golfEtiquette < 1 || rating.golfEtiquette > 5 ||
          rating.enjoyment < 1 || rating.enjoyment > 5) {
        return new Response(
          JSON.stringify({ error: 'Ratings must be between 1 and 5', code: 'invalid_rating_value' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (rating.businessValue !== undefined && (rating.businessValue < 1 || rating.businessValue > 5)) {
        return new Response(
          JSON.stringify({ error: 'Business value rating must be between 1 and 5', code: 'invalid_business_value' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for existing ratings to avoid duplicates
    const { data: existingRatings } = await supabase
      .from('round_ratings')
      .select('ratee_id')
      .eq('round_id', body.roundId)
      .eq('rater_id', user.id);

    const existingRateeIds = new Set(existingRatings?.map(r => r.ratee_id) || []);

    // Filter out already-rated players
    const newRatings = body.ratings.filter(r => !existingRateeIds.has(r.rateeId));

    if (newRatings.length === 0) {
      return new Response(
        JSON.stringify({ error: 'You have already rated all players', code: 'already_rated' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert ratings
    const ratingsToInsert = newRatings.map(rating => ({
      round_id: body.roundId,
      rater_id: user.id,
      ratee_id: rating.rateeId,
      punctuality: rating.punctuality,
      golf_etiquette: rating.golfEtiquette,
      enjoyment: rating.enjoyment,
      business_value: rating.businessValue ?? null,
      play_again: rating.playAgain,
      would_introduce: rating.wouldIntroduce,
      private_note: rating.privateNote?.substring(0, 500) ?? null,
      public_compliment: rating.publicCompliment?.substring(0, 280) ?? null
    }));

    const { error: insertError } = await supabase
      .from('round_ratings')
      .insert(ratingsToInsert);

    if (insertError) {
      console.error('Error inserting ratings:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit ratings', code: 'insert_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update round lifecycle_status if needed
    // The trigger will handle the full check, but we can trigger it by touching the round
    const { data: updatedRound } = await supabase
      .from('rounds')
      .select('lifecycle_status')
      .eq('id', body.roundId)
      .single();

    const response: RateRoundResponse = {
      submittedCount: ratingsToInsert.length,
      roundStatus: updatedRound?.lifecycle_status || round.lifecycle_status,
      reviewComplete: updatedRound?.lifecycle_status === 'reviewed'
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rounds rate error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
