/**
 * Mobile auth utilities — PKCE-based session management for Expo/React Native.
 *
 * Consumed by:
 *   - apps/mobile/src/lib/supabase.ts
 *   - apps/mobile/src/hooks/useAuth.ts
 *
 * Uses AsyncStorage for token persistence and expo-auth-session for PKCE flow.
 * This module provides token refresh and session lifecycle helpers.
 */
import type { UserSession } from './types.js';

// ---------------------------------------------------------------------------
// Session storage keys
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'spotter_access_token',
  REFRESH_TOKEN: 'spotter_refresh_token',
  USER_SESSION: 'spotter_user_session',
} as const;

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Supabase auth token payload (JWT) to extract expiry.
 * Returns Unix timestamp in ms, or null if not parseable.
 */
export function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return null;
    return payload.exp * 1000; // convert sec → ms
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired or about to expire (within 60s buffer).
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  const expiry = getTokenExpiry(token);
  if (expiry === null) return false; // can't parse → assume valid
  return Date.now() >= expiry - 60_000; // 60s buffer
}

/**
 * Extract the user ID from a JWT access token without verification.
 * Used for quick local lookups. DO NOT use for auth decisions.
 */
export function getUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session shape builders (for type-safe mock/test sessions)
// ---------------------------------------------------------------------------

/**
 * Build a minimal UserSession from raw Supabase auth session data.
 */
export function buildUserSession(
  user: { id: string; email?: string; role?: 'golfer' | 'operator' | 'admin' },
  accessToken: string,
  refreshToken?: string
): UserSession {
  return {
    userId: user.id,
    email: user.email ?? '',
    displayName: user.email?.split('@')[0],
    role: user.role ?? 'golfer',
    accessToken,
    refreshToken,
    expiresAt: getTokenExpiry(accessToken) ?? undefined,
  };
}
