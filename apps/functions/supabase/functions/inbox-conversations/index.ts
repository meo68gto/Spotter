import { createAuthedClient } from '../_shared/client.ts';
import { requireLegalConsent } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Payload = {
  limit?: number;
  cursor?: string;
};

type Conversation = {
  threadType: 'session' | 'engagement';
  threadId: string;
  title: string;
  status: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');
  const body = (await req.json().catch(() => ({}))) as Payload;

  const limit = Math.min(Math.max(Number(body.limit ?? 30), 1), 100);
  const cursor = body.cursor ? new Date(body.cursor).toISOString() : null;
  if (body.cursor && Number.isNaN(new Date(body.cursor).getTime())) {
    return badRequest('Invalid cursor', 'invalid_cursor');
  }

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();
  const legal = await requireLegalConsent(user.id);
  if (legal) return legal;

  const conversations: Conversation[] = [];

  const { data: sessionRows } = await supabase
    .from('sessions')
    .select('id, status, proposer_user_id, partner_user_id, proposed_start_time')
    .or(`proposer_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })
    .limit(100);

  const sessionIds = (sessionRows ?? []).map((row) => row.id);
  const sessionReadMap = new Map<string, string>();

  if (sessionIds.length) {
    const { data: reads } = await supabase
      .from('inbox_thread_reads')
      .select('thread_id, last_read_at')
      .eq('user_id', user.id)
      .eq('thread_type', 'session')
      .in('thread_id', sessionIds);
    for (const row of reads ?? []) sessionReadMap.set(row.thread_id as string, row.last_read_at as string);
  }

  for (const row of sessionRows ?? []) {
    const { data: latest } = await supabase
      .from('messages')
      .select('id, message, created_at, sender_user_id')
      .eq('session_id', row.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastMessageAt = latest?.created_at ?? row.proposed_start_time;
    if (cursor && new Date(lastMessageAt).getTime() >= new Date(cursor).getTime()) continue;

    const readAt = sessionReadMap.get(row.id);
    let unreadCount = 0;
    const unreadQuery = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', row.id)
      .neq('sender_user_id', user.id);
    if (readAt) unreadQuery.gt('created_at', readAt);
    const { count } = await unreadQuery;
    unreadCount = count ?? 0;

    conversations.push({
      threadType: 'session',
      threadId: row.id,
      title: `Session ${row.id.slice(0, 8)}`,
      status: row.status,
      lastMessage: latest?.message ?? 'Session created',
      lastMessageAt,
      unreadCount
    });
  }

  const { data: coach } = await supabase.from('coaches').select('id').eq('user_id', user.id).maybeSingle();

  const requesterQuery = supabase
    .from('engagement_requests')
    .select('id, question_text, status, requester_user_id, coach_id, created_at')
    .eq('requester_user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(100);

  const coachQuery = coach?.id
    ? supabase
        .from('engagement_requests')
        .select('id, question_text, status, requester_user_id, coach_id, created_at')
        .eq('coach_id', coach.id)
        .order('updated_at', { ascending: false })
        .limit(100)
    : Promise.resolve({ data: [] as Record<string, unknown>[] });

  const [requesterRows, coachRows] = await Promise.all([requesterQuery, coachQuery]);
  const engagementRows = [...(requesterRows.data ?? []), ...(coachRows.data ?? [])].filter(
    (row, idx, arr) => arr.findIndex((x) => x.id === row.id) === idx
  );

  const engagementIds = engagementRows.map((row) => row.id as string);
  const engagementReadMap = new Map<string, string>();

  if (engagementIds.length) {
    const { data: reads } = await supabase
      .from('inbox_thread_reads')
      .select('thread_id, last_read_at')
      .eq('user_id', user.id)
      .eq('thread_type', 'engagement')
      .in('thread_id', engagementIds);
    for (const row of reads ?? []) engagementReadMap.set(row.thread_id as string, row.last_read_at as string);
  }

  for (const row of engagementRows) {
    const engagementId = row.id as string;

    const { data: latest } = await supabase
      .from('engagement_thread_messages')
      .select('id, message, created_at, sender_user_id')
      .eq('engagement_request_id', engagementId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastMessageAt = (latest?.created_at as string | undefined) ?? (row.created_at as string);
    if (cursor && new Date(lastMessageAt).getTime() >= new Date(cursor).getTime()) continue;

    const readAt = engagementReadMap.get(engagementId);
    const unreadQuery = supabase
      .from('engagement_thread_messages')
      .select('id', { count: 'exact', head: true })
      .eq('engagement_request_id', engagementId)
      .neq('sender_user_id', user.id);
    if (readAt) unreadQuery.gt('created_at', readAt);
    const { count } = await unreadQuery;

    conversations.push({
      threadType: 'engagement',
      threadId: engagementId,
      title: `Request ${engagementId.slice(0, 8)}`,
      status: row.status as string,
      lastMessage: (latest?.message as string | undefined) ?? ((row.question_text as string | undefined) ?? 'Engagement request created'),
      lastMessageAt,
      unreadCount: count ?? 0
    });
  }

  conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  return json(200, {
    data: conversations.slice(0, limit),
    nextCursor: conversations.length > limit ? conversations[limit - 1].lastMessageAt : null
  });
});
