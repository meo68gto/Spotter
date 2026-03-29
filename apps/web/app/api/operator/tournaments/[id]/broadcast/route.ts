import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/operator/tournaments/[id]/broadcast — fetch broadcast history
export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId } = await params;
  return withOperatorAuth(_request, async ({ organizerId }) => {
    const supabase = (await import('@/lib/supabase')).createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Verify tournament belongs to this operator
    const { data: tournament, error: tourneyError } = await supabase
      .from('organizer_events')
      .select('id')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .maybeSingle();

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const { data: history, error } = await supabase
      .from('broadcast_history')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('organizer_id', organizerId)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch broadcast history', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ history: history ?? [] }, { status: 200 });
  });
}

// POST /api/operator/tournaments/[id]/broadcast — send broadcast email
export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId } = await params;
  return withOperatorAuth(request, async ({ organizerId }) => {
    let body: { title?: string; body?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { title, body: messageBody } = body

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields: title, body' },
        { status: 400 },
      )
    }

    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return NextResponse.json({ error: 'Message body cannot be empty' }, { status: 400 })
    }

    const supabase = (await import('@/lib/supabase')).createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    // 0. Explicitly verify tournament belongs to this operator before proceeding
    const { data: tournament, error: tourneyError } = await supabase
      .from('organizer_events')
      .select('id, name')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .maybeSingle();

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // 1. Fetch all non-cancelled registrations for this tournament belonging to this operator
    const { data: registrations, error: regError } = await supabase
      .from('organizer_event_registrations')
      .select(`
        id,
        user_id,
        guest_email,
        organizer_events!inner (
          id,
          organizer_id,
          title,
          start_time
        )
      `)
      .eq('organizer_events.organizer_id', organizerId)
      .eq('organizer_events.id', tournamentId)
      .not('status', 'eq', 'cancelled');

    if (regError) {
      return NextResponse.json(
        { error: 'Failed to fetch registrations', details: regError.message },
        { status: 500 },
      );
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json(
        { error: 'No registrants found for this tournament' },
        { status: 404 },
      );
    }

    // 2. Collect recipient emails
    const userIds = registrations
      .map((r) => r.user_id)
      .filter((id): id is string => id !== null);

    const guestEmails = registrations
      .map((r) => r.guest_email)
      .filter((e): e is string => e !== null && e !== undefined && e.trim() !== '');

    let allEmails: string[] = [...guestEmails];

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('email')
        .in('id', userIds);
      if (users) {
        allEmails = [...allEmails, ...users.map((u) => u.email).filter(Boolean)];
      }
    }

    const uniqueEmails = [...new Set(allEmails)];

    if (uniqueEmails.length === 0) {
      return NextResponse.json(
        { error: 'No valid email addresses found for recipients' },
        { status: 400 },
      );
    }

    // 3. Send via Resend
    let result: { successful: number; failed: number; errors?: string[] }
    try {
      const { sendBroadcastEmail } = await import('@/lib/email')
      result = await sendBroadcastEmail({
        tournamentId,
        subject: title,
        htmlContent: messageBody,
        recipientEmails: uniqueEmails,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json(
        { error: 'Failed to send broadcast email', details: message },
        { status: 500 },
      )
    }

    // 4. Log to broadcast_history
    const { error: logError } = await supabase
      .from('broadcast_history')
      .insert({
        tournament_id: tournamentId,
        organizer_id: organizerId,
        subject: title,
        body: messageBody,
        recipient_count: uniqueEmails.length,
        successful_count: result.successful,
        failed_count: result.failed,
        errors: result.errors ? result.errors.join('; ') : null,
        sent_at: new Date().toISOString(),
      })

    if (logError) {
      console.error('[broadcast] Failed to log to broadcast_history:', logError.message)
      return NextResponse.json(
        {
          message: 'Broadcast sent but failed to log',
          totalRecipients: uniqueEmails.length,
          successful: result.successful,
          failed: result.failed,
          errors: result.errors,
          loggingError: logError.message,
        },
        { status: 207 },
      )
    }

    return NextResponse.json(
      {
        message: 'Broadcast sent',
        totalRecipients: uniqueEmails.length,
        successful: result.successful,
        failed: result.failed,
        errors: result.errors,
      },
      { status: 200 },
    );
  });
}
