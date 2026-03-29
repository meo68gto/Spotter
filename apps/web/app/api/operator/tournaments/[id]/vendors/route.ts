import { NextRequest, NextResponse } from 'next/server'
import { withOperatorAuth } from '@/lib/operator/auth'
import { createServerClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/operator/tournaments/[id]/vendors
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
      .from('vendors')
      .select('*')
      .eq('tournament_id', tournamentId)

    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json(data ?? [])
  })
}

// POST /api/operator/tournaments/[id]/vendors
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

    const body = await req.json()
    const { data, error } = await supabase
      .from('vendors')
      .insert({ ...body, tournament_id: tournamentId })
      .select()
      .single()

    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json(data)
  })
}
