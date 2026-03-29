import { createBrowserClient, createServerClient } from './supabase/server'
import type { OperatorSession } from '@spotter/types'

function getBrowserClient() {
  return createBrowserClient()
}

function getServerClient() {
  return createServerClient()
}

/**
 * Internal — fetches user + profile from the auth cookie session.
 * Exported so lib/operator/auth.ts can reuse the same logic.
 */
export async function getSessionFromCookie(): Promise<OperatorSession | null> {
  const supabase = getServerClient()
  if (!supabase) return null

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, display_name, email, user_role')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const { data: member } = await supabase
    .from('organizer_members')
    .select('organizer_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return {
    userId: profile.id,
    displayName: profile.display_name ?? profile.email?.split('@')[0] ?? 'User',
    email: profile.email,
    role: (profile.user_role as 'golfer' | 'operator' | 'admin') ?? 'golfer',
    organizerId: member?.organizer_id,
    memberRole: member?.role as 'owner' | 'admin' | 'manager' | 'viewer' | undefined,
  }
}

/**
 * Get the current user session from cookies (server-side).
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<OperatorSession | null> {
  return getSessionFromCookie()
}

/**
 * Get the browser client (for client components).
 */
export function getSessionBrowser() {
  const supabase = getBrowserClient()
  return supabase.auth.getUser()
}
