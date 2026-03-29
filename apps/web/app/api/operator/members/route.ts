import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/operator/members — list all team members
export async function GET(
  _request: NextRequest,
): Promise<Response> {
  return withOperatorAuth(_request, async ({ organizerId }) => {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('organizer_members')
      .select(`
        id,
        role,
        permissions,
        is_active,
        invited_at,
        joined_at,
        created_at,
        users:user_id(
          id,
          display_name,
          email,
          avatar_url
        )
      `)
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  });
}
