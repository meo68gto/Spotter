import { NextRequest, NextResponse } from 'next/server'
import { withOperatorAuth } from '@/lib/operator/auth'
import { createServerClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/operator/tournaments/[id]/fulfillment
// Returns sponsor contracts + fulfillment data for a tournament
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

    // Fetch tournament metadata
    const { data: tourneyData } = await supabase
      .from('organizer_events')
      .select('id, title, name, start_time')
      .eq('id', tournamentId)
      .maybeSingle()

    // Fetch contracts for this tournament with sponsor and fulfillment data
    const { data: contracts, error: contractsError } = await supabase
      .from('sponsor_contracts')
      .select(`
        id,
        name,
        description,
        status,
        value_cents,
        currency,
        start_date,
        end_date,
        signed_at,
        created_at,
        sponsor:sponsor_id (
          id,
          name,
          tier,
          logo_url,
          contact_name,
          contact_email
        ),
        fulfillment_items: sponsor_fulfillment (
          id,
          description,
          delivery_date,
          status,
          notes,
          created_at,
          updated_at
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true })

    if (contractsError) {
      return NextResponse.json(
        { error: 'Failed to fetch fulfillment data', details: contractsError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ contracts: contracts ?? [], tournament: tourneyData }, { status: 200 })
  })
}

// PATCH /api/operator/tournaments/[id]/fulfillment
// Update fulfillment item status and/or notes
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

    const body = await req.json()
    const { fulfillmentId, status, notes } = body

    if (!fulfillmentId) {
      return NextResponse.json({ error: 'Missing fulfillmentId' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updates.status = status
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabase
      .from('sponsor_fulfillment')
      .update(updates)
      .eq('id', fulfillmentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update fulfillment', details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json(data, { status: 200 })
  })
}
