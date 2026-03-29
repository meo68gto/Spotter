import { NextRequest, NextResponse } from 'next/server'
import { withOperatorAuth } from '@/lib/operator/auth'
import { createServerClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string; upsellId: string }>
}

// PATCH /api/operator/tournaments/[id]/upsells/[upsellId]
// Update an upsell product
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId, upsellId } = await params
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

    // Verify upsell belongs to this tournament
    const { data: upsell, error: upsellError } = await supabase
      .from('upsells')
      .select('id')
      .eq('id', upsellId)
      .eq('tournament_id', tournamentId)
      .maybeSingle()

    if (upsellError || !upsell) {
      return NextResponse.json({ error: 'Upsell not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name, description, price_cents, max_quantity, is_active } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (price_cents !== undefined) updates.price_cents = price_cents
    if (max_quantity !== undefined) updates.max_quantity = max_quantity
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await supabase
      .from('upsells')
      .update(updates)
      .eq('id', upsellId)
      .select()
      .single()

    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json(data)
  })
}
