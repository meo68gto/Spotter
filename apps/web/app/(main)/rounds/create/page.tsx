'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface InvitedPlayer {
  id: string
  displayName: string
}

const MOCK_CONNECTIONS: { id: string; displayName: string }[] = [
  { id: 'u2', displayName: 'Mike Chen' },
  { id: 'u3', displayName: 'Sarah Johnson' },
  { id: 'u4', displayName: 'Lisa Rodriguez' },
  { id: 'u5', displayName: 'Tom Bradley' },
  { id: 'u6', displayName: 'James Wilson' },
]

const MOCK_COURSES = [
  'Ocotillo Golf Resort',
  'Whirlwind Golf Club',
  'Raven Golf Club',
  'Sterling Grove',
  'Silverleaf Club',
  'Troon North Golf Club',
  'Grayhawk Golf Club',
  'Kierland Golf Club',
]

export default function CreateRoundPage() {
  const router = useRouter()
  const [courseName, setCourseName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [notes, setNotes] = useState('')
  const [invites, setInvites] = useState<InvitedPlayer[]>([])
  const [inviteSearch, setInviteSearch] = useState('')
  const [showInviteDropdown, setShowInviteDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createBrowserClient()

  const filteredConnections = MOCK_CONNECTIONS.filter(
    c => c.displayName.toLowerCase().includes(inviteSearch.toLowerCase()) && !invites.find(i => i.id === c.id)
  )

  const handleInvite = (player: { id: string; displayName: string }) => {
    setInvites(prev => [...prev, player])
    setInviteSearch('')
    setShowInviteDropdown(false)
  }

  const handleRemoveInvite = (id: string) => {
    setInvites(prev => prev.filter(p => p.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseName || !date || !time) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // In production: call POST /rounds-create edge function
      await new Promise(r => setTimeout(r, 1200))
      router.push('/rounds')
    } catch (err: any) {
      setError(err.message || 'Failed to create round')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/rounds" className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Create a Round</h1>
          <p className="text-slate-400 mt-1">Set up a new golf round</p>
        </div>
      </div>

      {/* Free Tier Warning */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <svg className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p className="text-yellow-300 font-medium">Free tier limit</p>
          <p className="text-yellow-400/70 text-sm mt-0.5">
            You can create up to 2 rounds per month. Upgrade to SELECT or SUMMIT for unlimited rounds.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} data-testid="create-round-form" className="space-y-6">
        {/* Course */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Golf Course <span className="text-red-400">*</span>
          </label>
          <select
            data-testid="round-course-select"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors"
          >
            <option value="">Select a course...</option>
            {MOCK_COURSES.map(course => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              data-testid="round-date-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Time <span className="text-red-400">*</span>
            </label>
            <input
              type="time"
              data-testid="round-time-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors"
            />
          </div>
        </div>

        {/* Max Players */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Max Players <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-3">
            {[2, 3, 4].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setMaxPlayers(num)}
                className={`flex-1 py-3 rounded-xl border text-center font-semibold transition-colors ${
                  maxPlayers === num
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                {num} {num === 1 ? 'Player' : 'Players'}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Notes <span className="text-slate-500">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any details about the round..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors resize-none"
          />
        </div>

        {/* Invites Section */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Invite Connections
          </label>

          {/* Selected Invites */}
          {invites.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {invites.map((player) => (
                <div key={player.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700 border border-slate-600 text-white text-sm">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xs font-bold">
                    {player.displayName.charAt(0)}
                  </div>
                  {player.displayName}
                  <button
                    type="button"
                    onClick={() => handleRemoveInvite(player.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Invite Search */}
          <div className="relative">
            <input
              type="text"
              data-testid="invite-member-search"
              value={inviteSearch}
              onChange={(e) => {
                setInviteSearch(e.target.value)
                setShowInviteDropdown(true)
              }}
              onFocus={() => setShowInviteDropdown(true)}
              placeholder="Search connections to invite..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors"
            />

            {/* Dropdown */}
            {showInviteDropdown && inviteSearch && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                {filteredConnections.length === 0 ? (
                  <p className="px-4 py-3 text-slate-400 text-sm">No connections found</p>
                ) : (
                  filteredConnections.map((conn) => (
                    <button
                      key={conn.id}
                      type="button"
                      onClick={() => handleInvite(conn)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-bold">
                        {conn.displayName.charAt(0)}
                      </div>
                      <span className="text-white text-sm">{conn.displayName}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-1.5">Search and add connections to your round</p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/rounds"
            className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            data-testid="create-round-button"
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Round
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
