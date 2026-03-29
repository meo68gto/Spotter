'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

type TierSlug = 'free' | 'select' | 'summit'
type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'scratch' | 'plus'

interface GolferCard {
  id: string
  displayName: string
  avatarUrl?: string
  tier: TierSlug
  skillLevel: SkillLevel
  location?: string
  mutualConnections: number
  lastPlayed?: string
}

const MOCK_GOLFERS: GolferCard[] = [
  { id: '1', displayName: 'Mike Chen', tier: 'select', skillLevel: 'intermediate', location: 'Scottsdale, AZ', mutualConnections: 5, lastPlayed: '2 days ago' },
  { id: '2', displayName: 'Sarah Johnson', tier: 'summit', skillLevel: 'scratch', location: 'Phoenix, AZ', mutualConnections: 12, lastPlayed: '1 week ago' },
  { id: '3', displayName: 'James Wilson', tier: 'free', skillLevel: 'beginner', location: 'Mesa, AZ', mutualConnections: 2 },
  { id: '4', displayName: 'Lisa Rodriguez', tier: 'select', skillLevel: 'advanced', location: 'Gilbert, AZ', mutualConnections: 8, lastPlayed: '3 days ago' },
  { id: '5', displayName: 'Tom Bradley', tier: 'free', skillLevel: 'intermediate', location: 'Tempe, AZ', mutualConnections: 3 },
  { id: '6', displayName: 'Amy Foster', tier: 'select', skillLevel: 'plus', location: 'Chandler, AZ', mutualConnections: 15, lastPlayed: 'Yesterday' },
  { id: '7', displayName: 'David Kim', tier: 'summit', skillLevel: 'scratch', location: 'Scottsdale, AZ', mutualConnections: 20, lastPlayed: '4 days ago' },
  { id: '8', displayName: 'Rachel Green', tier: 'free', skillLevel: 'beginner', location: 'Phoenix, AZ', mutualConnections: 1 },
  { id: '9', displayName: 'Chris Martinez', tier: 'select', skillLevel: 'intermediate', location: 'Gilbert, AZ', mutualConnections: 6, lastPlayed: '1 week ago' },
]

const TIER_COLORS: Record<TierSlug, { bg: string; text: string; border: string; label: string }> = {
  free: { bg: 'bg-slate-600/30', text: 'text-slate-300', border: 'border-slate-500/30', label: 'FREE' },
  select: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'SELECT' },
  summit: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'SUMMIT' },
}

const SKILL_COLORS: Record<SkillLevel, string> = {
  beginner: 'text-green-400',
  intermediate: 'text-blue-400',
  advanced: 'text-purple-400',
  scratch: 'text-orange-400',
  plus: 'text-red-400',
}

export default function DiscoveryPage() {
  const [golfers, setGolfers] = useState<GolferCard[]>(MOCK_GOLFERS)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<TierSlug | 'all'>('all')
  const [skillFilter, setSkillFilter] = useState<SkillLevel | 'all'>('all')
  const [huntMode, setHuntMode] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const supabase = createBrowserClient()

  const filteredGolfers = golfers.filter((g) => {
    const matchesSearch = g.displayName.toLowerCase().includes(search.toLowerCase()) ||
      g.location?.toLowerCase().includes(search.toLowerCase())
    const matchesTier = tierFilter === 'all' || g.tier === tierFilter
    const matchesSkill = skillFilter === 'all' || g.skillLevel === skillFilter
    // Hunt mode: FREE users see SELECT members; SELECT see FREE too
    const matchesHunt = !huntMode || (g.tier === 'select')
    return matchesSearch && matchesTier && matchesSkill && matchesHunt
  })

  const handleConnect = async (golferId: string) => {
    setConnecting(golferId)
    // Simulate API call
    await new Promise(r => setTimeout(r, 1000))
    setConnecting(null)
    // In production: call POST /connections-request
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Find Golfers</h1>
        <p className="text-slate-400 mt-1">Discover players near you</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or location..."
          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-colors"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tier Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTierFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tierFilter === 'all'
                ? 'bg-green-500 text-white'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
            }`}
          >
            All Tiers
          </button>
          {(['free', 'select', 'summit'] as TierSlug[]).map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter(tierFilter === tier ? 'all' : tier)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tierFilter === tier
                  ? `${TIER_COLORS[tier].bg} ${TIER_COLORS[tier].text} border ${TIER_COLORS[tier].border}`
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
              }`}
            >
              {TIER_COLORS[tier].label}
            </button>
          ))}
        </div>

        {/* Skill Filter */}
        <div className="h-6 w-px bg-slate-700" />
        <select
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value as SkillLevel | 'all')}
          className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500/50"
        >
          <option value="all">All Skill Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="scratch">Scratch</option>
          <option value="plus">Plus Handicap</option>
        </select>

        {/* Hunt Mode Toggle */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-slate-400">Hunt Mode</span>
          <button
            onClick={() => setHuntMode(!huntMode)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              huntMode ? 'bg-blue-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                huntMode ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors md:hidden"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </button>
      </div>

      {/* Hunt Mode Banner */}
      {huntMode && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm">🎯</div>
          <div>
            <p className="text-blue-300 font-medium">Hunt Mode Active</p>
            <p className="text-blue-400/70 text-sm">You can now see and connect with SELECT members</p>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">
          {filteredGolfers.length} golfer{filteredGolfers.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Golfer Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full bg-slate-700" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-700 rounded w-24 mb-2" />
                  <div className="h-3 bg-slate-700 rounded w-16" />
                </div>
              </div>
              <div className="h-3 bg-slate-700 rounded w-full mb-2" />
              <div className="h-3 bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filteredGolfers.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-slate-400 font-medium">No golfers found</p>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGolfers.map((golfer) => (
            <div
              key={golfer.id}
              className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-600 transition-all"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  {golfer.avatarUrl ? (
                    <img src={golfer.avatarUrl} alt={golfer.displayName} className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-xl">
                      {golfer.displayName.charAt(0)}
                    </div>
                  )}
                  {/* Online indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-slate-800" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold truncate">{golfer.displayName}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${TIER_COLORS[golfer.tier].bg} ${TIER_COLORS[golfer.tier].text} ${TIER_COLORS[golfer.tier].border} border`}>
                      {TIER_COLORS[golfer.tier].label}
                    </span>
                  </div>
                  {golfer.location && (
                    <p className="text-slate-400 text-sm truncate">{golfer.location}</p>
                  )}
                </div>
              </div>

              {/* Info Row */}
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className={`font-medium capitalize ${SKILL_COLORS[golfer.skillLevel]}`}>
                    {golfer.skillLevel}
                  </span>
                </div>
                {golfer.mutualConnections > 0 && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-slate-300">{golfer.mutualConnections} mutual</span>
                  </div>
                )}
              </div>

              {/* Last Played */}
              {golfer.lastPlayed && (
                <p className="text-slate-500 text-xs mb-4">Last played {golfer.lastPlayed}</p>
              )}

              {/* Connect Button */}
              <button
                onClick={() => handleConnect(golfer.id)}
                disabled={connecting === golfer.id}
                className="w-full py-2.5 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {connecting === golfer.id ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Connect
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
