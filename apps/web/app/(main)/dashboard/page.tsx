'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface StatWidget {
  label: string
  value: string | number
  subtext?: string
  icon: React.ReactNode
  href?: string
}

interface UpcomingRound {
  id: string
  courseName: string
  date: string
  players: number
  status: string
}

interface ActivityItem {
  id: string
  type: 'round_completed' | 'connection_added' | 'coach_message' | 'round_invite'
  message: string
  time: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [pendingRequests, setPendingRequests] = useState(3)
  const [upcomingRounds, setUpcomingRounds] = useState<UpcomingRound[]>([
    { id: '1', courseName: 'Ocotillo Golf Resort', date: 'Apr 12, 2026', players: 3, status: 'confirmed' },
    { id: '2', courseName: 'Whirlwind Golf Club', date: 'Apr 18, 2026', players: 2, status: 'planning' },
  ])
  const [activity, setActivity] = useState<ActivityItem[]>([
    { id: '1', type: 'connection_added', message: 'Mike Chen accepted your connection', time: '2h ago' },
    { id: '2', type: 'round_invite', message: 'You\'re invited to play at Ocotillo on Apr 12', time: '5h ago' },
    { id: '3', type: 'round_completed', message: 'Round at Raven GC was completed', time: '1d ago' },
    { id: '4', type: 'coach_message', message: 'Coach Sarah left feedback on your swing', time: '2d ago' },
  ])
  const supabase = createBrowserClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [supabase])

  const quickActions: StatWidget[] = [
    {
      label: 'Find Golfers',
      value: '',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      href: '/discovery',
    },
    {
      label: 'My Rounds',
      value: '',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      href: '/rounds',
    },
    {
      label: 'Messages',
      value: '',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      href: '/connections',
    },
    {
      label: 'Coaching',
      value: '',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      href: '/coaching',
    },
  ]

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'round_completed':
        return <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">✓</div>
      case 'connection_added':
        return <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">👤</div>
      case 'coach_message':
        return <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400">⚡</div>
      case 'round_invite':
        return <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">📅</div>
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'planning': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'open': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
          </h1>
          <p className="text-slate-400 mt-1">Here&apos;s what&apos;s happening with your golf game</p>
        </div>
        <Link
          href="/rounds/create"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Round
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action, i) => (
          <Link
            key={i}
            href={action.href || '#'}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-green-500/50 hover:bg-slate-750 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 mb-4 group-hover:bg-green-500/20 transition-colors">
              {action.icon}
            </div>
            <p className="text-white font-medium">{action.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Rounds */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Upcoming Rounds</h2>
            <Link href="/rounds" className="text-sm text-green-400 hover:text-green-300">View all →</Link>
          </div>
          
          {upcomingRounds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-3">No upcoming rounds</p>
              <Link href="/rounds/create" className="text-green-400 hover:text-green-300 text-sm font-medium">
                Schedule your first round →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingRounds.map((round) => (
                <Link
                  key={round.id}
                  href={`/rounds/${round.id}`}
                  className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">{round.courseName}</p>
                      <p className="text-slate-400 text-sm">{round.date} · {round.players} players</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(round.status)}`}>
                    {round.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Pending Requests */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Connection Requests</h2>
              <Link href="/connections" className="text-sm text-green-400 hover:text-green-300">View →</Link>
            </div>
            
            {pendingRequests > 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 text-xl font-bold">
                  {pendingRequests}
                </div>
                <div>
                  <p className="text-white font-medium">Pending Requests</p>
                  <p className="text-slate-400 text-sm">Accept or decline</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No pending requests</p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Your Stats</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Rounds Played</span>
                <span className="text-white font-semibold">12</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '75%' }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Would Play Again</span>
                <span className="text-white font-semibold">92%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Reliability Score</span>
                <span className="text-white font-semibold">⭐ 4.8</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {activity.map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-900/50 transition-colors">
              {getActivityIcon(item.type)}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">{item.message}</p>
                <p className="text-slate-500 text-xs mt-0.5">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
