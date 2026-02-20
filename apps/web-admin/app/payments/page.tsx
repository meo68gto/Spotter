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

async function releaseExpiredAuths() {
  'use server';
  await invokeAdminFunction('jobs-payment-auth-release-expired', {});
}

async function finalizeCalls() {
  'use server';
  await invokeAdminFunction('jobs-call-billing-finalize', {});
}

export default async function PaymentsPage() {
  const rows = await restFetch<OrderRow[]>(
    'review_orders?select=id,status,amount_cents,currency,authorization_expires_at,stripe_payment_intent_id,created_at&order=created_at.desc&limit=120'
  );

  const exceptions = rows.filter((row) => row.status !== 'paid');

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Payment Exceptions</h1>
      <p>Total orders loaded: {rows.length}</p>
      <p>Exception orders (non-paid): {exceptions.length}</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <form action={releaseExpiredAuths}>
          <button type="submit">Run Auth Release Job</button>
        </form>
        <form action={finalizeCalls}>
          <button type="submit">Run Call Billing Finalizer</button>
        </form>
      </div>

      {exceptions.map((row) => (
        <p key={row.id}>
          {row.id.slice(0, 8)} • {row.status} • {(row.amount_cents / 100).toFixed(2)} {row.currency.toUpperCase()} •
          expires {row.authorization_expires_at ? new Date(row.authorization_expires_at).toLocaleString() : 'n/a'}
        </p>
      ))}
    </main>
  );
}
