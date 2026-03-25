import { cookies } from 'next/headers';
import Link from 'next/link';

export const metadata = {
  title: 'Spotter Admin',
  description: 'Spotter internal operations',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token')?.value;
  const expectedToken = process.env.ADMIN_DELETION_TOKEN;
  const isAuthenticated = adminToken === expectedToken;

  return (
    <html lang="en">
      <body>
        {isAuthenticated && (
          <header
            style={{
              background: '#1a1a2e',
              color: '#fff',
              padding: '8px 24px',
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              fontFamily: 'sans-serif',
            }}
          >
            <span style={{ fontWeight: 700 }}>Spotter Admin</span>
            <Link
              href="/moderation"
              style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: 14 }}
            >
              Moderation
            </Link>
            <Link
              href="/disputes"
              style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: 14 }}
            >
              Disputes
            </Link>
            <Link
              href="/payments"
              style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: 14 }}
            >
              Payments
            </Link>
            <form action="/api/admin/logout" method="POST" style={{ marginLeft: 'auto' }}>
              <button
                type="submit"
                style={{
                  background: 'transparent',
                  border: '1px solid #4a4a6a',
                  color: '#a0a0c0',
                  padding: '4px 12px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Sign Out
              </button>
            </form>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
