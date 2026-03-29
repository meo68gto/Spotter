import { NextRequest, NextResponse } from 'next/server'
import { withOperatorAuth } from '@/lib/operator/auth'
import { createServerClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/operator/tournaments/[id]/pairings
export async function GET(
  req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId } = await params
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient()

    // Verify tournament belongs to this organizer
    const { data: tournament, error: tourneyError } = await supabase
      .from('organizer_events')
      .select('id')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .maybeSingle()

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('flights')
      .select('*, players:flight_players(player_id, position, users:player_id(*))')
      .eq('tournament_id', tournamentId)
      .order('tee_time', { ascending: true })

    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json(data ?? [])
  })
}

// PATCH /api/operator/tournaments/[id]/pairings — move player between flights
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId } = await params
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient()

    // Verify tournament belongs to this organizer
    const { data: tournament, error: tourneyError } = await supabase
      .from('organizer_events')
      .select('id')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .maybeSingle()

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    let body: { playerId?: string; fromFlightId?: string; toFlightId?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { playerId, fromFlightId, toFlightId } = body

    if (!playerId || !fromFlightId || !toFlightId) {
      return NextResponse.json(
        { error: 'Missing required fields: playerId, fromFlightId, toFlightId' },
        { status: 400 },
      )
    }

    // Verify both flights belong to this tournament
    const { data: fromFlight, error: fromError } = await supabase
      .from('flights')
      .select('id')
      .eq('id', fromFlightId)
      .eq('tournament_id', tournamentId)
      .maybeSingle()

    if (fromError || !fromFlight) {
      return NextResponse.json({ error: 'Source flight not found' }, { status: 404 })
    }

    const { data: toFlight, error: toError } = await supabase
      .from('flights')
      .select('id')
      .eq('id', toFlightId)
      .eq('tournament_id', tournamentId)
      .maybeSingle()

    if (toError || !toFlight) {
      return NextResponse.json({ error: 'Target flight not found' }, { status: 404 })
    }

    // Remove player from source flight
    const { error: removeError } = await supabase
      .from('flight_players')
      .delete()
      .eq('flight_id', fromFlightId)
      .eq('player_id', playerId)

    if (removeError) {
      return NextResponse.json({ error: removeError }, { status: 500 })
    }

    // Add player to target flight
    const { error: addError } = await supabase
      .from('flight_players')
      .insert({ flight_id: toFlightId, player_id: playerId })

    if (addError) {
      return NextResponse.json({ error: addError }, { status: 500 })
    }

    // Return updated flight data
    const { data, error } = await supabase
      .from('flights')
      .select('*, players:flight_players(player_id, position, users:player_id(*))')
      .eq('tournament_id', tournamentId)
      .order('tee_time', { ascending: true })

    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json(data ?? [])
  })
}

// POST /api/operator/tournaments/[id]/pairings — create a new flight
export async function POST(
  req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId } = await params
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient()

    // Verify tournament belongs to this organizer
    const { data: tournament, error: tourneyError } = await supabase
      .from('organizer_events')
      .select('id')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .maybeSingle()

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    let body: { flight_name?: string; tee_time?: string; starting_hole?: number; course_id?: string; notes?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { flight_name, tee_time, starting_hole, course_id, notes } = body

    if (!flight_name || !tee_time) {
      return NextResponse.json(
        { error: 'Missing required fields: flight_name, tee_time' },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('flights')
      .insert({
        tournament_id: tournamentId,
        flight_name,
        tee_time,
        starting_hole: starting_hole ?? 1,
        course_id,
        notes,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json(data)
  })
}

// DELETE /api/operator/tournaments/[id]/pairings — delete a flight
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId } = await params
  const { searchParams } = new URL(req.url)
  const flightId = searchParams.get('flightId')

  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient()

    if (!flightId) {
      return NextResponse.json({ error: 'Missing flightId query param' }, { status: 400 })
    }

    // Verify tournament belongs to this organizer
    const { data: tournament, error: tourneyError } = await supabase
      .from('organizer_events')
      .select('id')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .maybeSingle()

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Verify flight belongs to this tournament
    const { data: flight, error: flightError } = await supabase
      .from('flights')
      .select('id')
      .eq('id', flightId)
      .eq('tournament_id', tournamentId)
      .maybeSingle()

    if (flightError || !flight) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 })
    }

    // Cascade delete removes flight_players via FK
    const { error: deleteError } = await supabase
      .from('flights')
      .delete()
      .eq('id', flightId)
      .eq('tournament_id', tournamentId)

    if (deleteError) return NextResponse.json({ error: deleteError }, { status: 500 })
    return NextResponse.json({ success: true })
  })
}
