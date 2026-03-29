import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/operator/tournaments/[id]/checkin — fetch all registrants with check-in status
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

    const { data: registrations, error } = await supabase
      .from('organizer_event_registrations')
      .select(`
        id,
        event_id,
        user_id,
        guest_email,
        guest_name,
        status,
        payment_status,
        amount_paid_cents,
        registered_at,
        checked_in_at,
        checked_in_by_user_id,
        notes,
        dietary_restrictions,
        team_name,
        handicap_at_registration,
        marketing_opt_in,
        organizer_events!inner (
          id,
          organizer_id,
          title,
          start_time
        )
      `)
      .eq('organizer_events.organizer_id', organizerId)
      .eq('organizer_events.id', tournamentId)
      .not('status', 'eq', 'cancelled')
      .order('registered_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch registrations', details: error.message },
        { status: 500 },
      );
    }

    // Enrich with user data
    let result = registrations ?? [];

    const userIds = result
      .map((r) => r.user_id)
      .filter((id): id is string => id !== null);

    let userMap: Record<string, { display_name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, display_name, email')
        .in('id', userIds);
      if (users) {
        userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      }
    }

    const enriched = result.map((reg) => {
      const user = reg.user_id ? userMap[reg.user_id] : null;
      return {
        id: reg.id,
        eventId: reg.event_id,
        userId: reg.user_id,
        displayName: user?.display_name ?? reg.guest_name ?? reg.guest_email ?? 'Unknown',
        email: user?.email ?? reg.guest_email ?? '',
        status: reg.status,
        paymentStatus: reg.payment_status,
        amountPaidCents: reg.amount_paid_cents,
        registeredAt: reg.registered_at,
        checkedInAt: reg.checked_in_at,
        checkedInByUserId: reg.checked_in_by_user_id,
        notes: reg.notes ?? '',
        dietaryRestrictions: reg.dietary_restrictions ?? '',
        teamName: reg.team_name ?? '',
        handicapAtRegistration: reg.handicap_at_registration,
        marketingOptIn: reg.marketing_opt_in,
        eventTitle: (reg.organizer_events as any)?.title,
        eventStartTime: (reg.organizer_events as any)?.start_time,
      };
    });

    return NextResponse.json({ registrations: enriched }, { status: 200 });
  });
}

// PATCH /api/operator/tournaments/[id]/checkin — update check-in status or notes
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId } = await params;
  return withOperatorAuth(request, async (ctx) => {
    const supabase = (await import('@/lib/supabase')).createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { registrationId, action, notes, checkedInByUserId } = body;

    if (!registrationId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: registrationId, action' },
        { status: 400 },
      );
    }

    // Verify this registration belongs to the operator's tournament
    const { data: existing } = await supabase
      .from('organizer_event_registrations')
      .select('id, organizer_events!inner(organizer_id)')
      .eq('id', registrationId)
      .eq('organizer_events.id', tournamentId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Registration not found or access denied' },
        { status: 404 },
      );
    }

    const updates: Record<string, unknown> = {};
    const now = new Date().toISOString();

    if (action === 'check_in') {
      updates.status = 'checked_in';
      updates.checked_in_at = now;
      updates.checked_in_by_user_id = checkedInByUserId ?? ctx.session.userId;
    } else if (action === 'undo_check_in') {
      updates.status = 'confirmed';
      updates.checked_in_at = null;
      updates.checked_in_by_user_id = null;
    } else if (action === 'no_show') {
      updates.status = 'no_show';
    } else if (action === 'update_notes') {
      updates.notes = notes ?? '';
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('organizer_event_registrations')
      .update(updates)
      .eq('id', registrationId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update registration', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ registration: data }, { status: 200 });
  });
}
