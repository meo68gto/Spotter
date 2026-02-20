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

async function releaseExpiredAuths(formData: FormData) {
  'use server';
  const confirmText = String(formData.get('confirmText') ?? '').trim();
  if (confirmText !== 'RUN') return;
  await invokeAdminFunction('jobs-payment-auth-release-expired', {});
  revalidatePath('/payments');
}

async function finalizeCalls(formData: FormData) {
  'use server';
  const confirmText = String(formData.get('confirmText') ?? '').trim();
  if (confirmText !== 'RUN') return;
  await invokeAdminFunction('jobs-call-billing-finalize', {});
  revalidatePath('/payments');
}

async function reconcileCallDurations(formData: FormData) {
  'use server';
  const confirmText = String(formData.get('confirmText') ?? '').trim();
  if (confirmText !== 'RUN') return;
  await invokeAdminFunction('jobs-call-duration-reconcile', {});
  revalidatePath('/payments');
}

export default async function PaymentsPage({
  searchParams
}: {
  searchParams?: { page?: string; status?: string };
}) {
  const page = Math.max(Number(searchParams?.page ?? '1'), 1);
  const status = (searchParams?.status ?? '').trim();
  const offset = (page - 1) * PAGE_SIZE;

  const params = new URLSearchParams({
    select: 'id,status,amount_cents,currency,authorization_expires_at,stripe_payment_intent_id,created_at',
    order: 'created_at.desc',
    limit: String(PAGE_SIZE),
    offset: String(offset)
  });
  if (status) params.set('status', `eq.${status}`);

  const rows = await restFetch<OrderRow[]>(`review_orders?${params.toString()}`);
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
