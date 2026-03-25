import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { errorResponse, successResponse } from '../_shared/http.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing Authorization header', 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the caller is an authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const url = new URL(req.url);
    const coachId = url.searchParams.get('coachId');

    if (!coachId) {
      return errorResponse('coachId query parameter is required', 400);
    }

    // Verify the coach belongs to the authenticated user
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, user_id')
      .eq('id', coachId)
      .maybeSingle();

    if (coachError) {
      return errorResponse('Failed to verify coach', 500);
    }

    if (!coach) {
      return errorResponse('Coach not found', 404);
    }

    // Security: only allow coaches that belong to the calling user
    if (coach.user_id !== user.id) {
      return errorResponse('Forbidden: coach does not belong to you', 403);
    }

    // Fetch pending engagement requests through the API layer (respects RLS)
    const { data, error } = await supabase
      .from('engagement_requests')
      .select('id, question_text, status, created_at')
      .eq('coach_id', coachId)
      .in('status', ['awaiting_expert', 'created'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return errorResponse('Failed to fetch pending requests', 500);
    }

    return successResponse(data ?? []);
  } catch (err) {
    console.error('[coaches-pending-requests] Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
