import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { invokeAdminFunction, restFetch } from '../lib';

type ModerationRow = {
  id: string;
  question_text: string;
  engagement_mode: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  public_opt_in: boolean;
  created_at: string;
};

const PAGE_SIZE = 25;

async function approve(formData: FormData) {
  'use server';
  const engagementRequestId = String(formData.get('engagementRequestId') ?? '');
  await invokeAdminFunction('engagements-moderate', { engagementRequestId, moderationStatus: 'approved' });
  revalidatePath('/moderation');
}

async function reject(formData: FormData) {
  'use server';
  const engagementRequestId = String(formData.get('engagementRequestId') ?? '');
  await invokeAdminFunction('engagements-moderate', { engagementRequestId, moderationStatus: 'rejected' });
  revalidatePath('/moderation');
}

async function bulkModerate(formData: FormData) {
  'use server';
  const decision = String(formData.get('decision') ?? '');
  const ids = String(formData.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const confirmText = String(formData.get('confirmText') ?? '').trim();

  if (!ids.length) return;
  if (confirmText !== 'CONFIRM') return;

  const moderationStatus = decision === 'approve' ? 'approved' : 'rejected';
  // Use Promise.allSettled for error isolation — individual failures don't abort the batch
  const results = await Promise.allSettled(
    ids.map((id) =>
      invokeAdminFunction('engagements-moderate', { engagementRequestId: id, moderationStatus })
    )
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`Bulk moderation: ${failed.length}/${ids.length} items failed`);
  }
  revalidatePath('/moderation');
}

export default async function ModerationPage({
  searchParams
}: {
  searchParams?: { page?: string; q?: string; mode?: string };
}) {
  const page = Math.max(Number(searchParams?.page ?? '1'), 1);
  const rawQ = (searchParams?.q ?? '').trim();
  // S-6: Sanitize search param to prevent injection via URL query string
  const safeQ = rawQ.replace(/[^a-zA-Z0-9 .,'!?-]/g, '');
  const mode = (searchParams?.mode ?? '').trim();
  const offset = (page - 1) * PAGE_SIZE;

  const params = new URLSearchParams({
    select: 'id,question_text,engagement_mode,moderation_status,public_opt_in,created_at',
    public_opt_in: 'eq.true',
    moderation_status: 'eq.pending',
    order: 'created_at.desc',
    limit: String(PAGE_SIZE),
    offset: String(offset)
  });
  if (safeQ) params.set('question_text', `ilike.*${safeQ.replaceAll('*', '')}*`);
  if (mode) params.set('engagement_mode', `eq.${mode}`);

  const rows = await restFetch<ModerationRow[]>(`engagement_requests?${params.toString()}`);
  const idsCsv = rows.map((r) => r.id).join(',');

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set('page', String(nextPage));
    if (safeQ) p.set('q', safeQ);
    if (mode) p.set('mode', mode);
    return `/moderation?${p.toString()}`;
  };

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1080 }}>
      <h1>Public Answer Moderation Queue</h1>
      <p>Pending public Coacher posts: {rows.length}</p>

      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input name="q" defaultValue={safeQ} placeholder="Search question text" />
        <select name="mode" defaultValue={mode}>
          <option value="">All modes</option>
          <option value="text_answer">Text Answer</option>
          <option value="video_answer">Video Answer</option>
          <option value="video_call">Video Call</option>
        </select>
        <button type="submit">Apply Filters</button>
      </form>

      {rows.length > 0 ? (
        <section style={{ border: '1px solid #d9e2ec', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Bulk Actions (Current Page)</h3>
          <form action={bulkModerate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="hidden" name="ids" value={idsCsv} />
            <select name="decision" defaultValue="approve">
              <option value="approve">Approve All</option>
              <option value="reject">Reject All</option>
            </select>
            <input name="confirmText" placeholder="Type CONFIRM" />
            <button type="submit">Run Bulk Action</button>
          </form>
        </section>
      ) : null}

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

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {page > 1 ? <Link href={buildHref(page - 1)}>Previous</Link> : <span style={{ color: '#829ab1' }}>Previous</span>}
        <span>Page {page}</span>
        {rows.length === PAGE_SIZE ? <Link href={buildHref(page + 1)}>Next</Link> : <span style={{ color: '#829ab1' }}>Next</span>}
      </div>
    </main>
  );
}
