import { forbidden, json } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

type DeletionRequestRow = {
  id: string;
  user_id: string;
};

const logAudit = async (
  supabase: ReturnType<typeof createServiceClient>,
  requestId: string,
  userId: string,
  action: string,
  status: 'success' | 'failed',
  metadata: Record<string, unknown> = {}
) => {
  await supabase.from('deletion_audit_logs').insert({
    deletion_request_id: requestId,
    user_id: userId,
    action,
    status,
    metadata
  });
};

Deno.serve(async (req) => {
  const env = getRuntimeEnv();
  const adminToken = req.headers.get('x-admin-token');

  if (!env.adminDeletionToken || adminToken !== env.adminDeletionToken) {
    return forbidden('Invalid admin token', 'invalid_admin_token');
  }

  const supabase = createServiceClient();

  const { data: requests, error: reqErr } = await supabase
    .from('user_deletion_requests')
    .select('id, user_id')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(25);

  if (reqErr) return json(500, { error: reqErr.message, code: 'deletion_request_query_failed' });

  const processed: string[] = [];
  const failed: Array<{ requestId: string; userId: string; reason: string }> = [];

  for (const row of (requests ?? []) as DeletionRequestRow[]) {
    try {
      await supabase
        .from('user_deletion_requests')
        .update({ status: 'processing', processing_started_at: new Date().toISOString(), failure_reason: null })
        .eq('id', row.id)
        .eq('status', 'pending');

      await logAudit(supabase, row.id, row.user_id, 'request_marked_processing', 'success');

      const { data: ownedSubmissions } = await supabase
        .from('video_submissions')
        .select('id')
        .eq('user_id', row.user_id)
        .limit(5000);

      const ownedSubmissionIds = (ownedSubmissions ?? []).map((item: { id: string }) => item.id);

      if (ownedSubmissionIds.length > 0) {
        await supabase.from('video_processing_jobs').delete().in('video_submission_id', ownedSubmissionIds);
        await logAudit(supabase, row.id, row.user_id, 'video_processing_jobs_deleted', 'success', {
          count: ownedSubmissionIds.length
        });
      }

      await supabase.from('messages').delete().eq('sender_user_id', row.user_id);
      await logAudit(supabase, row.id, row.user_id, 'messages_deleted', 'success');

      await supabase.from('session_feedback').delete().or(`reviewer_user_id.eq.${row.user_id},reviewee_user_id.eq.${row.user_id}`);
      await logAudit(supabase, row.id, row.user_id, 'session_feedback_deleted', 'success');

      await supabase.from('coach_reviews').delete().eq('coach_user_id', row.user_id);
      await logAudit(supabase, row.id, row.user_id, 'coach_reviews_deleted', 'success');

      await supabase.from('video_submissions').delete().eq('user_id', row.user_id);
      await logAudit(supabase, row.id, row.user_id, 'video_submissions_deleted', 'success', {
        count: ownedSubmissionIds.length
      });

      await supabase.from('progress_snapshots').delete().eq('user_id', row.user_id);
      await supabase.from('skill_profiles').delete().eq('user_id', row.user_id);
      await supabase.from('availability_slots').delete().eq('user_id', row.user_id);
      await logAudit(supabase, row.id, row.user_id, 'derived_activity_data_deleted', 'success');

      const anonName = `deleted-${row.user_id.slice(0, 8)}`;
      await supabase
        .from('users')
        .update({
          display_name: anonName,
          avatar_url: null,
          bio: null,
          home_location: null,
          availability: {}
        })
        .eq('id', row.user_id);
      await logAudit(supabase, row.id, row.user_id, 'user_profile_scrubbed', 'success');

      try {
        await supabase.auth.admin.deleteUser(row.user_id, true);
        await logAudit(supabase, row.id, row.user_id, 'auth_user_deleted', 'success');
      } catch {
        await logAudit(supabase, row.id, row.user_id, 'auth_user_deleted', 'failed', {
          reason: 'auth_delete_failed'
        });
      }

      await supabase
        .from('user_deletion_requests')
        .update({ status: 'completed', completed_at: new Date().toISOString(), failure_reason: null })
        .eq('id', row.id);

      await logAudit(supabase, row.id, row.user_id, 'request_completed', 'success');
      await trackServerEvent('deletion_request_completed', row.user_id, { deletion_request_id: row.id });

      processed.push(row.id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_error';
      failed.push({ requestId: row.id, userId: row.user_id, reason });

      await supabase
        .from('user_deletion_requests')
        .update({ status: 'failed', failure_reason: reason })
        .eq('id', row.id);

      await logAudit(supabase, row.id, row.user_id, 'request_failed', 'failed', { reason });
      await trackServerEvent('deletion_request_failed', row.user_id, {
        deletion_request_id: row.id,
        reason
      });
    }
  }

  return json(200, {
    processed_count: processed.length,
    processed_ids: processed,
    failed_count: failed.length,
    failed
  });
});
