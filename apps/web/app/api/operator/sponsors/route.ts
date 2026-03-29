import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/operator/sponsors — List all sponsors for operator's account
export async function GET(req: NextRequest) {
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('sponsors')
      .select(`
        id,
        name,
        contact_name,
        contact_email,
        tier,
        is_active,
        logo_url,
        website_url,
        notes,
        created_at,
        sponsor_contracts(count)
      `)
      .eq('organizer_id', organizerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// POST /api/operator/sponsors — Create a new sponsor
export async function POST(req: NextRequest) {
  return withOperatorAuth(req, async ({ organizerId }) => {
    const body = await req.json();
    const { name, contact_name, contact_email, contact_phone, website_url, tier, notes, logo_url } = body;

    if (!name || !contact_email) {
      return NextResponse.json({ error: 'name and contact_email are required' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('sponsors')
      .insert({
        organizer_id: organizerId,
        name,
        contact_name: contact_name || null,
        contact_email,
        contact_phone: contact_phone || null,
        website_url: website_url || null,
        tier: tier || 'bronze',
        notes: notes || null,
        logo_url: logo_url || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}
