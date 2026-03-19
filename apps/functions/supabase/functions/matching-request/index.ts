import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient, createServiceClient } from '../_shared/client.ts';
import { requireLegalConsent } from '../_shared/guard.ts';
import { verifyInteractionAllowed } from '../_shared/enforcement.ts';

interface Payload {
  candidateUserId: string;
  activityId: string;
  requestedFrom?: string;
  requestedTo?: string;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const body = (await req.json()) as Payload;
  if (!body.candidateUserId || !body.activityId) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const supabase = createAuthedClient(authHeader);
  const service = createServiceClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();
  const legal = await requireLegalConsent(user.id);
  if (legal) return legal;

  if (body.candidateUserId === user.id) {
    return badRequest('Cannot request match with yourself', 'self_match_not_allowed');
  }

  // Same-tier enforcement: Verify interaction is allowed
  const interactionCheck = await verifyInteractionAllowed(service, user.id, body.candidateUserId);
  if (!interactionCheck.allowed) {
    return json(403, { error: interactionCheck.error, code: interactionCheck.code });
  }

  let requestedRange: string | null = null;
  if (body.requestedFrom && body.requestedTo) {
    const requestedFrom = new Date(body.requestedFrom);
    const requestedTo = new Date(body.requestedTo);
    if (Number.isNaN(requestedFrom.getTime()) || Number.isNaN(requestedTo.getTime())) {
      return badRequest('Invalid requested time window', 'invalid_requested_window');
    }
    if (requestedTo <= requestedFrom) {
      return badRequest('requestedTo must be later than requestedFrom', 'invalid_requested_window');
    }
    requestedRange = `[${body.requestedFrom},${body.requestedTo})`;
  }

  const { data: existing } = await supabase
    .from('matches')
    .select('id')
    .eq('activity_id', body.activityId)
    .or(
      `and(requester_user_id.eq.${user.id},candidate_user_id.eq.${body.candidateUserId}),and(requester_user_id.eq.${body.candidateUserId},candidate_user_id.eq.${user.id})`
    )
    .in('status', ['pending', 'accepted'])
    .limit(1);

  if (existing && existing.length > 0) {
    return badRequest('Active match already exists between these users', 'active_match_exists');
  }

  const { count: mySkillCount } = await service
    .from('skill_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('activity_id', body.activityId);
  if ((mySkillCount ?? 0) === 0) {
    return badRequest('Complete onboarding for this activity first', 'missing_requester_skill_profile');
  }

  const { count: candidateSkillCount } = await service
    .from('skill_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', body.candidateUserId)
    .eq('activity_id', body.activityId);
  if ((candidateSkillCount ?? 0) === 0) {
    return badRequest('Candidate has not onboarded for this activity', 'missing_candidate_skill_profile');
  }

  const { data, error } = await supabase
    .from('matches')
    .insert({
      requester_user_id: user.id,
      candidate_user_id: body.candidateUserId,
      activity_id: body.activityId,
      status: 'pending',
      requested_time_window: requestedRange,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    })
    .select('*')
    .single();

  if (error) {
    return json(500, { error: error.message, code: 'match_create_failed' });
  }

  return json(200, { data });
});
