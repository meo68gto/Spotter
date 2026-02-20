export default function ModerationPage() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Public Answer Moderation Queue</h1>
      <p>Use `engagements-moderate` function with admin token to approve/reject public Minnects.</p>
      <p>Initial implementation is API-first; UI wiring can be layered in next pass.</p>
    </main>
  );
}
