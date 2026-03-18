import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { invokeAdminFunction, restFetch } from '../lib';

type OrderRow = {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  authorization_expires_at: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

const PAGE_SIZE = 40;

// Mock data for when backend is unavailable
const MOCK_ORDERS: OrderRow[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    status: 'paid',
    amount_cents: 5000,
    currency: 'usd',
    authorization_expires_at: null,
    stripe_payment_intent_id: 'pi_1234567890',
    created_at: new Date().toISOString()
  },
  {
    id: '11111111-1111-1111-1111-111111111112',
    status: 'failed',
    amount_cents: 3000,
    currency: 'usd',
    authorization_expires_at: new Date(Date.now() + 86400000).toISOString(),
    stripe_payment_intent_id: null,
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: '11111111-1111-1111-1111-111111111113',
    status: 'requires_payment_method',
    amount_cents: 7500,
    currency: 'usd',
    authorization_expires_at: new Date(Date.now() + 172800000).toISOString(),
    stripe_payment_intent_id: null,
    created_at: new Date(Date.now() - 172800000).toISOString()
  },
  {
    id: '11111111-1111-1111-1111-111111111114',
    status: 'refunded',
    amount_cents: 2500,
    currency: 'usd',
    authorization_expires_at: null,
    stripe_payment_intent_id: 'pi_0987654321',
    created_at: new Date(Date.now() - 259200000).toISOString()
  }
];

async function releaseExpiredAuths(formData: FormData) {
  'use server';
  const confirmText = String(formData.get('confirmText') ?? '').trim();
  if (confirmText !== 'RUN') return;
  try {
    await invokeAdminFunction('jobs-payment-auth-release-expired', {});
  } catch (e) {
    console.log('Mock release expired auths');
  }
  revalidatePath('/payments');
}

async function finalizeCalls(formData: FormData) {
  'use server';
  const confirmText = String(formData.get('confirmText') ?? '').trim();
  if (confirmText !== 'RUN') return;
  try {
    await invokeAdminFunction('jobs-call-billing-finalize', {});
  } catch (e) {
    console.log('Mock finalize calls');
  }
  revalidatePath('/payments');
}

async function reconcileCallDurations(formData: FormData) {
  'use server';
  const confirmText = String(formData.get('confirmText') ?? '').trim();
  if (confirmText !== 'RUN') return;
  try {
    await invokeAdminFunction('jobs-call-duration-reconcile', {});
  } catch (e) {
    console.log('Mock reconcile durations');
  }
  revalidatePath('/payments');
}

export default async function PaymentsPage({
  searchParams: searchParamsPromise
}: {
  searchParams?: Promise<{ page?: string; status?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const page = Math.max(Number(searchParams?.page ?? '1'), 1);
  const status = (searchParams?.status ?? '').trim();
  const offset = (page - 1) * PAGE_SIZE;

  let rows: OrderRow[] = [];
  let usingMockData = false;

  try {
    const params = new URLSearchParams({
      select: 'id,status,amount_cents,currency,authorization_expires_at,stripe_payment_intent_id,created_at',
      order: 'created_at.desc',
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    if (status) params.set('status', `eq.${status}`);

    rows = await restFetch<OrderRow[]>(`review_orders?${params.toString()}`);
  } catch (error) {
    console.log('Backend unavailable, using mock data:', error);
    rows = MOCK_ORDERS;
    usingMockData = true;
  }

  // Filter mock data if status provided
  if (usingMockData && status) {
    rows = rows.filter(r => r.status === status);
  }

  const exceptions = rows.filter((row) => row.status !== 'paid');

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set('page', String(nextPage));
    if (status) p.set('status', status);
    return `/payments?${p.toString()}`;
  };

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1100 }}>
      <h1>Payment Exceptions</h1>
      
      {usingMockData && (
        <div style={{ 
          background: '#fff3cd', 
          border: '1px solid #ffc107', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16,
          color: '#856404'
        }}>
          <strong>⚠️ Demo Mode:</strong> Backend unavailable - showing demo orders.
        </div>
      )}

      <p>Total orders loaded: {rows.length}</p>
      <p>Exception orders (non-paid): {exceptions.length}</p>

      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="created">created</option>
          <option value="requires_payment_method">requires_payment_method</option>
          <option value="processing">processing</option>
          <option value="paid">paid</option>
          <option value="failed">failed</option>
          <option value="refunded">refunded</option>
          <option value="cancelled">cancelled</option>
        </select>
        <button type="submit">Apply</button>
      </form>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <form action={releaseExpiredAuths} style={{ display: 'flex', gap: 6 }}>
          <input name="confirmText" placeholder="Type RUN" />
          <button type="submit">Run Auth Release Job</button>
        </form>
        <form action={finalizeCalls} style={{ display: 'flex', gap: 6 }}>
          <input name="confirmText" placeholder="Type RUN" />
          <button type="submit">Run Call Billing Finalizer</button>
        </form>
        <form action={reconcileCallDurations} style={{ display: 'flex', gap: 6 }}>
          <input name="confirmText" placeholder="Type RUN" />
          <button type="submit">Run Call Duration Reconcile</button>
        </form>
      </div>

      {rows.map((row) => (
        <p key={row.id}>
          {row.id.slice(0, 8)} • {row.status} • {(row.amount_cents / 100).toFixed(2)} {row.currency.toUpperCase()} •
          auth expires {row.authorization_expires_at ? new Date(row.authorization_expires_at).toLocaleString() : 'n/a'} •
          pi {row.stripe_payment_intent_id ? row.stripe_payment_intent_id.slice(0, 14) : 'n/a'}
        </p>
      ))}

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {page > 1 ? <Link href={buildHref(page - 1)}>Previous</Link> : <span style={{ color: '#829ab1' }}>Previous</span>}
        <span>Page {page}</span>
        {rows.length === PAGE_SIZE ? <Link href={buildHref(page + 1)}>Next</Link> : <span style={{ color: '#829ab1' }}>Next</span>}
      </div>
    </main>
  );
}
