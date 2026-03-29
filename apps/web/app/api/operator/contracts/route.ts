import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/operator/contracts — List all contracts for operator's sponsors
export async function GET(req: NextRequest) {
  return withOperatorAuth(req, async ({ organizerId, session }) => {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('sponsor_contracts')
      .select(`
        *,
        sponsor:sponsors!inner(id, name, tier),
        tournament:organizer_events(id, name, start_time)
      `)
      .eq('sponsors.organizer_id', organizerId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  });
}

// POST /api/operator/contracts — Create a new contract
export async function POST(req: NextRequest) {
  return withOperatorAuth(req, async ({ organizerId, session }) => {
    const body = await req.json();
    const { sponsor_id, tournament_id, name, description, value_cents, currency, start_date, end_date } = body;

    if (!sponsor_id || !name) {
      return NextResponse.json({ error: 'sponsor_id and name are required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify sponsor belongs to this operator
    const { data: sponsor } = await supabase
      .from('sponsors')
      .select('id')
      .eq('id', sponsor_id)
      .eq('organizer_id', organizerId)
      .single();

    if (!sponsor) {
      return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
    }

    // Get member id for created_by
    const { data: member } = await supabase
      .from('organizer_members')
      .select('id')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    const { data, error } = await supabase
      .from('sponsor_contracts')
      .insert({
        sponsor_id,
        tournament_id: tournament_id || null,
        name,
        description: description || null,
        value_cents: value_cents ?? 0,
        currency: currency ?? 'usd',
        start_date: start_date || null,
        end_date: end_date || null,
        status: 'draft',
        created_by: member?.id || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}
