/**
 * Shared auth types — consumed by web, web-admin, and mobile.
 */

export type UserRole = 'golfer' | 'operator' | 'admin';

export type OrganizerRole = 'owner' | 'admin' | 'manager' | 'viewer';

/**
 * Session object for authenticated operator web app users.
 * Used in middleware and server components for auth checks.
 */
export interface OperatorSession {
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
  organizerId?: string;
  memberRole?: OrganizerRole;
}

/**
 * Session object for authenticated mobile/web users (golfer sessions).
 */
export interface UserSession {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: UserRole;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Result of a session fetch — either a valid session or null.
 */
export type SessionResult<T extends UserSession | OperatorSession = OperatorSession> =
  | { data: T; error: null }
  | { data: null; error: AuthError };

/**
 * Authentication error shape.
 */
export interface AuthError {
  message: string;
  code: string;
  status?: number;
}

/**
 * Options for creating a Supabase client (web/mobile).
 */
export interface SupabaseClientOptions {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  authCallbackUrl?: string;
}
