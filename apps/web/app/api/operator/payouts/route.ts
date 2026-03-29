import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/operator/payouts — List all payouts for operator
export async function GET(req: NextRequest) {
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('payouts')
      .select(`
        *,
        tournament:organizer_events(id, name)
      `)
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}
