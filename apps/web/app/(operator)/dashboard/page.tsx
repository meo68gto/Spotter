import { getSession } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { OrganizerEvent, RegistrationWithUser } from '@spotter/types'

// Force dynamic rendering so we always get fresh data
export const dynamic = 'force-dynamic'

async function getDashboardData(organizerId: string) {
  const supabase = createServerClient()

  // Fetch stats from the dashboard view
  const { data: stats, error: statsError } = await supabase
    .from('operator_dashboard_stats')
    .select('*')
    .eq('organizer_id', organizerId)
    .single()

  // Fetch upcoming tournaments (next 30 days)
  const { data: upcomingEvents, error: eventsError } = await supabase
    .from('organizer_events')
    .select('*')
    .eq('organizer_id', organizerId)
    .in('status', ['registration_open', 'published'])
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(5)

  // Fetch recent registrations
  const { data: recentRegistrations, error: regsError } = await supabase
    .from('organizer_event_registrations')
    .select(`
      id,
      event_id,
      user_id,
      guest_email,
      guest_name,
      status,
      payment_status,
      amount_paid_cents,
      registered_at,
      marketing_opt_in
    `)
    .in('event_id', upcomingEvents?.map(e => e.id) ?? [])
    .order('registered_at', { ascending: false })
    .limit(10)

  // Return errors so the page can show an error state
  if (statsError || eventsError || regsError) {
    return {
      stats: null,
      upcomingEvents: [] as any[],
      registrationsWithUsers: [] as any[],
      error: statsError
        ? `Stats view error: ${statsError.message}. The organizer_dashboard_stats view may not exist or you may need to run migrations.`
        : eventsError
        ? `Events error: ${eventsError.message}`
        : `Registrations error: ${regsError?.message ?? 'Unknown error'}`,
    }
  }

  // Enrich registrations with user names

  // Enrich registrations with user names
  let registrationsWithUsers: RegistrationWithUser[] = []
  if (recentRegistrations?.length) {
    const userIds = recentRegistrations
      .filter(r => r.user_id)
      .map(r => r.user_id)
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, email')
      .in('id', userIds)

    registrationsWithUsers = recentRegistrations.map(reg => {
      const user = users?.find(u => u.id === reg.user_id)
      return {
        id: reg.id,
        eventId: reg.event_id,
        userId: reg.user_id,
        displayName: user?.display_name ?? reg.guest_name ?? reg.guest_email ?? 'Unknown',
        email: user?.email ?? reg.guest_email ?? '',
        avatarUrl: undefined,
        status: reg.status as any,
        paymentStatus: reg.payment_status as any,
        amountPaidCents: reg.amount_paid_cents,
        registeredAt: reg.registered_at,
        marketingOptIn: reg.marketing_opt_in,
      }
    })
  }

  return { stats, upcomingEvents: upcomingEvents ?? [], registrationsWithUsers, error: null }
}

export default async function DashboardPage() {
  const session = await getSession()
  
  // If no session or not an operator, show public dashboard with mock data
  const showMockData = !session || session.role === 'golfer'

  if (showMockData) {
    return <MockDashboard />
  }

  const dashboardResult = await getDashboardData(session.organizerId!)

  const { stats, upcomingEvents, registrationsWithUsers } = dashboardResult

  const daysUntilNext = upcomingEvents.length > 0
    ? Math.ceil((new Date(upcomingEvents[0].start_time).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {session.displayName}</p>
      </div>

      {/* Error Banner — shown when stats could not be loaded */}
      {'error' in dashboardResult && dashboardResult.error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-amber-800">
                Dashboard data unavailable — stats may not reflect actual values.
              </p>
              <p className="text-xs text-amber-600 mt-1">{(dashboardResult as any).error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {stats === null ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8 text-center">
          <p className="text-red-700 font-medium">⚠️ Stats unavailable</p>
          <p className="text-red-500 text-sm mt-1">The dashboard stats view could not be loaded. Check database migrations.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Revenue"
          value={`$${((stats?.total_revenue_cents ?? 0) / 100).toLocaleString()}`}
          subtitle="All time"
          icon={<DollarIcon />}
        />
        <StatsCard
          title="Total Registrations"
          value={stats?.total_registrations ?? 0}
          subtitle={`${stats?.paid_registrations ?? 0} paid`}
          icon={<UsersIcon />}
        />
        <StatsCard
          title="Upcoming Events"
          value={stats?.upcoming_tournaments ?? 0}
          subtitle={`${upcomingEvents.length} with open registration`}
          icon={<CalendarIcon />}
        />
        <StatsCard
          title="Confirmed / Waitlist"
          value={`${stats?.confirmed_count ?? 0}`}
          subtitle={`${stats?.waitlisted_count ?? 0} on waitlist`}
          icon={<CheckIcon />}
        />
      </div>
      )}

      {/* Days Until Next Event Banner */}
      {daysUntilNext !== null && daysUntilNext >= 0 && (
        <div className="bg-indigo-600 rounded-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-200 text-sm font-medium">Next Event</p>
              <h2 className="text-xl font-bold mt-1">{upcomingEvents[0].name ?? upcomingEvents[0].title}</h2>
              <p className="text-indigo-200 text-sm mt-1">
                {new Date(upcomingEvents[0].start_time).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric'
                })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold">{daysUntilNext}</p>
              <p className="text-indigo-200 text-sm">days away</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Registrations</h3>
            <Link href="/tournaments" className="text-sm text-indigo-600 hover:text-indigo-800">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {registrationsWithUsers.length === 0 ? (
              <p className="px-6 py-4 text-gray-500 text-sm">No registrations yet.</p>
            ) : (
              registrationsWithUsers.slice(0, 5).map(reg => (
                <div key={reg.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
                      {(reg.displayName ?? '?').charAt(0)}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{reg.displayName}</p>
                      <p className="text-xs text-gray-500">{reg.email}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    reg.status === 'confirmed' || reg.status === 'checked_in'
                      ? 'bg-green-100 text-green-700'
                      : reg.status === 'waitlisted'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {reg.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <Link href="/tournaments/new" className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-sm font-medium text-gray-700">New Tournament</span>
            </Link>
            <Link href="/sponsors/new" className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Add Sponsor</span>
            </Link>
            <Link href="/sponsors" className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">View Waitlist</span>
            </Link>
            <Link href="/analytics" className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Send Email</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mock dashboard for unauthenticated users
function MockDashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Sign in to access your organizer dashboard.</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">Please sign in with your Spotter account to view your dashboard.</p>
        <Link href="/login" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Sign In
        </Link>
      </div>
    </div>
  )
}

// Inline StatsCard component (reuses existing pattern)
function StatsCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0 p-3 rounded-lg bg-indigo-100 text-indigo-600">{icon}</div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

// Inline icon components
function DollarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
