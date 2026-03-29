'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type TierSlug = 'free' | 'select' | 'summit'

interface Coach {
  id: string
  userId: string
  displayName: string
  avatarUrl?: string
  sport: 'golf'
  hourlyRate: number
  rating: number
  reviewCount: number
  bio?: string
  specialties: string[]
}

interface CoachingSession {
  id: string
  coachId: string
  coachName: string
  coachAvatar?: string
  scheduledTime: string
  status: 'upcoming' | 'completed' | 'cancelled'
  mode: 'video_call' | 'in_person'
}

interface CoachRequest {
  id: string
  coachId: string
  coachName: string
  coachAvatar?: string
  requestDate: string
  status: 'pending' | 'accepted' | 'declined'
}

const MOCK_COACHES: Coach[] = [
  {
    id: 'c1',
    userId: 'u1',
    displayName: 'Coach Sarah Mitchell',
    avatarUrl: undefined,
    sport: 'golf',
    hourlyRate: 85,
    rating: 4.9,
    reviewCount: 47,
    bio: 'PGA-certified instructor with 15 years of experience. Specializing in swing mechanics and short game.',
    specialties: ['Swing Mechanics', 'Short Game', 'Putting'],
  },
  {
    id: 'c2',
    userId: 'u2',
    displayName: 'Coach David Chen',
    avatarUrl: undefined,
    sport: 'golf',
    hourlyRate: 100,
    rating: 4.8,
    reviewCount: 63,
    bio: 'Former collegiate golfer turned coach. Focus on course management and mental game.',
    specialties: ['Mental Game', 'Course Management', 'Driving'],
  },
  {
    id: 'c3',
    userId: 'u3',
    displayName: 'Coach Lisa Torres',
    avatarUrl: undefined,
    sport: 'golf',
    hourlyRate: 75,
    rating: 4.7,
    reviewCount: 28,
    bio: 'Patient instructor great for beginners. Expertise in building fundamentals and confidence.',
    specialties: ['Beginners', 'Fundamentals', ' etiquette'],
  },
]

const MOCK_SESSIONS: CoachingSession[] = [
  {
    id: 's1',
    coachId: 'c1',
    coachName: 'Coach Sarah Mitchell',
    coachAvatar: undefined,
    scheduledTime: '2026-04-10T14:00:00',
    status: 'upcoming',
    mode: 'video_call',
  },
  {
    id: 's2',
    coachId: 'c2',
    coachName: 'Coach David Chen',
    coachAvatar: undefined,
    scheduledTime: '2026-03-20T10:00:00',
    status: 'completed',
    mode: 'in_person',
  },
]

const MOCK_REQUESTS: CoachRequest[] = [
  {
    id: 'r1',
    coachId: 'c3',
    coachName: 'Coach Lisa Torres',
    coachAvatar: undefined,
    requestDate: '2026-03-27',
    status: 'pending',
  },
]

function renderStars(rating: number) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className={`text-sm ${i < fullStars ? 'text-yellow-400' : i === fullStars && hasHalfStar ? 'text-yellow-400/50' : 'text-slate-600'}`}
        >
          ★
        </span>
      ))}
      <span className="text-slate-400 text-sm ml-1">({rating})</span>
    </div>
  )
}

export default function CoachingPage() {
  const [user, setUser] = useState<any>(null)
  const [tierSlug, setTierSlug] = useState<TierSlug>('free')
  const [coaches, setCoaches] = useState<Coach[]>(MOCK_COACHES)
  const [sessions, setSessions] = useState<CoachingSession[]>(MOCK_SESSIONS)
  const [requests, setRequests] = useState<CoachRequest[]>(MOCK_REQUESTS)
  const [activeTab, setActiveTab] = useState<'all' | 'my-requests'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestingCoachId, setRequestingCoachId] = useState<string | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser(user)
      // Load tier
      const { data } = await supabase
        .from('profiles')
        .select('tier_slug')
        .eq('id', user.id)
        .single()
      if (data) {
        setTierSlug((data.tier_slug || 'free') as TierSlug)
      }
      // Load coaches from edge function or direct
      try {
        const res = await fetch('/api/coaches-list')
        if (res.ok) {
          const coachData = await res.json()
          if (coachData?.coaches) setCoaches(coachData.coaches)
        }
      } catch {
        // fallback to mock
      }
      // Load my sessions
      const { data: sessionsData } = await supabase
        .from('coaching_sessions')
        .select('*, coach:coaches!inner(id, profiles!inner(display_name, avatar_url))')
        .eq('user_id', user.id)
        .order('scheduled_time', { ascending: true })
        .limit(10)
      if (sessionsData) {
        setSessions(sessionsData.map((s: any) => ({
          id: s.id,
          coachId: s.coach_id,
          coachName: s.coach?.profiles?.display_name || 'Coach',
          coachAvatar: s.coach?.profiles?.avatar_url,
          scheduledTime: s.scheduled_time,
          status: s.status,
          mode: s.mode,
        })))
      }
      // Load pending requests
      try {
        const reqRes = await fetch('/api/coaches-pending-requests')
        if (reqRes.ok) {
          const reqData = await reqRes.json()
          if (reqData?.requests) setRequests(reqData.requests)
        }
      } catch {
        // fallback
      }
    }
    getUser()
  }, [supabase])

  const handleRequestCoach = async (coachId: string) => {
    if (tierSlug === 'free') return
    setRequestingCoachId(coachId)
    await new Promise(r => setTimeout(r, 1000))
    setRequests(prev => [...prev, {
      id: `r${Date.now()}`,
      coachId,
      coachName: coaches.find(c => c.id === coachId)?.displayName || 'Coach',
      coachAvatar: undefined,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'pending',
    }])
    setRequestingCoachId(null)
  }

  const filteredCoaches = coaches.filter(c =>
    !searchQuery ||
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const upcomingSessions = sessions.filter(s => s.status === 'upcoming')
  const pastSessions = sessions.filter(s => s.status !== 'upcoming')

  const showUpgradeCTA = tierSlug === 'free'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Coaching</h1>
        <p className="text-slate-400 mt-1">Book sessions with expert golf coaches</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All Coaches
        </button>
        <button
          onClick={() => setActiveTab('my-requests')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'my-requests'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          My Sessions
          {upcomingSessions.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">{upcomingSessions.length}</span>
          )}
        </button>
      </div>

      {/* FREE tier CTA */}
      {showUpgradeCTA && activeTab === 'all' && (
        <div className="bg-gradient-to-r from-blue-600/20 to-green-600/20 border border-blue-500/30 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Unlock Coaching</h3>
          <p className="text-slate-400 text-sm mb-4 max-w-sm mx-auto">
            Upgrade to Select or Summit to book coaching sessions with expert golf instructors.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors text-sm"
          >
            Upgrade to Select →
          </Link>
        </div>
      )}

      {/* All Coaches Tab */}
      {activeTab === 'all' && (
        <>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search coaches, specialties..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors"
            />
          </div>

          {/* Coach Cards Grid */}
          {filteredCoaches.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎯</span>
              </div>
              <p className="text-slate-400 font-medium">No coaches found</p>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCoaches.map(coach => (
                <div key={coach.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-600 transition-all">
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    {coach.avatarUrl ? (
                      <img src={coach.avatarUrl} alt={coach.displayName} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-lg">
                        {coach.displayName.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold">{coach.displayName}</p>
                      {renderStars(coach.rating)}
                      <p className="text-slate-500 text-xs mt-0.5">{coach.reviewCount} reviews</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white font-bold text-lg">${coach.hourlyRate}</p>
                      <p className="text-slate-500 text-xs">/hr</p>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-slate-300 text-sm mb-3 line-clamp-2">
                    {coach.bio || 'No bio available.'}
                  </p>

                  {/* Specialties */}
                  {coach.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {coach.specialties.slice(0, 3).map((specialty, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-slate-700 text-slate-300 border border-slate-600">
                          {specialty}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Request Button */}
                  {tierSlug === 'free' ? (
                    <Link
                      href="/settings"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors text-sm"
                    >
                      Upgrade to Book
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleRequestCoach(coach.id)}
                      disabled={requestingCoachId === coach.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors text-sm disabled:opacity-50"
                    >
                      {requestingCoachId === coach.id ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Requesting...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Request Coach
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* My Sessions Tab */}
      {activeTab === 'my-requests' && (
        <>
          {/* Pending Requests */}
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Pending Requests</h3>
              <div className="space-y-3">
                {requests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                    <div className="flex items-center gap-4">
                      {req.coachAvatar ? (
                        <img src={req.coachAvatar} alt={req.coachName} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-lg">
                          {req.coachName.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-white font-semibold">{req.coachName}</p>
                        <p className="text-slate-400 text-sm">Requested {req.requestDate}</p>
                      </div>
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Sessions */}
          {upcomingSessions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Upcoming Sessions</h3>
              <div className="space-y-3">
                {upcomingSessions.map(session => {
                  const date = new Date(session.scheduledTime)
                  return (
                    <div key={session.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                      <div className="flex items-center gap-4">
                        {session.coachAvatar ? (
                          <img src={session.coachAvatar} alt={session.coachName} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-lg">
                            {session.coachName.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-white font-semibold">{session.coachName}</p>
                          <p className="text-slate-400 text-sm">
                            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                            {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">
                              {session.mode === 'video_call' ? '📹 Video Call' : '🤝 In Person'}
                            </span>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          Upcoming
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Past Sessions */}
          {pastSessions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Past Sessions</h3>
              <div className="space-y-3">
                {pastSessions.map(session => {
                  const date = new Date(session.scheduledTime)
                  return (
                    <div key={session.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 opacity-75">
                      <div className="flex items-center gap-4">
                        {session.coachAvatar ? (
                          <img src={session.coachAvatar} alt={session.coachName} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white font-bold text-lg">
                            {session.coachName.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-white font-semibold">{session.coachName}</p>
                          <p className="text-slate-400 text-sm">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                          session.status === 'completed'
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {sessions.length === 0 && requests.filter(r => r.status === 'pending').length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📅</span>
              </div>
              <p className="text-slate-400 font-medium">No sessions yet</p>
              <p className="text-slate-500 text-sm mt-1 mb-4">Book your first coaching session to get started</p>
              <button
                onClick={() => setActiveTab('all')}
                className="text-green-400 hover:text-green-300 text-sm font-medium"
              >
                Browse Coaches →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
