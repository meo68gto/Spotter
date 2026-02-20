import { restFetch } from '../lib';

type RefundRow = {
  id: string;
  review_order_id: string;
  requester_user_id: string;
  reason: string | null;
  status: string;
  created_at: string;
};

type RescheduleRow = {
  id: string;
  engagement_request_id: string;
  status: string;
  declined_reason: string | null;
  created_at: string;
};

export default async function DisputesPage() {
  const [refunds, reschedules] = await Promise.all([
    restFetch<RefundRow[]>(
      'refund_requests?select=id,review_order_id,requester_user_id,reason,status,created_at&order=created_at.desc&limit=100'
    ),
    restFetch<RescheduleRow[]>(
      'reschedule_requests?select=id,engagement_request_id,status,declined_reason,created_at&status=eq.declined&order=created_at.desc&limit=100'
    )
  ]);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Disputes & Refund Oversight</h1>
      <h2>Refund Requests ({refunds.length})</h2>
      {refunds.length === 0 ? <p>No refund requests.</p> : null}
      {refunds.map((row) => (
        <p key={row.id}>
          {row.id.slice(0, 8)} • order {row.review_order_id.slice(0, 8)} • {row.status} • {row.reason ?? 'no reason'}
        </p>
      ))}

      <h2 style={{ marginTop: 24 }}>Declined Reschedules ({reschedules.length})</h2>
      {reschedules.length === 0 ? <p>No declined reschedules.</p> : null}
      {reschedules.map((row) => (
        <p key={row.id}>
          {row.id.slice(0, 8)} • engagement {row.engagement_request_id.slice(0, 8)} • {row.declined_reason ?? 'declined'}
        </p>
      ))}
    </main>
  );
}
