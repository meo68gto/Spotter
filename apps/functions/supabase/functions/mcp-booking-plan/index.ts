import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { sortRecommendationsStable, type RecommendationRow } from '../_shared/mcp.ts';

type Payload = {
  activityId?: string;
  radiusKm?: number;
  limit?: number;
  includeEvents?: boolean;
  objective?: 'balanced' | 'fast_match' | 'tournament_ready';
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.activityId) return badRequest('Missing activityId', 'missing_activity_id');

  const radiusKm = body.radiusKm && body.radiusKm > 0 ? Math.min(body.radiusKm, 150) : 30;
  const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 12) : 8;
  const includeEvents = body.includeEvents ?? true;
  const objective = body.objective ?? 'balanced';

  const service = createServiceClient();
  const { data: run, error: runError } = await service
    .from('mcp_booking_runs')
    .insert({
      requester_user_id: auth.user.id,
      activity_id: body.activityId,
      objective,
      radius_km: radiusKm,
      include_events: includeEvents
    })
    .select('id, requester_user_id, activity_id, objective, radius_km, include_events, created_at')
    .single();

  if (runError || !run) {
    return json(500, { error: runError?.message ?? 'Failed to create run', code: 'mcp_run_create_failed' });
  }

  const { data: recommendations, error: recommendationError } = await service.rpc('mcp_booking_recommendations_v1', {
    p_requester_id: auth.user.id,
    p_activity_id: body.activityId,
    p_radius_meters: Math.round(radiusKm * 1000),
    p_limit: limit,
    p_include_events: includeEvents
  });

  if (recommendationError) {
    return json(500, {
      error: recommendationError.message,
      code: 'mcp_recommendation_failed'
    });
  }

  const rows = sortRecommendationsStable((recommendations ?? []) as RecommendationRow[]);
  if (rows.length) {
    const inserts = rows.map((row, idx) => ({
      run_id: run.id,
      recommendation_type: row.recommendation_type,
      candidate_user_id: row.candidate_user_id,
      event_id: row.event_id,
      score: row.score,
      distance_km: row.distance_km,
      skill_delta: row.skill_delta,
      availability_overlap_minutes: row.availability_overlap_minutes,
      reasons: row.reasons ?? [],
      rank_position: idx + 1
    }));
    await service.from('mcp_booking_recommendations').insert(inserts);
  }

  const candidateIds = rows
    .filter((row) => row.recommendation_type === 'pairing' && row.candidate_user_id)
    .map((row) => row.candidate_user_id as string);
  const eventIds = rows.filter((row) => row.recommendation_type === 'event' && row.event_id).map((row) => row.event_id as string);

  const { data: users } = candidateIds.length
    ? await service.from('users').select('id, display_name, avatar_url').in('id', candidateIds)
    : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null }> };
  const { data: events } = eventIds.length
    ? await service
        .from('sponsored_events')
        .select('id, title, city, venue_name, start_time, end_time, sponsor_id')
        .in('id', eventIds)
    : {
        data: [] as Array<{
          id: string;
          title: string;
          city: string | null;
          venue_name: string | null;
          start_time: string;
          end_time: string;
          sponsor_id: string;
        }>
      };
  const sponsorIds = (events ?? []).map((event) => event.sponsor_id);
  const { data: sponsors } = sponsorIds.length
    ? await service.from('sponsors').select('id, name').in('id', sponsorIds)
    : { data: [] as Array<{ id: string; name: string }> };

  const usersById = new Map((users ?? []).map((user) => [user.id, user]));
  const eventsById = new Map((events ?? []).map((event) => [event.id, event]));
  const sponsorsById = new Map((sponsors ?? []).map((sponsor) => [sponsor.id, sponsor]));

  const pairings = rows
    .filter((row) => row.recommendation_type === 'pairing')
    .map((row) => {
      const candidate = row.candidate_user_id ? usersById.get(row.candidate_user_id) : null;
      return {
        type: 'pairing',
        candidateUserId: row.candidate_user_id,
        candidateDisplayName: candidate?.display_name ?? 'Local player',
        candidateAvatarUrl: candidate?.avatar_url ?? null,
        score: row.score,
        distanceKm: row.distance_km,
        skillDelta: row.skill_delta,
        availabilityOverlapMinutes: row.availability_overlap_minutes,
        reasons: row.reasons
      };
    });

  const eventsResult = rows
    .filter((row) => row.recommendation_type === 'event')
    .map((row) => {
      const event = row.event_id ? eventsById.get(row.event_id) : null;
      const sponsor = event ? sponsorsById.get(event.sponsor_id) : null;
      return {
        type: 'event',
        eventId: row.event_id,
        title: event?.title ?? 'Sponsored event',
        city: event?.city ?? null,
        venueName: event?.venue_name ?? null,
        startTime: event?.start_time ?? null,
        endTime: event?.end_time ?? null,
        sponsorName: sponsor?.name ?? null,
        score: row.score,
        distanceKm: row.distance_km,
        reasons: row.reasons
      };
    });

  return json(200, {
    data: {
      run,
      pairings,
      events: eventsResult
    }
  });
});
