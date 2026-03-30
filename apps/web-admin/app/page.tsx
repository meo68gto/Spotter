import { cookies } from 'next/headers';
import Link from 'next/link';
import LoginForm from './LoginForm';
import { getAdminSessionCookieName, verifyAdminSessionToken } from './admin-session';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_DELETION_TOKEN;

const isConfigMissing = !ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_SESSION_SECRET;

export default async function AdminHome() {
  if (isConfigMissing) {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 400, margin: '80px auto' }}>
        <h1 style={{ marginBottom: 8 }}>Spotter Admin</h1>
        <p style={{ color: '#c0392b', marginBottom: 24, fontWeight: 600 }}>
          ⚠️ Server misconfiguration: admin credentials are not configured.
          Set <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code>, and{' '}
          <code>ADMIN_SESSION_SECRET</code> env vars to enable this portal.
        </p>
        <p style={{ color: '#486581', marginBottom: 24 }}>
          Internal operations dashboard. Authenticate to continue.
        </p>
        <div style={{ padding: 16, background: '#fde8e8', borderRadius: 8, color: '#c0392b' }}>
          Configuration missing — admin login is disabled.
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  const adminSession = cookieStore.get(getAdminSessionCookieName())?.value;
  const isAuthenticated = await verifyAdminSessionToken(adminSession);

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
