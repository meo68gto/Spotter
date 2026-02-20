import { createServiceClient } from '../_shared/client.ts';
import { billableMinutesFromSeconds } from '../_shared/engagement-utils.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { json, unauthorized } from '../_shared/http.ts';

type DailyPayload = {
  event?: string;
  payload?: {
    room_name?: string;
    room?: string;
    duration?: number;
    ended_at?: string;
  };
};

Deno.serve(async (req) => {
  const env = getRuntimeEnv();
  const signature = req.headers.get('x-daily-signature') ?? req.headers.get('authorization');
  if (env.dailyWebhookSecret && signature !== env.dailyWebhookSecret) {
    return unauthorized('Invalid Daily webhook signature', 'invalid_daily_webhook_signature');
  }

  const body = (await req.json().catch(() => ({}))) as DailyPayload;
  const event = body.event ?? '';
  const roomName = body.payload?.room_name ?? body.payload?.room;
  if (!roomName) return json(400, { error: 'Missing room identifier', code: 'missing_room_name' });

  if (!event.includes('ended') && !event.includes('left') && !event.includes('complete')) {
    return json(200, { data: { ignored: true } });
  }

  const service = createServiceClient();
  const durationSeconds = Math.max(0, Math.floor(body.payload?.duration ?? 0));
  const endedAt = body.payload?.ended_at ?? new Date().toISOString();

  const { data: callSession, error } = await service
    .from('video_call_sessions')
    .select('id, engagement_request_id, started_at')
    .eq('daily_room_name', roomName)
    .maybeSingle();

  if (error || !callSession) {
    return json(200, { data: { ignored: true, reason: 'call_session_not_found' } });
  }

  const resolvedDuration =
    durationSeconds > 0
      ? durationSeconds
      : Math.max(0, Math.floor((new Date(endedAt).getTime() - new Date(callSession.started_at ?? endedAt).getTime()) / 1000));

  const billableMinutes = billableMinutesFromSeconds(resolvedDuration);

  await service
    .from('video_call_sessions')
    .update({ ended_at: endedAt, duration_seconds: resolvedDuration, billable_minutes: billableMinutes })
    .eq('id', callSession.id);

  return json(200, { data: { reconciled: true, callSessionId: callSession.id, durationSeconds: resolvedDuration, billableMinutes } });
});
