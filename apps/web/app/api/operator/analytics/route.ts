import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/operator/analytics — tournament and revenue analytics
export async function GET(
  _request: NextRequest,
): Promise<Response> {
  return withOperatorAuth(_request, async ({ organizerId }) => {
    const supabase = createServerClient();

    // 1. Overall stats (parallel fetches)
    const [
      tournamentsResult,
      sponsorsResult,
    ] = await Promise.all([
      supabase
        .from('organizer_events')
        .select('id, status, registration_count, waitlist_count')
        .eq('organizer_id', organizerId),
      supabase
        .from('sponsors')
        .select('id, is_active, sponsor_contracts(value_cents, status)')
        .eq('organizer_id', organizerId)
        .eq('is_active', true),
    ]);

    if (tournamentsResult.error) {
      return NextResponse.json({ error: tournamentsResult.error.message }, { status: 500 });
    }

    const tournaments = tournamentsResult.data ?? [];
    const sponsors = sponsorsResult.data ?? [];

    // 2. Compute aggregates
    const byStatus = tournaments.reduce<Record<string, number>>((acc, t) => {
      const s = t.status ?? 'draft';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});

    const totalRegistrations = tournaments.reduce((s, t) => s + (t.registration_count ?? 0), 0);
    const totalWaitlist = tournaments.reduce((s, t) => s + (t.waitlist_count ?? 0), 0);

    // 3. Recent 12 months registrations trend
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data: recentRegs } = await supabase
      .from('organizer_event_registrations')
      .select('registered_at')
      .in('event_id', tournaments.map(t => t.id))
      .gte('registered_at', twelveMonthsAgo.toISOString());

    // Build month-by-month trend
    const monthLabels: string[] = [];
    const monthCounts: number[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthLabels.push(label);
      const count = (recentRegs ?? [])
        .filter(r => {
          const regDate = new Date(r.registered_at);
          return regDate.getFullYear() === d.getFullYear() && regDate.getMonth() === d.getMonth();
        }).length;
      monthCounts.push(count);
    }

    // 4. Sponsor revenue
    const totalSponsorRevenue = sponsors.reduce<number>((s, sp) => {
      const contracts = Array.isArray(sp.sponsor_contracts) ? sp.sponsor_contracts : [];
      return s + contracts
        .filter((c: any) => c.status === 'active')
        .reduce((cs: number, c: any) => cs + (c.value_cents ?? 0), 0);
    }, 0);

    // 5. Top tournaments by registrations (all time)
    const topTournaments = [...tournaments]
      .sort((a, b) => (b.registration_count ?? 0) - (a.registration_count ?? 0))
      .slice(0, 5)
      .map(t => ({ id: t.id, status: t.status, registrations: t.registration_count ?? 0 }));

    // 6. Registration by status across all tournaments
    const { data: allRegistrations } = await supabase
      .from('organizer_event_registrations')
      .select('status, payment_status')
      .in('event_id', tournaments.map(t => t.id));

    const regByStatus = (allRegistrations ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.status ?? 'unknown'] = (acc[r.status ?? 'unknown'] ?? 0) + 1;
      return acc;
    }, {});

    const paymentSummary = (allRegistrations ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.payment_status ?? 'unknown'] = (acc[r.payment_status ?? 'unknown'] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      data: {
        totalTournaments: tournaments.length,
        totalRegistrations,
        totalWaitlist,
        totalSponsors: sponsors.length,
        totalSponsorRevenueCents: totalSponsorRevenue,
        byTournamentStatus: byStatus,
        registrationTrend: { labels: monthLabels, data: monthCounts },
        topTournaments,
        registrationsByStatus: regByStatus,
        paymentsByStatus: paymentSummary,
      },
    });
  });
}
