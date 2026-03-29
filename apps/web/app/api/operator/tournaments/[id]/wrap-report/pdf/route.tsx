import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { withOperatorAuth } from '@/lib/operator/auth';
import { WrapReportPDF } from '@/components/(operator)/WrapReportPDF';
import type { WrapReportData } from '@/components/(operator)/WrapReportPDF';

// --- Typed Supabase response interfaces ---

interface SponsorRow {
  name: string | null
  tier: string | null
}

interface SponsorFulfillmentRow {
  id: string
  sponsor_contract_id: string
  description: string | null
  status: string | null
  delivery_date: string | null
  created_at: string
  updated_at: string
}

interface SponsorContractRow {
  id: string
  sponsor_id: string
  tournament_id: string | null
  name: string
  description: string | null
  value_cents: number | null
  currency: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
  sponsors: SponsorRow | SponsorRow[] | null
  sponsor_fulfillment: SponsorFulfillmentRow[] | SponsorFulfillmentRow | null
}

interface RegistrationRow {
  status: string | null
  payment_status: string | null
  amount_paid_cents: number | null
}

interface ContestRow {
  id: string
  tournament_id: string
  name: string | null
  contest_type: string | null
  prize_description: string | null
  prize_value_cents: number | null
  status: string | null
  winner_id: string | null
  created_at: string
  updated_at: string
}

// Type guard for sponsor_fulfillment field
function asFulfillmentArray(
  raw: SponsorFulfillmentRow[] | SponsorFulfillmentRow | null,
): SponsorFulfillmentRow[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: tournamentId } = await params;

  return withOperatorAuth(request, async ({ organizerId }) => {
    const supabase = (await import('@/lib/supabase')).createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // 1. Fetch tournament details
    const { data: tournament, error: tourneyError } = await supabase
      .from('organizer_events')
      .select('*')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .single();

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // 2. Fetch organizer account for name
    const { data: organizer } = await supabase
      .from('organizer_accounts')
      .select('name, email')
      .eq('id', organizerId)
      .single();

    // 3. Fetch registrations
    const { data: registrations } = await supabase
      .from('organizer_event_registrations')
      .select('status, payment_status, amount_paid_cents')
      .eq('event_id', tournamentId);

    const regRows = (registrations ?? []) as RegistrationRow[]
    const totalRegistrations = regRows.length
    const paidRegistrations = regRows.filter((r) => r.payment_status === 'paid').length
    const waitlistedCount = regRows.filter((r) => r.status === 'waitlisted').length
    const checkedInCount = regRows.filter((r) => r.status === 'checked_in').length
    const noShowCount = regRows.filter((r) => r.status === 'no_show').length
    const cancelledCount = regRows.filter((r) => r.status === 'cancelled').length
    const registrationRevenueCents = regRows.reduce(
      (sum, r) => (r.payment_status === 'paid' ? sum + (r.amount_paid_cents ?? 0) : sum),
      0,
    )

    const checkInRate =
      totalRegistrations > 0
        ? Math.round((checkedInCount / totalRegistrations) * 100)
        : 0

    const platformFeeCents = Math.round(registrationRevenueCents * 0.1)

    // 4. Fetch sponsor contracts + fulfillment
    const { data: contracts } = await supabase
      .from('sponsor_contracts')
      .select(
        `
        id,
        value_cents,
        sponsors:sponsors(name, tier),
        sponsor_fulfillment(*)
      `,
      )
      .eq('tournament_id', tournamentId)
      .eq('status', 'active')

    const contractRows = (contracts ?? []) as SponsorContractRow[]
    const sponsors: WrapReportData['sponsors'] = contractRows.map((c) => {
      const sponsorData = Array.isArray(c.sponsors) ? c.sponsors[0] : c.sponsors
      const safeSponsor = sponsorData as SponsorRow | null
      const fulfillRows = asFulfillmentArray(c.sponsor_fulfillment)
      return {
        sponsorName: safeSponsor?.name ?? 'Unknown',
        tier: safeSponsor?.tier ?? 'bronze',
        contractValueCents: c.value_cents ?? 0,
        deliverables: fulfillRows.map((f) => ({
          description: f.description ?? '',
          status: (f.status ?? 'pending') as 'pending' | 'in_progress' | 'completed' | 'missed',
          deliveryDate: f.delivery_date ?? undefined,
        })),
      }
    })

    const sponsorRevenueCents = contractRows.reduce(
      (sum, c) => sum + (c.value_cents ?? 0),
      0,
    )

    // 5. Fetch contests
    const { data: dbContests } = await supabase
      .from('contests')
      .select('*')
      .eq('tournament_id', tournamentId);

    const contestRows = (dbContests ?? []) as ContestRow[]
    const contests: WrapReportData['contests'] = contestRows.map((c) => ({
      contestName: c.name ?? '',
      contestType: c.contest_type ?? 'other',
      winnerName: undefined,
      prizeDescription: c.prize_description ?? undefined,
      prizeValueCents: c.prize_value_cents ?? undefined,
      status: (c.status ?? 'open') as 'open' | 'closed' | 'cancelled',
    }))

    // 6. Assemble wrap report data
    const wrapData: WrapReportData = {
      tournamentName: tournament.name,
      eventDate: tournament.start_time ?? tournament.created_at,
      courseName: tournament.course_name ?? 'Unknown Course',
      organizerName: organizer?.name ?? 'Unknown Organizer',
      operatorEmail: organizer?.email ?? '',
      totalRegistrations,
      paidRegistrations,
      waitlistedCount,
      checkedInCount,
      noShowCount,
      cancelledCount,
      checkInRate,
      registrationRevenueCents,
      sponsorRevenueCents,
      totalRevenueCents: registrationRevenueCents + sponsorRevenueCents,
      platformFeeCents,
      netRevenueCents: registrationRevenueCents - platformFeeCents + sponsorRevenueCents,
      sponsors,
      contests,
      photoUrls: undefined, // Photos would be uploaded separately
    };

    // 7. Render PDF
    try {
      const buffer = await renderToBuffer(<WrapReportPDF data={wrapData} />);

      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="wrap-report-${tournament.name.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (pdfError) {
      console.error('[wrap-report/pdf] PDF render error:', pdfError);
      return NextResponse.json(
        { error: 'PDF generation failed', details: String(pdfError) },
        { status: 500 },
      );
    }
  });
}
