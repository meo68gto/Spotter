import { json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient, createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { resolveBooleanFlag } from '../_shared/flags-db.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const authed = createAuthedClient(authHeader);
  const service = createServiceClient();
  const env = getRuntimeEnv();

  const { data: authData, error: authError } = await authed.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const [matchingV2, videoPipeline] = await Promise.all([
    resolveBooleanFlag(service, 'matching_v2', false),
    resolveBooleanFlag(service, 'video_pipeline', true)
  ]);

  return json(200, {
    data: {
      matchingV2,
      videoPipeline,
      environment: env.flagEnvironment
    }
  });
});
