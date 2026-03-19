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

// Mock data for when backend is unavailable
const MOCK_REFUNDS: RefundRow[] = [
  {
    id: '22222222-2222-2222-2222-222222222222',
    review_order_id: '11111111-1111-1111-1111-111111111114',
    requester_user_id: '33333333-3333-3333-3333-333333333333',
    reason: 'Service not delivered',
    status: 'pending',
    created_at: new Date().toISOString()
  },
  {
    id: '22222222-2222-2222-2222-222222222223',
    review_order_id: '11111111-1111-1111-1111-111111111115',
    requester_user_id: '33333333-3333-3333-3333-333333333334',
    reason: 'Coach did not show up',
    status: 'approved',
    created_at: new Date(Date.now() - 86400000).toISOString()
  }
];

const MOCK_RESCHEDULES: RescheduleRow[] = [
  {
    id: '44444444-4444-4444-4444-444444444444',
    engagement_request_id: '00000000-0000-0000-0000-000000000005',
    status: 'declined',
    declined_reason: 'Coach unavailable at requested time',
    created_at: new Date(Date.now() - 172800000).toISOString()
  },
  {
    id: '44444444-4444-4444-4444-444444444445',
    engagement_request_id: '00000000-0000-0000-0000-000000000006',
    status: 'declined',
    declined_reason: 'No coaches available for that sport',
    created_at: new Date(Date.now() - 259200000).toISOString()
  }
];

export default async function DisputesPage() {
  let refunds: RefundRow[] = [];
  let reschedules: RescheduleRow[] = [];
  let usingMockData = false;

  try {
    [refunds, reschedules] = await Promise.all([
      restFetch<RefundRow[]>(
        'refund_requests?select=id,review_order_id,requester_user_id,reason,status,created_at&order=created_at.desc&limit=100'
      ),
      restFetch<RescheduleRow[]>(
        'reschedule_requests?select=id,engagement_request_id,status,declined_reason,created_at&status=eq.declined&order=created_at.desc&limit=100'
      )
    ]);
  } catch (error) {
    console.log('Backend unavailable, using mock data:', error);
    refunds = MOCK_REFUNDS;
    reschedules = MOCK_RESCHEDULES;
    usingMockData = true;
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Disputes & Refund Oversight</h1>
      
      {usingMockData && (
        <div style={{ 
          background: '#fff3cd', 
          border: '1px solid #ffc107', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16,
          color: '#856404'
        }}>
          <strong>⚠️ Demo Mode:</strong> Backend unavailable - showing demo disputes.
        </div>
      )}

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
