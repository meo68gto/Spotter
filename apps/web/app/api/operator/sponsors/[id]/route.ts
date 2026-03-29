import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';

// Typed Supabase response interfaces
interface SponsorFulfillmentRow {
  id: string;
  contract_id: string;
  description: string | null;
  status: string | null;
  delivery_date: string | null;
  created_at: string;
  updated_at: string;
}

interface SponsorContractRow {
  id: string;
  sponsor_id: string;
  tournament_id: string | null;
  name: string;
  description: string | null;
  value_cents: number | null;
  currency: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/operator/sponsors/[id] — Get single sponsor with contracts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient();

    const { data: sponsor, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('id', id)
      .eq('organizer_id', organizerId)
      .single();

    if (error || !sponsor) {
      return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
    }

    const { data: contracts } = await supabase
      .from('sponsor_contracts')
      .select('*')
      .eq('sponsor_id', id)
      .order('created_at', { ascending: false });

    const contractRows = (contracts ?? []) as SponsorContractRow[];
    const contractIds = contractRows.map((c) => c.id);

    let fulfillment: SponsorFulfillmentRow[] = [];
    if (contractIds.length) {
      const { data } = await supabase
        .from('sponsor_fulfillment')
        .select('*, contracts:sponsor_contracts(description)')
        .in('contract_id', contractIds);
      fulfillment = (data as SponsorFulfillmentRow[] | null) ?? [];
    }

    return NextResponse.json({ data: { sponsor, contracts: contractRows, fulfillment } });
  });
}

// PATCH /api/operator/sponsors/[id] — Update sponsor
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withOperatorAuth(req, async ({ organizerId }) => {
    const body = await req.json();
    const supabase = createServerClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from('sponsors')
      .select('id')
      .eq('id', id)
      .eq('organizer_id', organizerId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('sponsors')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 400 });
    }

    return NextResponse.json({ data });
  });
}

// DELETE /api/operator/sponsors/[id] — Soft delete (set is_active = false)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('sponsors')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organizer_id', organizerId);

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
