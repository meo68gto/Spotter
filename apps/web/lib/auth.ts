/**
 * Web auth — re-exports from @spotter/auth for backward compatibility.
 * The canonical implementation lives in packages/auth/src/web.ts.
 */
export {
  getSession,
  getSessionFromCookie,
  isOperatorOrAdmin,
  hasOrganizerMembership,
} from '@spotter/auth/web';
export type { OperatorSession } from '@spotter/auth/web';
