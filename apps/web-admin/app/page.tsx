import Link from 'next/link';

export default function CoachPortalHome() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Spotter Web Admin</h1>
      <p>Coacher MVP operations surfaces.</p>
      <ul>
        <li><Link href="/moderation">Public Answer Moderation</Link></li>
        <li><Link href="/disputes">Disputes & Refund Oversight</Link></li>
        <li><Link href="/payments">Payment Exceptions</Link></li>
      </ul>
    </main>
  );
}
