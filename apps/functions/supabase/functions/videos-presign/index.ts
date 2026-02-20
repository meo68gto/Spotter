import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient, createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { flags } from '../_shared/flags.ts';

Deno.serve(async (req) => {
  if (!flags.videoPipeline) {
    return json(503, { error: 'Video pipeline is disabled', code: 'feature_disabled' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const { activityId, fileExt = 'mp4', sessionId } = (await req.json()) as {
    activityId?: string;
    fileExt?: string;
    sessionId?: string;
  };

  if (!activityId) return badRequest('Missing activityId', 'missing_activity_id');

  const authed = createAuthedClient(authHeader);
  const service = createServiceClient();
  const env = getRuntimeEnv();

  const { data: authData, error: authError } = await authed.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const safeExt = fileExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp4';
  const objectPath = `${user.id}/${crypto.randomUUID()}.${safeExt}`;

  const signed = await service.storage.from(env.bucketRaw).createSignedUploadUrl(objectPath);
  if (signed.error || !signed.data) {
    return json(500, { error: signed.error?.message ?? 'Unable to create signed upload URL', code: 'presign_failed' });
  }

  const { data, error } = await service
    .from('video_submissions')
    .insert({
      user_id: user.id,
      activity_id: activityId,
      session_id: sessionId ?? null,
      storage_path: objectPath,
      status: 'uploaded',
      upload_url: signed.data.signedUrl,
      upload_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    })
    .select('id, storage_path, status, upload_url, upload_expires_at')
    .single();

  if (error) return json(500, { error: error.message, code: 'video_submission_create_failed' });

  return json(200, {
    data: {
      ...data,
      token: signed.data.token,
      path: objectPath
    }
  });
});
