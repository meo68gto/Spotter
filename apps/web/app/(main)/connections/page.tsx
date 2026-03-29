'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useState } from 'react'

type TierSlug = 'free' | 'select' | 'summit'

interface Connection {
  id: string
  displayName: string
  avatarUrl?: string
  tier: TierSlug
  lastPlayed?: string
  mutualConnections: number
  roundsTogether: number
}

interface PendingRequest {
  id: string
  displayName: string
  avatarUrl?: string
  tier: TierSlug
  sentAt: string
  mutualConnections: number
}

const MOCK_CONNECTIONS: Connection[] = [
  { id: '1', displayName: 'Mike Chen', tier: 'select', lastPlayed: '2 days ago', mutualConnections: 5, roundsTogether: 3 },
  { id: '2', displayName: 'Sarah Johnson', tier: 'summit', lastPlayed: '1 week ago', mutualConnections: 12, roundsTogether: 8 },
  { id: '3', displayName: 'James Wilson', tier: 'free', mutualConnections: 2, roundsTogether: 1 },
  { id: '4', displayName: 'Lisa Rodriguez', tier: 'select', lastPlayed: '3 days ago', mutualConnections: 8, roundsTogether: 5 },
  { id: '5', displayName: 'Tom Bradley', tier: 'free', lastPlayed: '2 weeks ago', mutualConnections: 3, roundsTogether: 2 },
]

const MOCK_PENDING: PendingRequest[] = [
  { id: 'p1', displayName: 'Alex Turner', tier: 'select', sentAt: '2h ago', mutualConnections: 4 },
  { id: 'p2', displayName: 'Emma Davis', tier: 'free', sentAt: '1d ago', mutualConnections: 1 },
  { id: 'p3', displayName: 'Ryan Miller', tier: 'select', sentAt: '3d ago', mutualConnections: 7 },
]

const TIER_COLORS: Record<TierSlug, { bg: string; text: string; label: string }> = {
  free: { bg: 'bg-slate-600/30', text: 'text-slate-300', label: 'FREE' },
  select: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'SELECT' },
  summit: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'SUMMIT' },
}

export default function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all')
  const [connections, setConnections] = useState<Connection[]>(MOCK_CONNECTIONS)
  const [pending, setPending] = useState<PendingRequest[]>(MOCK_PENDING)
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const supabase = createBrowserClient()

  const handleAccept = async (id: string) => {
    setActionId(id)
    await new Promise(r => setTimeout(r, 800))
    const req = pending.find(p => p.id === id)
    if (req) {
      setConnections(prev => [...prev, { ...req, lastPlayed: undefined, roundsTogether: 0 } as Connection])
    }
    setPending(prev => prev.filter(p => p.id !== id))
    setActionId(null)
  }

  const handleReject = async (id: string) => {
    setActionId(id)
    await new Promise(r => setTimeout(r, 500))
    setPending(prev => prev.filter(p => p.id !== id))
    setActionId(null)
  }

  const handleRemove = async (id: string) => {
    setActionId(id)
    await new Promise(r => setTimeout(r, 500))
    setConnections(prev => prev.filter(c => c.id !== id))
    setActionId(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Connections</h1>
        <p className="text-slate-400 mt-1">Manage your golf network</p>
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
          All Connections
          <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-slate-600 text-slate-300">{connections.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Pending
          {pending.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">{pending.length}</span>
          )}
        </button>
      </div>

      {/* All Connections Tab */}
      {activeTab === 'all' && (
        <>
          {connections.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-slate-400 font-medium">No connections yet</p>
              <p className="text-slate-500 text-sm mt-1">Find golfers in Discovery to connect</p>
              <Link href="/discovery" className="inline-block mt-4 text-green-400 hover:text-green-300 text-sm font-medium">
                Find Golfers →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-600 transition-all">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <Link href={`/profile/${conn.id}`} className="shrink-0">
                      {conn.avatarUrl ? (
                        <img src={conn.avatarUrl} alt={conn.displayName} className="w-14 h-14 rounded-full object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-xl">
                          {conn.displayName.charAt(0)}
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/profile/${conn.id}`} className="text-white font-semibold hover:text-green-400 transition-colors">
                          {conn.displayName}
                        </Link>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${TIER_COLORS[conn.tier].bg} ${TIER_COLORS[conn.tier].text}`}>
                          {TIER_COLORS[conn.tier].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-400">
                        {conn.lastPlayed && (
                          <span>Played {conn.lastPlayed}</span>
                        )}
                        <span>{conn.roundsTogether} round{conn.roundsTogether !== 1 ? 's' : ''} together</span>
                        {conn.mutualConnections > 0 && (
                          <span>{conn.mutualConnections} mutual connection{conn.mutualConnections !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/rounds/create?invite=${conn.id}`}
                        className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        title="Invite to round"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => handleRemove(conn.id)}
                        disabled={actionId === conn.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove connection"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9.89 19.38l1.573-6.261a1.002 1.002 0 011.987-.001l1.575 6.294a1 1 0 01-1.287 1.207l-1.573-.064a1.002 1.002 0 01-.987-1.207l.001.001-1.573.064a1 1 0 01-1.286-1.206z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <>
          {pending.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-400 font-medium">No pending requests</p>
              <p className="text-slate-500 text-sm mt-1">New connection requests will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((req) => (
                <div key={req.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {req.avatarUrl ? (
                        <img src={req.avatarUrl} alt={req.displayName} className="w-14 h-14 rounded-full object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                          {req.displayName.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold">{req.displayName}</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${TIER_COLORS[req.tier].bg} ${TIER_COLORS[req.tier].text}`}>
                          {TIER_COLORS[req.tier].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-400">
                        <span>Sent {req.sentAt}</span>
                        {req.mutualConnections > 0 && (
                          <span>{req.mutualConnections} mutual connection{req.mutualConnections !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    {/* Accept/Reject */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAccept(req.id)}
                        disabled={actionId === req.id}
                        className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {actionId === req.id ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={actionId === req.id}
                        className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
