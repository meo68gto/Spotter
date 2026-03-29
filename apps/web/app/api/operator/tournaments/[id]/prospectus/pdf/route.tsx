import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { withOperatorAuth } from '@/lib/operator/auth'
import { createServerClient } from '@/lib/supabase/server'
import { ProspectusPDF } from '@/components/(operator)/ProspectusPDF'

// Type definitions
interface SponsorTierRow {
  id: string
  name: string
  price_cents: number | null
  description: string | null
  deliverables: string[] | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: tournamentId } = await params

  return withOperatorAuth(request, async ({ organizerId }) => {
    const supabase = createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    // 1. Verify tournament and fetch details
    const { data: tournament, error: tourneyError } = await supabase
      .from('organizer_events')
      .select('id, name, title, course_name, start_time, description')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .single()

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // 2. Fetch organizer info
    const { data: organizer } = await supabase
      .from('organizer_accounts')
      .select('name, email')
      .eq('id', organizerId)
      .single()

    // 3. Fetch sponsor tiers (upsells used as prospectus tiers)
    const { data: tiers, error: tiersError } = await supabase
      .from('upsells')
      .select('id, name, price_cents, description, deliverables')
      .eq('tournament_id', tournamentId)

    if (tiersError) {
      return NextResponse.json(
        { error: 'Failed to load sponsor tiers' },
        { status: 500 },
      )
    }

    // 4. Fetch registration stats for reach estimate
    const { data: registrations } = await supabase
      .from('organizer_event_registrations')
      .select('id', { count: 'exact' })
      .eq('event_id', tournamentId)

    const expectedPlayers = registrations?.length ?? 0
    const reach = Math.round(expectedPlayers * 2.5) // players + spectators estimate

    // 5. Assemble data for PDF
    const tournamentName = tournament.name ?? tournament.title ?? 'Tournament'
    const tournamentDate = tournament.start_time
      ? new Date(tournament.start_time).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'TBD'
    const tournamentLocation = tournament.course_name ?? 'TBD'

    const sponsorTiers = (tiers ?? []).map((t: SponsorTierRow) => ({
      name: t.name,
      price: Math.round((t.price_cents ?? 0) / 100),
      deliverables: Array.isArray(t.deliverables)
        ? t.deliverables
        : t.description
          ? [t.description]
          : [],
    }))

    // Fallback tiers if none exist
    if (sponsorTiers.length === 0) {
      sponsorTiers.push(
        { name: 'Bronze', price: 500, deliverables: ['Logo on website', 'Social media mention'] },
        { name: 'Silver', price: 1000, deliverables: ['Logo on website', 'Social media mention', 'Tee sign'] },
        { name: 'Gold', price: 2500, deliverables: ['Logo on website', 'Social media mention', 'Tee sign', ' Hole sponsorship'] },
      )
    }

    const pdfData = {
      tournament: {
        name: tournamentName,
        date: tournamentDate,
        location: tournamentLocation,
        description: tournament.description ?? '',
      },
      operator: {
        name: organizer?.name ?? 'Tournament Organizer',
        logo: undefined,
      },
      tiers: sponsorTiers,
      stats: {
        expectedPlayers,
        reach,
      },
    }

    // 6. Render PDF
    try {
      const buffer = await renderToBuffer(<ProspectusPDF {...pdfData} />)
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="prospectus-${tournamentName.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
          'Cache-Control': 'private, max-age=3600',
        },
      })
    } catch (pdfErr) {
      console.error('[prospectus/pdf] Render error:', pdfErr)
      return NextResponse.json(
        { error: 'PDF generation failed', details: String(pdfErr) },
        { status: 500 },
      )
    }
  })
}
