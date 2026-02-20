import { createServiceClient } from '../_shared/client.ts';
import { json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const service = createServiceClient();
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '20'), 1), 50);

  const { data, error } = await service
    .from('home_feed_items')
    .select(`
      id,
      score,
      published_at,
      metadata,
      engagement_requests (
        id,
        question_text,
        engagement_mode,
        moderation_status,
        public_opt_in,
        completed_at,
        coach_id,
        engagement_responses (
          response_text,
          audio_url,
          video_url,
          transcript,
          submitted_at
        )
      )
    `)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) return json(500, { error: error.message, code: 'feed_home_failed' });

  return json(200, { data });
});
