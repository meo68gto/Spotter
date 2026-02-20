import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { hasRequiredOnboardingFields } from '../_shared/validation.ts';
import { createAuthedClient } from '../_shared/client.ts';
import { requireLegalConsent } from '../_shared/guard.ts';

interface Payload {
  displayName?: string;
  timezone?: string;
  activityId: string;
  sourceScale: string;
  sourceValue: string;
  canonicalScore: number;
  skillBand: string;
  dimensions?: Array<{ key: string; label: string; score: number }>;
  availabilitySlots?: Array<{
    weekday: number;
    startMinute: number;
    endMinute: number;
    timezone?: string;
  }>;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');
  const supabase = createAuthedClient(authHeader);

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return unauthorized();
  }

  const legal = await requireLegalConsent(user.id);
  if (legal) return legal;

  const body = (await req.json()) as Payload;

  if (!hasRequiredOnboardingFields(body)) {
    return badRequest('Missing required fields');
  }

  if (body.availabilitySlots) {
    const invalid = body.availabilitySlots.some(
      (slot) =>
        slot.weekday < 0 ||
        slot.weekday > 6 ||
        slot.startMinute < 0 ||
        slot.startMinute > 1439 ||
        slot.endMinute < 1 ||
        slot.endMinute > 1440 ||
        slot.endMinute <= slot.startMinute
    );
    if (invalid) {
      return badRequest('Invalid availability slot values', 'invalid_availability_slots');
    }
  }

  const { error: profileError } = await supabase.from('users').upsert(
    {
      id: user.id,
      display_name: body.displayName ?? user.user_metadata?.full_name ?? null,
      timezone: body.timezone ?? 'UTC',
      onboarding_complete: true
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    return json(500, { error: profileError.message });
  }

  const { data, error } = await supabase
    .from('skill_profiles')
    .upsert(
      {
        user_id: user.id,
        activity_id: body.activityId,
        source_scale: body.sourceScale,
        source_value: body.sourceValue,
        canonical_score: body.canonicalScore,
        skill_band: body.skillBand,
        dimensions: body.dimensions ?? []
      },
      { onConflict: 'user_id,activity_id' }
    )
    .select('*')
    .single();

  if (error) {
    return json(500, { error: error.message });
  }

  const incomingSlots =
    body.availabilitySlots && body.availabilitySlots.length > 0
      ? body.availabilitySlots
      : [
          { weekday: 1, startMinute: 480, endMinute: 1080, timezone: body.timezone ?? 'UTC' },
          { weekday: 2, startMinute: 480, endMinute: 1080, timezone: body.timezone ?? 'UTC' },
          { weekday: 3, startMinute: 480, endMinute: 1080, timezone: body.timezone ?? 'UTC' },
          { weekday: 4, startMinute: 480, endMinute: 1080, timezone: body.timezone ?? 'UTC' },
          { weekday: 5, startMinute: 480, endMinute: 1080, timezone: body.timezone ?? 'UTC' }
        ];

  const { count } = await supabase
    .from('availability_slots')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('activity_id', body.activityId);

  if ((count ?? 0) > 0) {
    const { error: deleteError } = await supabase
      .from('availability_slots')
      .delete()
      .eq('user_id', user.id)
      .eq('activity_id', body.activityId);
    if (deleteError) {
      return json(500, { error: deleteError.message, code: 'availability_reset_failed' });
    }
  }

  const { error: availabilityError } = await supabase.from('availability_slots').insert(
    incomingSlots.map((slot) => ({
      user_id: user.id,
      activity_id: body.activityId,
      weekday: slot.weekday,
      start_minute: slot.startMinute,
      end_minute: slot.endMinute,
      timezone: slot.timezone ?? body.timezone ?? 'UTC'
    }))
  );
  if (availabilityError) {
    return json(500, { error: availabilityError.message, code: 'availability_upsert_failed' });
  }

  return json(200, { data });
});
