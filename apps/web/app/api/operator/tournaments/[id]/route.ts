import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/operator/tournaments/[id] — fetch single tournament
export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { id: tournamentId } = await params;
  return withOperatorAuth(_request, async ({ organizerId }) => {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('organizer_events')
      .select('*')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  });
}
