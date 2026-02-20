export default function PaymentsPage() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Payment Exceptions</h1>
      <p>Monitor uncaptured auths, failed captures, and expired holds.</p>
      <p>Use jobs: `jobs-payment-auth-release-expired` and `jobs-call-billing-finalize` for remediations.</p>
    </main>
  );
}
