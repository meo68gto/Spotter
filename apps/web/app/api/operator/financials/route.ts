import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@spotter/auth/web';
import { createServerClient } from '@/lib/supabase/server';

type TournamentRow = {
  id: string;
  name: string;
  event_date: string;
  price_cents: number | null;
  max_participants: number | null;
  current_participants: number | null;
};

type RegistrationRow = {
  event_id: string;
  amount_paid_cents: number | null;
};

type SponsorContractRow = {
  tournament_id: string;
  value_cents: number | null;
};

type PayoutRow = {
  tournament_id: string | null;
  amount_cents: number | null;
  status: 'pending' | 'processing' | 'paid' | 'failed';
};

const mockFinancials = [
  {
    tournament_id: 'evt-1',
    tournament_name: 'Spring Championship Tournament',
    event_date: '2024-04-15',
    paid_registrations: 89,
    registration_revenue_cents: 445000,
    sponsor_revenue_cents: 500000,
    platform_fees_cents: 44500,
    net_revenue_cents: 900500,
    payouts_cents: 0,
    pending_payout_cents: 0,
  },
  {
    tournament_id: 'evt-2',
    tournament_name: 'Corporate Team Building Scramble',
    event_date: '2024-04-22',
    paid_registrations: 0,
    registration_revenue_cents: 0,
    sponsor_revenue_cents: 250000,
    platform_fees_cents: 0,
    net_revenue_cents: 250000,
    payouts_cents: 0,
    pending_payout_cents: 0,
  },
];

const mockTournaments = [
  { id: 'evt-1', name: 'Spring Championship Tournament', event_date: '2024-04-15', price_cents: 5000, max_participants: 120, current_participants: 89 },
  { id: 'evt-2', name: 'Corporate Team Building Scramble', event_date: '2024-04-22', price_cents: 7500, max_participants: 80, current_participants: 0 },
  { id: 'evt-3', name: 'Charity Golf Fundraiser', event_date: '2024-05-10', price_cents: 15000, max_participants: 144, current_participants: 0 },
];

function getMockResponse(reason: string) {
  return NextResponse.json({
    data: mockFinancials,
    tournaments: mockTournaments,
    source: 'mock',
    warning: reason,
  });
}

export async function GET(_req: NextRequest) {
  let session = null;
  let supabase = null;

  try {
    session = await getSessionFromCookie();
    supabase = createServerClient();
  } catch {
    return getMockResponse('Financial reporting is running in demo mode.');
  }

  if (!session || !supabase) {
    return getMockResponse('Financial reporting is running in demo mode.');
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organizer_members')
    .select('organizer_id')
    .eq('user_id', session.userId)
    .eq('is_active', true)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: 'Failed to load organizer membership.' }, { status: 500 });
  }

  if (!membership?.organizer_id) {
    return getMockResponse('No organizer membership was found for this session.');
  }

  const organizerId = membership.organizer_id;

  const { data: tournaments, error: tournamentsError } = await supabase
    .from('organizer_events')
    .select('id, name, event_date, price_cents, max_participants, current_participants')
    .eq('organizer_id', organizerId)
    .order('event_date', { ascending: false })
    .limit(50);

  if (tournamentsError) {
    return NextResponse.json({ error: 'Failed to load organizer events.' }, { status: 500 });
  }

  const tournamentRows = ((tournaments ?? []) as TournamentRow[]).map((row) => ({
    ...row,
    price_cents: row.price_cents ?? 0,
    max_participants: row.max_participants ?? 0,
    current_participants: row.current_participants ?? 0,
  }));

  if (tournamentRows.length === 0) {
    return NextResponse.json({ data: [], tournaments: [], source: 'live' });
  }

  const eventIds = tournamentRows.map((row) => row.id);

  const [registrationsResult, sponsorContractsResult, payoutsResult] = await Promise.all([
    supabase
      .from('organizer_event_registrations')
      .select('event_id, amount_paid_cents')
      .in('event_id', eventIds)
      .eq('payment_status', 'paid'),
    supabase
      .from('sponsor_contracts')
      .select('tournament_id, value_cents')
      .in('tournament_id', eventIds)
      .eq('status', 'active'),
    supabase
      .from('payouts')
      .select('tournament_id, amount_cents, status')
      .eq('organizer_id', organizerId)
      .in('status', ['pending', 'processing', 'paid']),
  ]);

  if (registrationsResult.error) {
    return NextResponse.json({ error: 'Failed to load paid registrations.' }, { status: 500 });
  }
  if (sponsorContractsResult.error) {
    return NextResponse.json({ error: 'Failed to load sponsor revenue.' }, { status: 500 });
  }
  if (payoutsResult.error) {
    return NextResponse.json({ error: 'Failed to load payouts.' }, { status: 500 });
  }

  const registrationTotals = new Map<string, { paidRegistrations: number; registrationRevenueCents: number }>();
  for (const row of (registrationsResult.data ?? []) as RegistrationRow[]) {
    const current = registrationTotals.get(row.event_id) ?? { paidRegistrations: 0, registrationRevenueCents: 0 };
    current.paidRegistrations += 1;
    current.registrationRevenueCents += row.amount_paid_cents ?? 0;
    registrationTotals.set(row.event_id, current);
  }

  const sponsorTotals = new Map<string, number>();
  for (const row of (sponsorContractsResult.data ?? []) as SponsorContractRow[]) {
    sponsorTotals.set(row.tournament_id, (sponsorTotals.get(row.tournament_id) ?? 0) + (row.value_cents ?? 0));
  }

  const payoutTotals = new Map<string, { paid: number; pending: number }>();
  for (const row of (payoutsResult.data ?? []) as PayoutRow[]) {
    if (!row.tournament_id) continue;
    const current = payoutTotals.get(row.tournament_id) ?? { paid: 0, pending: 0 };
    const amount = row.amount_cents ?? 0;
    if (row.status === 'paid') current.paid += amount;
    if (row.status === 'pending' || row.status === 'processing') current.pending += amount;
    payoutTotals.set(row.tournament_id, current);
  }

  const financials = tournamentRows.map((row) => {
    const registration = registrationTotals.get(row.id) ?? { paidRegistrations: 0, registrationRevenueCents: 0 };
    const sponsorRevenueCents = sponsorTotals.get(row.id) ?? 0;
    const platformFeesCents = Math.floor(registration.registrationRevenueCents * 0.1);
    const payout = payoutTotals.get(row.id) ?? { paid: 0, pending: 0 };

    return {
      tournament_id: row.id,
      tournament_name: row.name,
      event_date: row.event_date,
      paid_registrations: registration.paidRegistrations,
      registration_revenue_cents: registration.registrationRevenueCents,
      sponsor_revenue_cents: sponsorRevenueCents,
      platform_fees_cents: platformFeesCents,
      net_revenue_cents: registration.registrationRevenueCents + sponsorRevenueCents - platformFeesCents,
      payouts_cents: payout.paid,
      pending_payout_cents: payout.pending,
    };
  });

  return NextResponse.json({ data: financials, tournaments: tournamentRows, source: 'live' });
}
