'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type TierSlug = 'free' | 'select' | 'summit'

interface UserProfile {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  location?: string
  tierSlug: TierSlug
  handicap?: number
  roundsPlayed: number
  wouldPlayAgainPercent: number
  reliabilityScore: number
  profileVisibility: 'everyone' | 'select_above' | 'summit_only'
  huntModeEnabled: boolean
}

interface StandingFoursome {
  id: string
  name: string
  memberCount: number
  members: { displayName: string; avatarUrl?: string }[]
}

interface RoundHistoryItem {
  id: string
  courseName: string
  date: string
  rating?: number
  wouldPlayAgain: boolean
}

interface TrustBadge {
  id: string
  type: 'verified' | 'consistent' | 'friendly' | 'punctual'
  label: string
  earned: boolean
}

const TIER_CONFIG: Record<TierSlug, { bg: string; text: string; label: string }> = {
  free: { bg: 'bg-slate-600/30', text: 'text-slate-300', label: 'FREE' },
  select: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'SELECT' },
  summit: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'SUMMIT' },
}

const MOCK_PROFILE: UserProfile = {
  id: '1',
  email: 'michael.ortiz@golf.com',
  displayName: 'Michael Ortiz',
  avatarUrl: undefined,
  location: 'Phoenix, AZ',
  tierSlug: 'select',
  handicap: 12,
  roundsPlayed: 34,
  wouldPlayAgainPercent: 91,
  reliabilityScore: 4.8,
  profileVisibility: 'everyone',
  huntModeEnabled: false,
}

const MOCK_FOURSOMES: StandingFoursome[] = [
  {
    id: 'sf1',
    name: 'Weekend Warriors',
    memberCount: 4,
    members: [
      { displayName: 'Michael O.', avatarUrl: undefined },
      { displayName: 'Mike C.', avatarUrl: undefined },
      { displayName: 'Sarah J.', avatarUrl: undefined },
      { displayName: 'James W.', avatarUrl: undefined },
    ],
  },
  {
    id: 'sf2',
    name: 'Twilight Crew',
    memberCount: 3,
    members: [
      { displayName: 'Michael O.', avatarUrl: undefined },
      { displayName: 'Lisa R.', avatarUrl: undefined },
      { displayName: 'Tom B.', avatarUrl: undefined },
    ],
  },
]

const MOCK_ROUNDS: RoundHistoryItem[] = [
  { id: 'r1', courseName: 'Ocotillo Golf Resort', date: 'Apr 12, 2026', rating: 5, wouldPlayAgain: true },
  { id: 'r2', courseName: 'Whirlwind Golf Club', date: 'Apr 5, 2026', rating: 4, wouldPlayAgain: true },
  { id: 'r3', courseName: 'Raven Golf Club', date: 'Mar 28, 2026', rating: 4, wouldPlayAgain: true },
  { id: 'r4', courseName: 'Ak-Chin Southern Dunes', date: 'Mar 20, 2026', rating: 5, wouldPlayAgain: true },
]

const MOCK_BADGES: TrustBadge[] = [
  { id: 'b1', type: 'verified', label: 'Verified', earned: true },
  { id: 'b2', type: 'consistent', label: 'Consistent', earned: true },
  { id: 'b3', type: 'friendly', label: 'Friendly', earned: true },
  { id: 'b4', type: 'punctual', label: 'Punctual', earned: false },
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(MOCK_PROFILE)
  const [foursomes, setFoursomes] = useState<StandingFoursome[]>(MOCK_FOURSOMES)
  const [roundHistory, setRoundHistory] = useState<RoundHistoryItem[]>(MOCK_ROUNDS)
  const [badges] = useState<TrustBadge[]>(MOCK_BADGES)
  const [huntModeEnabled, setHuntModeEnabled] = useState(MOCK_PROFILE.huntModeEnabled)
  const [visibility, setVisibility] = useState(MOCK_PROFILE.profileVisibility)
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Load profile from DB
      const { data } = await supabase
        .from('profiles')
        .select('*, tier_slug, home_course_area')
        .eq('id', user.id)
        .single()
      if (data) {
        setProfile({
          id: user.id,
          email: user.email || '',
          displayName: data.display_name || 'Golfer',
          avatarUrl: data.avatar_url,
          location: data.home_course_area || undefined,
          tierSlug: (data.tier_slug || 'free') as TierSlug,
          roundsPlayed: 34,
          wouldPlayAgainPercent: 91,
          reliabilityScore: 4.8,
          profileVisibility: (data.profile_visibility || 'everyone') as any,
          huntModeEnabled: data.hunt_mode_enabled || false,
        })
        setHuntModeEnabled(data.hunt_mode_enabled || false)
      }
    }
    getUser()
  }, [supabase])

  const handleHuntModeToggle = async () => {
    if (profile.tierSlug !== 'select') return
    const newValue = !huntModeEnabled
    setHuntModeEnabled(newValue)
    await supabase
      .from('profiles')
      .update({ hunt_mode_enabled: newValue })
      .eq('id', profile.id)
  }

  const handleVisibilityChange = async (v: UserProfile['profileVisibility']) => {
    if (profile.tierSlug !== 'summit') return
    setVisibility(v)
    await supabase
      .from('profiles')
      .update({ profile_visibility: v })
      .eq('id', profile.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-slate-400 mt-1">Manage your Spotter presence</p>
        </div>
        <Link
          href="/profile/edit"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Edit Profile
        </Link>
      </div>

      {/* Profile Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName} className="w-20 h-20 rounded-full object-cover border-2 border-slate-600" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-slate-600">
              {profile.displayName.charAt(0)}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white">{profile.displayName}</h2>
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${TIER_CONFIG[profile.tierSlug].bg} ${TIER_CONFIG[profile.tierSlug].text}`}>
                {TIER_CONFIG[profile.tierSlug].label}
              </span>
            </div>
            {profile.location && (
              <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {profile.location}
              </p>
            )}
            <p className="text-slate-500 text-sm mt-1">{profile.email}</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-white">{profile.roundsPlayed}</p>
          <p className="text-slate-400 text-sm mt-1">Rounds Played</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-green-400">{profile.wouldPlayAgainPercent}%</p>
          <p className="text-slate-400 text-sm mt-1">Would Play Again</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-yellow-400">⭐ {profile.reliabilityScore}</p>
          <p className="text-slate-400 text-sm mt-1">Reliability Score</p>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🏆</span> Trust Badges
        </h3>
        <div className="flex flex-wrap gap-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border ${
                badge.earned
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-slate-700/50 border-slate-600 text-slate-500'
              }`}
            >
              <span className="text-base">
                {badge.type === 'verified' && '✓'}
                {badge.type === 'consistent' && '🔁'}
                {badge.type === 'friendly' && '😊'}
                {badge.type === 'punctual' && '⏰'}
              </span>
              {badge.label}
              {badge.earned && <span className="text-green-500 text-xs">Earned</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Standing Foursomes */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🏌️</span> Standing Foursomes
        </h3>
        {foursomes.length === 0 ? (
          <p className="text-slate-400 text-sm">No standing foursomes yet.</p>
        ) : (
          <div className="space-y-4">
            {foursomes.map((foursome) => (
              <div key={foursome.id} className="bg-slate-900/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white font-semibold">{foursome.name}</p>
                  <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-full">
                    {foursome.memberCount} members
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {foursome.members.map((m, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.displayName} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-xs font-bold">
                          {m.displayName.charAt(0)}
                        </div>
                      )}
                      <span className="text-slate-300 text-sm">{m.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Round History */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📅</span> Round History
        </h3>
        {roundHistory.length === 0 ? (
          <p className="text-slate-400 text-sm">No rounds played yet.</p>
        ) : (
          <div className="space-y-3">
            {roundHistory.map((round) => (
              <div key={round.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">{round.courseName}</p>
                    <p className="text-slate-400 text-sm">{round.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {round.rating && (
                    <div className="flex items-center gap-1 text-yellow-400">
                      {[...Array(round.rating)].map((_, i) => (
                        <span key={i} className="text-sm">★</span>
                      ))}
                    </div>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                    round.wouldPlayAgain
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {round.wouldPlayAgain ? 'Would play again' : 'No thanks'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visibility Settings — SUMMIT only */}
      {profile.tierSlug === 'summit' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <span>🔒</span> Summit Privacy Mode
          </h3>
          <p className="text-slate-400 text-sm mb-4">Control who can see your profile in discovery.</p>
          <div className="space-y-2">
            {([
              { value: 'everyone', label: 'Everyone' },
              { value: 'select_above', label: 'Select & Above' },
              { value: 'summit_only', label: 'Summit Only' },
            ] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => handleVisibilityChange(option.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  visibility === option.value
                    ? 'border-yellow-500/50 bg-yellow-500/10 text-white'
                    : 'border-slate-600 bg-slate-900/50 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  visibility === option.value ? 'border-yellow-400' : 'border-slate-500'
                }`}>
                  {visibility === option.value && (
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  )}
                </div>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hunt Mode — SELECT only */}
      {profile.tierSlug === 'select' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>🎯</span> Hunt Mode
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Enable to see FREE-tier members in your discovery results.
              </p>
            </div>
            <button
              onClick={handleHuntModeToggle}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                huntModeEnabled ? 'bg-blue-500' : 'bg-slate-600'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                huntModeEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
