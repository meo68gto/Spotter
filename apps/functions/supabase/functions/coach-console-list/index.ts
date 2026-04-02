import { createServiceClient } from '../_shared/client.ts';
import { ensureCoachForUser } from '../_shared/engagements.ts';
import { requireUser } from '../_shared/guard.ts';
import { json, unauthorized } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const coach = await ensureCoachForUser(auth.user.id);
  if (!coach) return unauthorized('Only coaches can access the coach console', 'coach_required');

  const service = createServiceClient();
  const { data: requests, error } = await service
    .from('engagement_requests')
    .select('id, status, question_text, paid_at, accepted_deadline_at, delivery_deadline_at, created_at, requester_user_id, coach_service_id, review_order_id')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return json(500, { error: error.message, code: 'coach_console_list_failed' });

  const requestRows = requests ?? [];
  const coachServiceIds = [...new Set(requestRows.map((row) => row.coach_service_id).filter(Boolean))];
  const reviewOrderIds = [...new Set(requestRows.map((row) => row.review_order_id).filter(Boolean))];
  const buyerUserIds = [...new Set(requestRows.map((row) => row.requester_user_id).filter(Boolean))];
  const engagementRequestIds = requestRows.map((row) => row.id);

  const [{ data: coachServices }, { data: reviewOrders }, { data: profiles }, { data: assets }] = await Promise.all([
    coachServiceIds.length
      ? service
          .from('coach_services')
          .select('id, title, service_type, price_cents, currency')
          .in('id', coachServiceIds)
      : Promise.resolve({ data: [] as Array<any> }),
    reviewOrderIds.length
      ? service
          .from('review_orders')
          .select('id')
          .in('id', reviewOrderIds)
      : Promise.resolve({ data: [] as Array<any> }),
    buyerUserIds.length
      ? service
          .from('profiles')
          .select('id, display_name')
          .in('id', buyerUserIds)
      : Promise.resolve({ data: [] as Array<any> }),
    engagementRequestIds.length
      ? service
          .from('engagement_assets')
          .select('id, engagement_request_id')
          .in('engagement_request_id', engagementRequestIds)
      : Promise.resolve({ data: [] as Array<any> })
  ]);

  const coachServiceById = new Map((coachServices ?? []).map((row: any) => [row.id, row]));
  const reviewOrderById = new Map((reviewOrders ?? []).map((row: any) => [row.id, row]));
  const profileById = new Map((profiles ?? []).map((row: any) => [row.id, row]));
  const assetCountByRequestId = new Map<string, number>();
  for (const asset of assets ?? []) {
    assetCountByRequestId.set(asset.engagement_request_id, (assetCountByRequestId.get(asset.engagement_request_id) ?? 0) + 1);
  }

  const rows = requestRows.map((row: any) => {
    const coachService = row.coach_service_id ? coachServiceById.get(row.coach_service_id) : null;
    const buyerProfile = row.requester_user_id ? profileById.get(row.requester_user_id) : null;
    const reviewOrder = row.review_order_id ? reviewOrderById.get(row.review_order_id) : null;
    return {
    engagementRequestId: row.id,
    reviewOrderId: reviewOrder?.id ?? null,
    status: row.status,
    serviceTitle: coachService?.title ?? 'Coach Service',
    serviceType: coachService?.service_type ?? 'video_review',
    buyerName: buyerProfile?.display_name ?? 'Buyer',
    buyerUserId: row.requester_user_id,
    questionText: row.question_text,
    amountCents: coachService?.price_cents ?? 0,
    currency: coachService?.currency ?? 'usd',
    paidAt: row.paid_at,
    acceptedDeadlineAt: row.accepted_deadline_at,
    deliveryDeadlineAt: row.delivery_deadline_at,
    createdAt: row.created_at,
    assetCount: assetCountByRequestId.get(row.id) ?? 0
  };
  });

  return json(200, { data: rows });
});
