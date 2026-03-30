/**
 * @spotter/auth — Shared auth primitives for Spotter.
 *
 * Usage:
 *   import { getSession, type OperatorSession } from '@spotter/auth/web';
 *   import { isTokenExpired, getUserIdFromToken } from '@spotter/auth/mobile';
 *   import type { UserSession } from '@spotter/auth/types';
 */

// Web auth — server-side cookie session management
export { getSession, getSessionFromCookie, isOperatorOrAdmin, hasOrganizerMembership } from './web.js';

// Mobile auth — token utilities for PKCE flows
export { getTokenExpiry, isTokenExpired, getUserIdFromToken, buildUserSession } from './mobile.js';

// Shared types
export type {
  UserSession,
  AuthError,
  SessionResult,
  SupabaseClientOptions,
} from './types.js';
