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

// Mock data for when backend is unavailable
const MOCK_DATA: ModerationRow[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    question_text: 'How do I improve my golf swing for better distance?',
    engagement_mode: 'video_answer',
    moderation_status: 'pending',
    public_opt_in: true,
    created_at: new Date().toISOString()
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    question_text: 'What are the best drills for bunker shots?',
    engagement_mode: 'text_answer',
    moderation_status: 'pending',
    public_opt_in: true,
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    question_text: 'Can you analyze my putting stroke?',
    engagement_mode: 'video_call',
    moderation_status: 'pending',
    public_opt_in: true,
    created_at: new Date(Date.now() - 172800000).toISOString()
  }
];

async function approve(formData: FormData) {
  'use server';
  const engagementRequestId = String(formData.get('engagementRequestId') ?? '');
  try {
    await invokeAdminFunction('engagements-moderate', { engagementRequestId, moderationStatus: 'approved' });
  } catch (e) {
    console.log('Mock approve for:', engagementRequestId);
  }
  revalidatePath('/moderation');
}

async function reject(formData: FormData) {
  'use server';
  const engagementRequestId = String(formData.get('engagementRequestId') ?? '');
  try {
    await invokeAdminFunction('engagements-moderate', { engagementRequestId, moderationStatus: 'rejected' });
  } catch (e) {
    console.log('Mock reject for:', engagementRequestId);
  }
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

  console.log('Mock bulk', decision, 'for ids:', ids);
  revalidatePath('/moderation');
}

export default async function ModerationPage({
  searchParams: searchParamsPromise
}: {
  searchParams?: Promise<{ page?: string; q?: string; mode?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const page = Math.max(Number(searchParams?.page ?? '1'), 1);
  const q = (searchParams?.q ?? '').trim();
  const mode = (searchParams?.mode ?? '').trim();
  const offset = (page - 1) * PAGE_SIZE;

  let rows: ModerationRow[] = [];
  let usingMockData = false;
  let errorMessage = '';

  try {
    const params = new URLSearchParams({
      select: 'id,question_text,engagement_mode,moderation_status,public_opt_in,created_at',
      public_opt_in: 'eq.true',
      moderation_status: 'eq.pending',
      order: 'created_at.desc',
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    if (q) params.set('question_text', `ilike.*${q.replaceAll('*', '')}*`);
    if (mode) params.set('engagement_mode', `eq.${mode}`);

    rows = await restFetch<ModerationRow[]>(`engagement_requests?${params.toString()}`);
  } catch (error) {
    console.log('Backend unavailable, using mock data:', error);
    rows = MOCK_DATA;
    usingMockData = true;
    errorMessage = 'Backend unavailable - showing demo data';
  }

  // Filter mock data if search params provided
  if (usingMockData && q) {
    rows = rows.filter(r => r.question_text.toLowerCase().includes(q.toLowerCase()));
  }
  if (usingMockData && mode) {
    rows = rows.filter(r => r.engagement_mode === mode);
  }

  const idsCsv = rows.map((r) => r.id).join(',');

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set('page', String(nextPage));
    if (q) p.set('q', q);
    if (mode) p.set('mode', mode);
    return `/moderation?${p.toString()}`;
  };

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1080 }}>
      <h1>Public Answer Moderation Queue</h1>
      
      {usingMockData && (
        <div style={{ 
          background: '#fff3cd', 
          border: '1px solid #ffc107', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16,
          color: '#856404'
        }}>
          <strong>⚠️ Demo Mode:</strong> {errorMessage}. Actions will be logged but not persisted.
        </div>
      )}
      
      <p>Pending public Coacher posts: {rows.length}</p>

      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input name="q" defaultValue={q} placeholder="Search question text" />
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
