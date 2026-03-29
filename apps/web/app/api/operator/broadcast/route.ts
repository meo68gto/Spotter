import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { sendBroadcastEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
): Promise<Response> {
  return withOperatorAuth(request, async ({ organizerId }) => {
    const body = await request.json();
    const { tournamentId, subject, htmlContent } = body;

    if (!tournamentId || !subject || !htmlContent) {
      return NextResponse.json(
        { error: 'Missing required fields: tournamentId, subject, htmlContent' },
        { status: 400 },
      );
    }

    const supabase = (await import('@/lib/supabase')).createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // 1. Fetch all confirmed/waitlisted registrations for this tournament
    // that belong to this operator's account
    const { data: registrations, error: regError } = await supabase
      .from('organizer_event_registrations')
      .select(`
        id,
        user_id,
        guest_email,
        status,
        organizer_events!inner (
          id,
          organizer_id
        )
      `)
      .eq('organizer_events.organizer_id', organizerId)
      .eq('organizer_events.id', tournamentId)
      .in('status', ['registered', 'waitlisted', 'confirmed', 'checked_in']);

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
    // For registered users, fetch their email from auth.users
    const userIds = registrations
      .map((r) => r.user_id)
      .filter((id): id is string => id !== null && id !== undefined);

    const guestEmails = registrations
      .map((r) => r.guest_email)
      .filter((e): e is string => e !== null && e !== undefined && e !== '');

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

    if (allEmails.length === 0) {
      return NextResponse.json(
        { error: 'No valid email addresses found for recipients' },
        { status: 400 },
      );
    }

    // 3. Deduplicate
    const uniqueEmails = [...new Set(allEmails)];

    // 4. Send broadcast via Resend (batched internally)
    const result = await sendBroadcastEmail({
      tournamentId,
      subject,
      htmlContent,
      recipientEmails: uniqueEmails,
    });

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
