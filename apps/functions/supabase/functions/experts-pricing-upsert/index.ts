import { createServiceClient } from '../_shared/client.ts';
import { ensureCoachForUser } from '../_shared/engagements.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type PricingInput = {
  engagementMode: 'text_answer' | 'video_answer' | 'video_call';
  currency?: string;
  priceCents: number;
  perMinuteRateCents?: number;
  active?: boolean;
};

type Payload = {
  items?: PricingInput[];
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.items?.length) return badRequest('Missing items', 'missing_items');
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const coach = await ensureCoachForUser(auth.user.id);
  if (!coach) return unauthorized('Only coaches can update pricing', 'coach_required');

  const service = createServiceClient();
  const rows = body.items.map((item) => ({
    coach_id: coach.id,
    engagement_mode: item.engagementMode,
    currency: item.currency ?? 'usd',
    price_cents: item.priceCents,
    per_minute_rate_cents: item.perMinuteRateCents ?? null,
    active: item.active ?? true
  }));

  const { data, error } = await service
    .from('expert_pricing')
    .upsert(rows, { onConflict: 'coach_id,engagement_mode' })
    .select('*');

  if (error) return json(500, { error: error.message, code: 'expert_pricing_upsert_failed' });
  return json(200, { data });
});
