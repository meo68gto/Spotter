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
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/operator/tournaments — Create a new tournament
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'operator' && session.role !== 'admin') || !session.organizerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, title, type, course_name, start_time, end_time, max_participants, registration_deadline, description, location_address } = body

  // Validate required fields
  if (!title && !name) {
    return NextResponse.json({ error: 'title or name is required' }, { status: 400 })
  }
  if (!start_time) {
    return NextResponse.json({ error: 'start_time is required' }, { status: 400 })
  }
  if (max_participants !== undefined && (typeof max_participants !== 'number' || max_participants < 1)) {
    return NextResponse.json({ error: 'max_participants must be a positive integer' }, { status: 400 })
  }
  if (registration_deadline && isNaN(Date.parse(registration_deadline))) {
    return NextResponse.json({ error: 'registration_deadline must be a valid ISO date string' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('organizer_events')
    .insert({
      organizer_id: session.organizerId,
      title: title || name,
      name: name || title,
      type: type || null,
      course_name: course_name || null,
      start_time,
      end_time: end_time || null,
      max_participants: max_participants || null,
      registration_deadline: registration_deadline || null,
      description: description || null,
      location_address: location_address || null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
