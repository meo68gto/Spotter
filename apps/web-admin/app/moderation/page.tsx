import { invokeAdminFunction, restFetch } from '../lib';

type ModerationRow = {
  id: string;
  question_text: string;
  engagement_mode: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  public_opt_in: boolean;
  created_at: string;
};

async function approve(formData: FormData) {
  'use server';
  const engagementRequestId = String(formData.get('engagementRequestId') ?? '');
  await invokeAdminFunction('engagements-moderate', { engagementRequestId, moderationStatus: 'approved' });
}

async function reject(formData: FormData) {
  'use server';
  const engagementRequestId = String(formData.get('engagementRequestId') ?? '');
  await invokeAdminFunction('engagements-moderate', { engagementRequestId, moderationStatus: 'rejected' });
}

export default async function ModerationPage() {
  const rows = await restFetch<ModerationRow[]>(
    "engagement_requests?select=id,question_text,engagement_mode,moderation_status,public_opt_in,created_at&public_opt_in=eq.true&moderation_status=eq.pending&order=created_at.desc&limit=100"
  );

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Public Answer Moderation Queue</h1>
      <p>Pending public Coacher posts: {rows.length}</p>

      {rows.length === 0 ? <p>No pending moderation items.</p> : null}

      {rows.map((row) => (
        <section key={row.id} style={{ border: '1px solid #d9e2ec', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{row.question_text}</p>
          <p style={{ margin: '6px 0 10px 0', color: '#486581' }}>
            {row.engagement_mode} • {new Date(row.created_at).toLocaleString()} • {row.id.slice(0, 8)}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <form action={approve}>
              <input type="hidden" name="engagementRequestId" value={row.id} />
              <button type="submit">Approve</button>
            </form>
            <form action={reject}>
              <input type="hidden" name="engagementRequestId" value={row.id} />
              <button type="submit">Reject</button>
            </form>
          </div>
        </section>
      ))}
    </main>
  );
}
