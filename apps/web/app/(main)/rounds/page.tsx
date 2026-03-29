'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useState } from 'react'

type RoundStatus = 'planning' | 'confirmed' | 'played' | 'reviewed' | 'open' | 'full' | 'cancelled'
type RoundTab = 'upcoming' | 'past' | 'standing'

interface RoundCard {
  id: string
  courseName: string
  courseLocation: string
  date: string
  time: string
  maxPlayers: number
  currentPlayers: number
  status: RoundStatus
  creatorId: string
  isHost: boolean
  players: { id: string; displayName: string; avatarUrl?: string }[]
}

const MOCK_ROUNDS: RoundCard[] = [
  { id: '1', courseName: 'Ocotillo Golf Resort', courseLocation: 'Chandler, AZ', date: 'Apr 12, 2026', time: '7:00 AM', maxPlayers: 4, currentPlayers: 3, status: 'confirmed', creatorId: 'u1', isHost: true, players: [{ id: 'u1', displayName: 'You' }, { id: 'u2', displayName: 'Mike Chen' }, { id: 'u3', displayName: 'Sarah J' }] },
  { id: '2', courseName: 'Whirlwind Golf Club', courseLocation: 'Laveen, AZ', date: 'Apr 18, 2026', time: '1:00 PM', maxPlayers: 4, currentPlayers: 2, status: 'planning', creatorId: 'u4', isHost: false, players: [{ id: 'u4', displayName: 'Tom Bradley' }, { id: 'u1', displayName: 'You' }] },
  { id: '3', courseName: 'Raven Golf Club', courseLocation: 'Phoenix, AZ', date: 'Apr 5, 2026', time: '8:00 AM', maxPlayers: 4, currentPlayers: 4, status: 'reviewed', creatorId: 'u1', isHost: true, players: [{ id: 'u1', displayName: 'You' }, { id: 'u2', displayName: 'Mike Chen' }, { id: 'u5', displayName: 'Lisa R' }, { id: 'u6', displayName: 'James W' }] },
  { id: '4', courseName: 'Sterling Grove', courseLocation: 'Scottsdale, AZ', date: 'Mar 28, 2026', time: '9:00 AM', maxPlayers: 4, currentPlayers: 4, status: 'reviewed', creatorId: 'u7', isHost: false, players: [{ id: 'u7', displayName: 'David K' }, { id: 'u1', displayName: 'You' }, { id: 'u8', displayName: 'Rachel G' }, { id: 'u9', displayName: 'Chris M' }] },
]

const MOCK_STANDING: RoundCard[] = [
  { id: 's1', courseName: 'Ocotillo Golf Resort', courseLocation: 'Chandler, AZ', date: 'Monthly', time: '7:00 AM', maxPlayers: 4, currentPlayers: 4, status: 'confirmed', creatorId: 'u1', isHost: true, players: [{ id: 'u1', displayName: 'You' }, { id: 'u2', displayName: 'Mike Chen' }, { id: 'u3', displayName: 'Sarah J' }, { id: 'u4', displayName: 'Tom Bradley' }] },
]

const STATUS_META: Record<RoundStatus, { label: string; color: string; bg: string }> = {
  planning: { label: 'Planning', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  open: { label: 'Open', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  full: { label: 'Full', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  confirmed: { label: 'Confirmed', color: 'text-green-400', bg: 'bg-green-500/20' },
  played: { label: 'Played', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  reviewed: { label: 'Reviewed', color: 'text-green-400', bg: 'bg-green-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/20' },
}

export default function RoundsPage() {
  const [activeTab, setActiveTab] = useState<RoundTab>('upcoming')
  const [rounds, setRounds] = useState<RoundCard[]>(MOCK_ROUNDS)
  const [loading] = useState(false)
  const supabase = createBrowserClient()

  const getDisplayedRounds = () => {
    if (activeTab === 'standing') return MOCK_STANDING
    const now = new Date()
    return rounds.filter(r => {
      const roundDate = new Date(r.date)
      if (activeTab === 'upcoming') return roundDate >= now && r.status !== 'cancelled'
      return roundDate < now || r.status === 'played' || r.status === 'reviewed' || r.status === 'cancelled'
    })
  }

  const displayedRounds = getDisplayedRounds()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Rounds</h1>
          <p className="text-slate-400 mt-1">Manage your golf rounds</p>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl w-fit">
        {(['upcoming', 'past', 'standing'] as RoundTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'standing' ? 'Standing Foursomes' : tab}
          </button>
        ))}
      </div>

      {/* Rounds List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 animate-pulse">
              <div className="h-5 bg-slate-700 rounded w-48 mb-3" />
              <div className="h-4 bg-slate-700 rounded w-32" />
            </div>
          ))}
        </div>
      ) : displayedRounds.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-400 font-medium">No {activeTab} rounds</p>
          {activeTab !== 'past' && (
            <Link href="/rounds/create" className="inline-block mt-4 text-green-400 hover:text-green-300 text-sm font-medium">
              Schedule a round →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRounds.map((round) => {
            const statusMeta = STATUS_META[round.status]
            return (
              <Link
                key={round.id}
                href={`/rounds/${round.id}`}
                className="block bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Date Block */}
                  <div className="shrink-0 w-14 h-14 rounded-xl bg-green-500/10 flex flex-col items-center justify-center">
                    <span className="text-green-400 text-xs font-medium uppercase">
                      {round.date.split(' ')[0]}
                    </span>
                    <span className="text-white text-xl font-bold">
                      {round.date.split(' ')[1].replace(',', '')}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-white font-semibold">{round.courseName}</h3>
                        <p className="text-slate-400 text-sm">{round.courseLocation}</p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${statusMeta.bg} ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {round.time}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {round.currentPlayers}/{round.maxPlayers} players
                      </span>
                      {round.isHost && (
                        <span className="flex items-center gap-1 text-green-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Host
                        </span>
                      )}
                    </div>

                    {/* Players Avatars */}
                    <div className="flex items-center gap-1 mt-3">
                      {round.players.slice(0, 4).map((player, i) => (
                        <div
                          key={player.id}
                          className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xs font-bold border-2 border-slate-800"
                          style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: 4 - i }}
                          title={player.displayName}
                        >
                          {player.displayName.charAt(0)}
                        </div>
                      ))}
                      {round.players.length > 4 && (
                        <span className="ml-1 text-slate-400 text-xs">+{round.players.length - 4}</span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
