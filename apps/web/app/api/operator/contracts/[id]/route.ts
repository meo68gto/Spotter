import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';

// PATCH /api/operator/contracts/[id] — Update contract
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient();

    // Verify ownership via sponsor inner join
    const { data: existing } = await supabase
      .from('sponsor_contracts')
      .select('id, sponsors!inner(organizer_id)')
      .eq('id', id)
      .single();

    if (
      !existing ||
      !Array.isArray(existing.sponsors) ||
      existing.sponsors[0]?.organizer_id !== organizerId
    ) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('sponsor_contracts')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 400 });
    }

    return NextResponse.json({ data });
  });
}

// POST /api/operator/contracts/[id]/fulfillment — Add fulfillment item
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withOperatorAuth(req, async ({ organizerId }) => {
    const body = await req.json();
    const { description, delivery_date } = body;

    if (!description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify contract ownership via sponsor inner join
    const { data: contract } = await supabase
      .from('sponsor_contracts')
      .select('id, sponsors!inner(organizer_id)')
      .eq('id', id)
      .single();

    if (
      !contract ||
      !Array.isArray(contract.sponsors) ||
      contract.sponsors[0]?.organizer_id !== organizerId
    ) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('sponsor_fulfillment')
      .insert({
        contract_id: id,
        description,
        delivery_date: delivery_date || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}
