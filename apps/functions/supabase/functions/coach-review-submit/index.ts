import { createServiceClient } from '../_shared/client.ts';
import { transitionEngagementStatus } from '../_shared/coach-commerce.ts';
import { ensureCoachForUser } from '../_shared/engagements.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Payload = {
  engagementRequestId?: string;
  summaryText?: string;
  responseText?: string;
  transcript?: string;
  responseVideoUrl?: string;
  responseAudioUrl?: string;
  structuredFeedback?: Record<string, unknown>;
  attachments?: Array<Record<string, unknown>>;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId || !body.summaryText?.trim()) return badRequest('Missing required fields', 'missing_required_fields');

  const coach = await ensureCoachForUser(auth.user.id);
  if (!coach) return unauthorized('Only coaches can submit reviews', 'coach_required');

  const service = createServiceClient();
  const { data: engagement } = await service
    .from('engagement_requests')
    .select('id, coach_id, review_order_id')
    .eq('id', body.engagementRequestId)
    .eq('coach_id', coach.id)
    .single();

  if (!engagement) return badRequest('Engagement request not found', 'engagement_not_found');

  const { data, error } = await service
    .from('engagement_responses')
    .upsert(
      {
        engagement_request_id: engagement.id,
        coach_id: coach.id,
        response_kind: body.responseVideoUrl ? 'video_feedback' : body.responseAudioUrl ? 'audio_feedback' : 'written_feedback',
        summary_text: body.summaryText.trim(),
        response_text: body.responseText ?? null,
        transcript: body.transcript ?? null,
        video_url: body.responseVideoUrl ?? null,
        audio_url: body.responseAudioUrl ?? null,
        structured_feedback: body.structuredFeedback ?? {},
        attachments: body.attachments ?? [],
        delivered_at: new Date().toISOString(),
        submitted_at: new Date().toISOString()
      },
      { onConflict: 'engagement_request_id' }
    )
    .select('*')
    .single();

  if (error || !data) return json(500, { error: error?.message ?? 'Coach review submit failed', code: 'coach_review_submit_failed' });

  await transitionEngagementStatus({
    engagementRequestId: engagement.id,
    toStatus: 'delivered',
    actorUserId: auth.user.id,
    payload: { eventType: 'feedback_delivered' },
    extraFields: { delivered_at: new Date().toISOString(), completed_at: new Date().toISOString(), closed_reason: 'feedback_delivered' }
  });

  if (engagement.review_order_id) {
    await service.from('review_orders').update({ payout_status: 'eligible' }).eq('id', engagement.review_order_id);
  }

  return json(200, { data });
});
