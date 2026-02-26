// supabase/functions/admin-process-deletion/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireAdminHmac, HttpError } from '../_shared/guard.ts';
import { createLogger } from '../_shared/telemetry.ts';
import { handleCors, ok, error, forbidden } from '../_shared/http.ts';
import { getEnv } from '../_shared/env.ts';

interface DeletionRequest {
  userId: string;
  reason?: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const log = createLogger('admin-process-deletion', requestId);

  // Verify admin HMAC signature before processing any request.
  // This prevents unauthorized callers from triggering irreversible user deletions.
  try {
    await requireAdminHmac(req);
  } catch (err) {
    log.warn('admin_hmac_verification_failed', { error: String(err) });
    return forbidden(err instanceof Error ? err.message : 'Unauthorized');
  }

  let body: DeletionRequest;
  try {
    body = await req.json() as DeletionRequest;
  } catch {
    return error('Invalid JSON body', 400, 'invalid_body');
  }

  const { userId, reason } = body;
  if (!userId) {
    return error('userId is required', 400, 'missing_user_id');
  }

  log.info('deletion_started', { userId, reason });

  const env = getEnv();
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false },
  });

  const errors: string[] = [];

  // Step 1: Cancel any active payment intents
  try {
    const { data: intents } = await supabase
      .from('payment_intents')
      .select('stripe_payment_intent_id, status')
      .eq('user_id', userId)
      .in('status', ['requires_capture', 'requires_payment_method', 'processing']);

    log.info('payment_intents_to_cancel', { count: intents?.length ?? 0 });

    for (const intent of intents ?? []) {
      await supabase
        .from('payment_intents')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', intent.stripe_payment_intent_id);
    }
  } catch (err) {
    const msg = `Failed to cancel payment intents: ${err instanceof Error ? err.message : String(err)}`;
    log.error('cancel_payment_intents_failed', err);
    errors.push(msg);
  }

  // Step 2: Expire pending engagements
  try {
    await supabase
      .from('engagements')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted', 'reschedule_requested']);

    await supabase
      .from('engagements')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('expert_id', userId)
      .in('status', ['pending', 'accepted', 'reschedule_requested']);
  } catch (err) {
    const msg = `Failed to expire engagements: ${err instanceof Error ? err.message : String(err)}`;
    log.error('expire_engagements_failed', err);
    errors.push(msg);
  }

  // Step 3: Delete push tokens
  try {
    await supabase.from('push_tokens').delete().eq('user_id', userId);
  } catch (err) {
    const msg = `Failed to delete push tokens: ${err instanceof Error ? err.message : String(err)}`;
    log.error('delete_push_tokens_failed', err);
    errors.push(msg);
  }

  // Step 4: Anonymize user profile data
  try {
    await supabase
      .from('profiles')
      .update({
        display_name: '[Deleted User]',
        avatar_url: null,
        bio: null,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } catch (err) {
    const msg = `Failed to anonymize profile: ${err instanceof Error ? err.message : String(err)}`;
    log.error('anonymize_profile_failed', err);
    errors.push(msg);
  }

  // Step 5: Delete auth user (final, irreversible)
  try {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    log.info('auth_user_deleted', { userId });
  } catch (err) {
    const msg = `Failed to delete auth user: ${err instanceof Error ? err.message : String(err)}`;
    log.error('delete_auth_user_failed', err);
    errors.push(msg);
  }

  // Step 6: Log deletion audit entry
  try {
    await supabase.from('admin_audit_log').insert({
      action: 'user_deletion',
      target_user_id: userId,
      reason: reason ?? 'admin_request',
      errors: errors.length > 0 ? errors : null,
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    log.error('audit_log_failed', err);
    // Don't add to errors — audit log failure shouldn't fail the deletion response
  }

  if (errors.length > 0) {
    log.warn('deletion_completed_with_errors', { userId, errors });
    return new Response(
      JSON.stringify({ ok: false, userId, errors }),
      { status: 207, headers: { 'Content-Type': 'application/json' } }
    );
  }

  log.info('deletion_complete', { userId });
  return ok({ userId, deleted: true });
});
