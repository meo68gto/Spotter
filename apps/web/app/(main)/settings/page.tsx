'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type TierSlug = 'free' | 'select' | 'summit'
type ProfileVisibility = 'visible' | 'select_only' | 'summit_only'
type DiscoveryVisibility = 'visible' | 'hidden'

interface NotificationSettings {
  rounds: boolean
  connections: boolean
  messages: boolean
  events: boolean
}

const TIER_CONFIG: Record<TierSlug, { bg: string; text: string; label: string; color: string }> = {
  free: { bg: 'bg-slate-600/30', text: 'text-slate-300', label: 'FREE', color: 'text-slate-400' },
  select: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'SELECT', color: 'text-blue-400' },
  summit: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'SUMMIT', color: 'text-yellow-400' },
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tierSlug, setTierSlug] = useState<TierSlug>('free')
  const [displayName, setDisplayName] = useState('')
  const [notifications, setNotifications] = useState<NotificationSettings>({
    rounds: true,
    connections: true,
    messages: true,
    events: false,
  })
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>('visible')
  const [discoveryVisible, setDiscoveryVisible] = useState<DiscoveryVisibility>('visible')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      setDisplayName(user.email?.split('@')[0] || '')

      const { data } = await supabase
        .from('profiles')
        .select('display_name, tier_slug, profile_visibility')
        .eq('id', user.id)
        .single()

      if (data) {
        setDisplayName(data.display_name || user.email?.split('@')[0] || '')
        setTierSlug((data.tier_slug || 'free') as TierSlug)
        setProfileVisibility((data.profile_visibility || 'visible') as ProfileVisibility)
      }

      const { data: notifData } = await supabase
        .from('user_notification_settings')
        .select('round_updates, connection_requests, messages, events')
        .eq('user_id', user.id)
        .single()

      if (notifData) {
        setNotifications({
          rounds: notifData.round_updates ?? true,
          connections: notifData.connection_requests ?? true,
          messages: notifData.messages ?? true,
          events: notifData.events ?? false,
        })
      }
    }
    getUser()
  }, [router, supabase])

  const handleToggleNotification = async (key: keyof NotificationSettings) => {
    const newValue = !notifications[key]
    setNotifications(prev => ({ ...prev, [key]: newValue }))
    setSaving(true)
    const fieldMap: Record<keyof NotificationSettings, string> = {
      rounds: 'round_updates',
      connections: 'connection_requests',
      messages: 'messages',
      events: 'events',
    }
    await supabase
      .from('user_notification_settings')
      .upsert({ user_id: user.id, [fieldMap[key]]: newValue })
    setSaving(false)
  }

  const handleVisibilityChange = async (v: ProfileVisibility) => {
    setProfileVisibility(v)
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ profile_visibility: v })
      .eq('id', user.id)
    setSaving(false)
  }

  const handleDiscoveryToggle = async () => {
    const newValue = discoveryVisible === 'visible' ? 'hidden' : 'visible'
    setDiscoveryVisible(newValue)
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ profile_visibility: newValue === 'hidden' ? 'select_only' : 'visible' })
      .eq('id', user.id)
    setSaving(false)
  }

  const handleSignOut = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleDeleteAccount = async () => {
    setLoading(true)
    try {
      await supabase.auth.admin.deleteUser(user.id)
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const nextTier: TierSlug | null = tierSlug === 'free' ? 'select' : tierSlug === 'select' ? 'summit' : null

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and preferences</p>
      </div>

      {/* Account Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>👤</span> Account
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Display Name</label>
            <div className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white">
              {displayName}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
            <div className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white">
              {user?.email || 'Loading...'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Current Plan</label>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-xl text-sm font-bold ${TIER_CONFIG[tierSlug].bg} ${TIER_CONFIG[tierSlug].text}`}>
                {TIER_CONFIG[tierSlug].label}
              </span>
              {nextTier && (
                <Link
                  href="/upgrade"
                  className="text-sm text-green-400 hover:text-green-300 font-medium flex items-center gap-1"
                >
                  Upgrade to {TIER_CONFIG[nextTier].label} →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🔔</span> Notifications
          </h3>
          {saving && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          )}
        </div>
        <div className="space-y-1">
          {([
            { key: 'rounds' as const, label: 'Round Updates', desc: 'Notifications when rounds are scheduled or changed' },
            { key: 'connections' as const, label: 'Connection Requests', desc: 'New connection and follow requests' },
            { key: 'messages' as const, label: 'Messages', desc: 'Direct messages from other members' },
            { key: 'events' as const, label: 'Events', desc: 'Tournament and event announcements' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
              <div>
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => handleToggleNotification(key)}
                className={`relative w-11 h-6 rounded-full transition-colors ml-4 shrink-0 ${
                  notifications[key] ? 'bg-green-500' : 'bg-slate-600'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  notifications[key] ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <span>🔒</span> Privacy
        </h3>
        <div className="space-y-4">
          {/* Profile Visibility */}
          <div>
            <p className="text-white text-sm font-medium mb-2">Profile Visibility</p>
            <div className="space-y-2">
              {([
                { value: 'visible' as ProfileVisibility, label: 'Everyone', desc: 'All members can see your profile' },
                { value: 'select_only' as ProfileVisibility, label: 'Select & Above', desc: 'Only Select and Summit members' },
                { value: 'summit_only' as ProfileVisibility, label: 'Summit Only', desc: 'Only Summit members can see you' },
              ]).map(option => (
                <button
                  key={option.value}
                  onClick={() => handleVisibilityChange(option.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    profileVisibility === option.value
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    profileVisibility === option.value ? 'border-green-400' : 'border-slate-500'
                  }`}>
                    {profileVisibility === option.value && (
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${profileVisibility === option.value ? 'text-white' : 'text-slate-300'}`}>
                      {option.label}
                    </p>
                    <p className="text-slate-500 text-xs">{option.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Discovery Visibility */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-700">
            <div>
              <p className="text-white text-sm font-medium">Appear in Discovery</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {discoveryVisible === 'visible' ? 'You appear in member search' : 'You are hidden from search'}
              </p>
            </div>
            <button
              onClick={handleDiscoveryToggle}
              className={`relative w-11 h-6 rounded-full transition-colors ml-4 ${
                discoveryVisible === 'visible' ? 'bg-green-500' : 'bg-slate-600'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                discoveryVisible === 'visible' ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tier / Upgrade Section */}
      {tierSlug !== 'summit' && (
        <div className="bg-gradient-to-r from-blue-600/20 to-green-600/20 border border-blue-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-1">
                {tierSlug === 'free' ? 'Upgrade to Select' : 'Upgrade to Summit'}
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                {tierSlug === 'free'
                  ? 'Unlock coaching, priority matching, and unlimited rounds.'
                  : 'Get Summit privacy mode, search boost, and all features.'}
              </p>
              <Link
                href="/upgrade"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors text-sm"
              >
                Upgrade Now →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🚪</span> Session
        </h3>
        <button
          onClick={handleSignOut}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50"
        >
          {loading ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
          Sign Out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
          <span>⚠️</span> Danger Zone
        </h3>
        <p className="text-slate-400 text-sm mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium transition-colors"
          >
            Delete Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-red-400 text-sm font-medium">Are you sure? This is permanent.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Yes, Delete Forever
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
