import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient, createServiceClient } from '../_shared/client.ts';

type Payload = {
  userIds?: string[];
};

type FeedbackSummaryRow = {
  user_id: string;
  total_feedback: number;
  thumbs_up_count: number;
  thumbs_down_count: number;
  positive_ratio: number;
  top_tags: string[];
};

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const body = (await req.json().catch(() => ({}))) as Payload;

  const authed = createAuthedClient(authHeader);
  const service = createServiceClient();

  const { data: authData, error: authError } = await authed.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  let userIds = body.userIds?.filter(Boolean) ?? [];
  if (userIds.length === 0) {
    userIds = [user.id];
  }
  if (userIds.length > 30) {
    return badRequest('Cannot request more than 30 users', 'too_many_user_ids');
  }

  const uniqueUserIds = Array.from(new Set(userIds));

  const { data, error } = await service.rpc('get_feedback_summary', {
    p_user_ids: uniqueUserIds
  });

  if (error) {
    return json(500, { error: error.message, code: 'feedback_summary_failed' });
  }

  const rows = ((data as FeedbackSummaryRow[] | null) ?? []).map((row) => ({
    userId: row.user_id,
    totalFeedback: row.total_feedback,
    thumbsUpCount: row.thumbs_up_count,
    thumbsDownCount: row.thumbs_down_count,
    positiveRatio: Number(row.positive_ratio ?? 0),
    topTags: row.top_tags ?? []
  }));

  return json(200, { data: rows });
});
