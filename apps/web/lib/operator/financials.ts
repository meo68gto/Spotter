import { createServerClient } from '@/lib/supabase/server';

type EventRow = {
  id: string;
};

type RegistrationRow = {
  amount_paid_cents: number | null;
};

type SponsorContractRow = {
  value_cents: number | null;
};

type PayoutRow = {
  amount_cents: number | null;
  status: 'pending' | 'processing' | 'paid' | 'failed';
};

export async function getAvailablePayoutBalanceCents(
  organizerId: string,
  tournamentId?: string | null,
): Promise<number> {
  const supabase = createServerClient();

  const eventIds = tournamentId
    ? [tournamentId]
    : (
        (
          await supabase
            .from('organizer_events')
            .select('id')
            .eq('organizer_id', organizerId)
        ).data ?? []
      ).map((event) => (event as EventRow).id);

  if (eventIds.length === 0) return 0;

  const payoutsQuery = supabase
    .from('payouts')
    .select('amount_cents, status')
    .eq('organizer_id', organizerId)
    .in('status', ['pending', 'processing', 'paid']);

  const [registrationsResult, sponsorContractsResult, payoutsResult] = await Promise.all([
    supabase
      .from('organizer_event_registrations')
      .select('amount_paid_cents')
      .in('event_id', eventIds)
      .eq('payment_status', 'paid'),
    supabase
      .from('sponsor_contracts')
      .select('value_cents')
      .in('tournament_id', eventIds)
      .eq('status', 'active'),
    tournamentId ? payoutsQuery.eq('tournament_id', tournamentId) : payoutsQuery,
  ]);

  if (registrationsResult.error) {
    throw new Error(`Failed to load paid registrations: ${registrationsResult.error.message}`);
  }
  if (sponsorContractsResult.error) {
    throw new Error(`Failed to load sponsor revenue: ${sponsorContractsResult.error.message}`);
  }
  if (payoutsResult.error) {
    throw new Error(`Failed to load payout history: ${payoutsResult.error.message}`);
  }

  const registrationRevenueCents = ((registrationsResult.data ?? []) as RegistrationRow[]).reduce(
    (sum, row) => sum + (row.amount_paid_cents ?? 0),
    0,
  );
  const sponsorRevenueCents = ((sponsorContractsResult.data ?? []) as SponsorContractRow[]).reduce(
    (sum, row) => sum + (row.value_cents ?? 0),
    0,
  );
  const platformFeeCents = Math.floor(registrationRevenueCents * 0.1);
  const netRevenueCents = registrationRevenueCents + sponsorRevenueCents - platformFeeCents;

  const { paidPayoutsCents, pendingPayoutsCents } = ((payoutsResult.data ?? []) as PayoutRow[]).reduce(
    (acc, row) => {
      const amount = row.amount_cents ?? 0;
      if (row.status === 'paid') acc.paidPayoutsCents += amount;
      if (row.status === 'pending' || row.status === 'processing') acc.pendingPayoutsCents += amount;
      return acc;
    },
    { paidPayoutsCents: 0, pendingPayoutsCents: 0 },
  );

  return Math.max(0, netRevenueCents - paidPayoutsCents - pendingPayoutsCents);
}
