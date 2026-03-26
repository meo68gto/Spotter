// Epic 5: Round Rating Aggregate Edge Function
// Calculates rating aggregates for users and rounds

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RatingAggregate {
  userId: string;
  totalRoundsRated: number;
  avgPunctuality: number;
  avgGolfEtiquette: number;
  avgEnjoyment: number;
  avgBusinessValue?: number;
  playAgainPercentage: number;
  wouldIntroducePercentage: number;
}

interface RoundRatingsResponse {
  roundId: string;
  ratings: Array<{
    raterId: string;
    raterName: string;
    punctuality: number;
    golfEtiquette: number;
    enjoyment: number;
    playAgain: boolean;
    publicCompliment?: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    const roundId = url.searchParams.get('round_id');

    // If user_id provided, get user's aggregate ratings
    if (userId) {
      const { data: aggregates, error } = await supabase.rpc('get_user_rating_aggregates', {
        p_user_id: userId
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to get rating aggregates', code: 'query_failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ data: aggregates }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If round_id provided, get round's ratings (only for participants)
    if (roundId) {
      // Verify user is a participant in this round
      const { data: participant, error: participantError } = await supabase
        .from('round_participants_v2')
        .select('round_id')
        .eq('round_id', roundId)
        .eq('user_id', user.id)
        .single();

      if (participantError || !participant) {
        return new Response(
          JSON.stringify({ error: 'Only round participants can view ratings', code: 'not_participant' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get round ratings with rater info (only ratings for the requesting user)
      const { data: ratings, error: ratingsError } = await supabase
        .from('round_ratings')
        .select(`
          rater_id,
          punctuality,
          golf_etiquette,
          enjoyment,
          play_again,
          public_compliment,
          rater:users!round_ratings_rater_id_fkey(display_name)
        `)
        .eq('round_id', roundId)
        .eq('ratee_id', user.id);

      if (ratingsError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch ratings', code: 'fetch_failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response: RoundRatingsResponse = {
        roundId,
        ratings: (ratings || []).map((r: any) => ({
          raterId: r.rater_id,
          raterName: r.rater?.display_name || 'Anonymous',
          punctuality: r.punctuality,
          golfEtiquette: r.golf_etiquette,
          enjoyment: r.enjoyment,
          playAgain: r.play_again,
          publicCompliment: r.public_compliment || undefined
        }))
      };

      return new Response(
        JSON.stringify({ data: response }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'user_id or round_id parameter required', code: 'missing_param' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
