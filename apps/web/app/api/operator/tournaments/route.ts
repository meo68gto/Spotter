import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/operator/tournaments - List all tournaments for the operator
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'operator' && session.role !== 'admin') || !session.organizerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  const supabase = createServerClient()

  let query = supabase
    .from('organizer_events')
    .select(`
      id,
      title,
      name,
      status,
      type,
      course_name,
      start_time,
      end_time,
      max_participants,
      registration_count,
      waitlist_count,
      created_at
    `)
    .eq('organizer_id', session.organizerId)
    .order('start_time', { ascending: false })
    .limit(limit)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
