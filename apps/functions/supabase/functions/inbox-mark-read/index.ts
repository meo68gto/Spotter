import { createAuthedClient } from '../_shared/client.ts';
import { requireLegalConsent } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Payload = {
  threadType?: 'session' | 'engagement';
  threadId?: string;
  lastReadAt?: string;
};

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');
  const body = (await req.json().catch(() => ({}))) as Payload;

  if (!body.threadType || !body.threadId) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();
  const legal = await requireLegalConsent(user.id);
  if (legal) return legal;

  const readAt = body.lastReadAt ? new Date(body.lastReadAt).toISOString() : new Date().toISOString();

  const { data, error } = await supabase
    .from('inbox_thread_reads')
    .upsert(
      {
        user_id: user.id,
        thread_type: body.threadType,
        thread_id: body.threadId,
        last_read_at: readAt,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,thread_type,thread_id' }
    )
    .select('id, user_id, thread_type, thread_id, last_read_at')
    .single();

  if (error) return json(500, { error: error.message, code: 'inbox_mark_read_failed' });
  return json(200, { data });
});
