import { NextRequest, NextResponse } from 'next/server'
import { withOperatorAuth } from '@/lib/operator/auth'
import { createServerClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string; vendorId: string }>
}

// PATCH /api/operator/tournaments/[id]/vendors/[vendorId]
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId, vendorId } = await params
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
      .update(body)
      .eq('id', vendorId)
      .eq('tournament_id', tournamentId)
      .select()
      .single()

    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json(data)
  })
}

// DELETE /api/operator/tournaments/[id]/vendors/[vendorId]
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId, vendorId } = await params
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient()

    const { data: tournament, error: tourneyError } = await supabase
      .from('organizer_events')
      .select('id')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .maybeSingle()

    if (tourneyError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', vendorId)
      .eq('tournament_id', tournamentId)

    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json({ success: true })
  })
}
