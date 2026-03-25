import { cookies } from 'next/headers';
import Link from 'next/link';
import LoginForm from './LoginForm';

export default async function AdminHome() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token')?.value;
  const expectedToken = process.env.ADMIN_DELETION_TOKEN;
  const isAuthenticated = adminToken === expectedToken;

  if (!isAuthenticated) {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 400, margin: '80px auto' }}>
        <h1 style={{ marginBottom: 8 }}>Spotter Admin</h1>
        <p style={{ color: '#486581', marginBottom: 24 }}>
          Internal operations dashboard. Authenticate to continue.
        </p>
        <LoginForm />
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Spotter Web Admin</h1>
      <p>Operations surfaces for Spotter.</p>
      <ul>
        <li><Link href="/moderation">Public Engagement Moderation</Link></li>
        <li><Link href="/disputes">Disputes &amp; Refund Oversight</Link></li>
        <li><Link href="/payments">Payment Exceptions</Link></li>
      </ul>
    </main>
  );
}
