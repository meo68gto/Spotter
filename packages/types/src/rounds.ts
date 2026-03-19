// ============================================================================
// Phase 2: Round Coordination & Scheduling Types
// ============================================================================

import type { UUID } from "./index.js";

// ----------------------------------------------------------------------------
// Round Status Enum
// ----------------------------------------------------------------------------

/**
 * Possible statuses for a golf round
 */
export type RoundStatus = 
  | 'draft'      // Round being created
  | 'open'       // Accepting participants
  | 'full'       // Max players reached
  | 'confirmed'  // All spots filled, ready to play
  | 'in_progress'// Round is happening now
  | 'completed'  // Round finished
  | 'cancelled'; // Round cancelled by creator

/**
 * Possible statuses for a round invitation
 */
export type InvitationStatus = 
  | 'pending'   // Awaiting response
  | 'accepted'  // User accepted invite
  | 'declined'  // User declined invite
  | 'expired';  // Invite expired

/**
 * Cart preference options
 */
export type CartPreference = 'walking' | 'cart' | 'either';

// ----------------------------------------------------------------------------
// Round Interface
// ----------------------------------------------------------------------------

/**
 * Core round entity for foursome coordination
 */
export interface Round {
  /** Unique identifier for the round */
  id: UUID;
  
  /** User who created the round */
  creatorId: UUID;
  
  /** Course where the round is scheduled */
  courseId: UUID;
  
  /** Date and time of the round */
  scheduledAt: string; // ISO 8601 datetime
  
  /** Maximum number of players (2, 3, or 4) */
  maxPlayers: number;
  
  /** Preferred cart option */
  cartPreference: CartPreference;
  
  /** Tier ID for same-tier enforcement */
  tierId: UUID;
  
  /** Current status of the round */
  status: RoundStatus;
  
  /** Optional notes from creator */
  notes?: string;
  
  /** When the round was created */
  createdAt: string;
  
  /** When the round was last updated */
  updatedAt: string;
}

/**
 * Round with joined course data
 */
export interface RoundWithCourse extends Round {
  /** Joined course data */
  course: {
    id: UUID;
    name: string;
    city: string;
    state: string;
  };
  
  /** Current number of confirmed participants */
  confirmedParticipants: number;
  
  /** Whether the requesting user is a participant */
  isParticipant?: boolean;
  
  /** Current user's invitation status if applicable */
  myInvitationStatus?: InvitationStatus;
}

// ----------------------------------------------------------------------------
// Round Invitation Interface
// ----------------------------------------------------------------------------

/**
 * Invitation to join a round
 */
export interface RoundInvitation {
  /** Unique identifier for the invitation */
  id: UUID;
  
  /** Round being invited to */
  roundId: UUID;
  
  /** User being invited */
  inviteeId: UUID;
  
  /** Current status of the invitation */
  status: InvitationStatus;
  
  /** Optional message from inviter */
  message?: string;
  
  /** When the invitation was sent */
  invitedAt: string;
  
  /** When the invitee responded (null if pending) */
  respondedAt?: string;
}

/**
 * Round invitation with joined round data
 */
export interface RoundInvitationWithRound extends RoundInvitation {
  /** Joined round data */
  round: RoundWithCourse;
  
  /** Invitee profile info */
  invitee?: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
  };
}

// ----------------------------------------------------------------------------
// Round Participant Interface
// ----------------------------------------------------------------------------

/**
 * Confirmed participant in a round
 */
export interface RoundParticipant {
  /** Unique identifier */
  id: UUID;
  
  /** Round reference */
  roundId: UUID;
  
  /** User reference */
  userId: UUID;
  
  /** Whether this user is the round creator */
  isCreator: boolean;
  
  /** When they joined the round */
  joinedAt: string;
}

/**
 * Participant with user profile data
 */
export interface RoundParticipantWithUser extends RoundParticipant {
  /** User profile data */
  user: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
    currentHandicap?: number;
  };
}

// ----------------------------------------------------------------------------
// Input Types
// ----------------------------------------------------------------------------

/**
 * Input for creating a new round
 */
export interface CreateRoundInput {
  /** Course ID where the round takes place */
  courseId: UUID;
  
  /** Date and time of the round (ISO 8601) */
  scheduledAt: string;
  
  /** Maximum players (2, 3, or 4) */
  maxPlayers?: number;
  
  /** Cart preference (default: either) */
  cartPreference?: CartPreference;
  
  /** Optional notes */
  notes?: string;
  
  /** Initial invitee IDs to invite after creation */
  inviteeIds?: UUID[];
}

/**
 * Input for updating a round
 */
export interface UpdateRoundInput {
  /** Updated scheduled time */
  scheduledAt?: string;
  
  /** Updated max players */
  maxPlayers?: number;
  
  /** Updated cart preference */
  cartPreference?: CartPreference;
  
  /** Updated notes */
  notes?: string;
  
  /** Updated status */
  status?: RoundStatus;
}

/**
 * Input for inviting a user to a round
 */
export interface InviteToRoundInput {
  /** Round ID to invite to */
  roundId: UUID;
  
  /** User ID to invite */
  userId: UUID;
  
  /** Optional message */
  message?: string;
}

/**
 * Input for responding to a round invitation
 */
export interface RespondToRoundInput {
  /** Round ID (alternative to invitationId) */
  roundId?: UUID;
  
  /** Invitation ID (alternative to roundId) */
  invitationId?: UUID;
  
  /** Response action */
  action: 'accept' | 'decline';
}

/**
 * Input for filtering rounds
 */
export interface RoundFilters {
  /** Filter by course ID */
  courseId?: UUID;
  
  /** Filter by creator ID */
  creatorId?: UUID;
  
  /** Filter by status */
  status?: RoundStatus | RoundStatus[];
  
  /** Filter by date range start */
  dateFrom?: string;
  
  /** Filter by date range end */
  dateTo?: string;
  
  /** Filter by tier ID */
  tierId?: UUID;
  
  /** Include only rounds the user is invited to */
  invitedOnly?: boolean;
  
  /** Include only rounds the user is participating in */
  participatingOnly?: boolean;
  
  /** Maximum results to return */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
}

// ----------------------------------------------------------------------------
// Response Types
// ----------------------------------------------------------------------------

/**
 * API response for round operations
 */
export interface RoundApiResponse {
  /** The round data */
  data: Round | RoundWithCourse | Round[];
  
  /** Error message if operation failed */
  error?: string;
  
  /** Error code for programmatic handling */
  code?: string;
}

/**
 * API response for invitation operations
 */
export interface InvitationApiResponse {
  /** The invitation data */
  data: RoundInvitation | RoundInvitation[];
  
  /** Error message if operation failed */
  error?: string;
  
  /** Error code for programmatic handling */
  code?: string;
}

/**
 * Round list response with pagination
 */
export interface RoundListResponse {
  /** List of rounds */
  data: RoundWithCourse[];
  
  /** Pagination info */
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/**
 * Valid round statuses with metadata
 */
export const ROUND_STATUS_META: Record<RoundStatus, { 
  label: string; 
  description: string; 
  isActive: boolean;
  canJoin: boolean;
}> = {
  draft: {
    label: 'Draft',
    description: 'Round is being created',
    isActive: false,
    canJoin: false,
  },
  open: {
    label: 'Open',
    description: 'Round is accepting participants',
    isActive: true,
    canJoin: true,
  },
  full: {
    label: 'Full',
    description: 'Round has reached maximum players',
    isActive: true,
    canJoin: false,
  },
  confirmed: {
    label: 'Confirmed',
    description: 'All spots filled, ready to play',
    isActive: true,
    canJoin: false,
  },
  in_progress: {
    label: 'In Progress',
    description: 'Round is currently being played',
    isActive: true,
    canJoin: false,
  },
  completed: {
    label: 'Completed',
    description: 'Round has finished',
    isActive: false,
    canJoin: false,
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Round was cancelled by creator',
    isActive: false,
    canJoin: false,
  },
};

/**
 * Valid invitation statuses with metadata
 */
export const INVITATION_STATUS_META: Record<InvitationStatus, { 
  label: string; 
  description: string;
}> = {
  pending: {
    label: 'Pending',
    description: 'Awaiting response',
  },
  accepted: {
    label: 'Accepted',
    description: 'User will attend the round',
  },
  declined: {
    label: 'Declined',
    description: 'User declined the invitation',
  },
  expired: {
    label: 'Expired',
    description: 'Invitation expired',
  },
};

/**
 * Cart preferences with labels
 */
export const CART_PREFERENCE_OPTIONS: Record<CartPreference, { 
  label: string; 
  description: string;
}> = {
  walking: {
    label: 'Walking',
    description: 'Prefer to walk the course',
  },
  cart: {
    label: 'Riding',
    description: 'Prefer to ride in a cart',
  },
  either: {
    label: 'Either',
    description: 'No preference - walking or riding',
  },
};

/**
 * Default round values
 */
export const ROUND_DEFAULTS = {
  maxPlayers: 4,
  cartPreference: 'either' as CartPreference,
} as const;

/**
 * Valid max players options
 */
export const VALID_MAX_PLAYERS = [2, 3, 4] as const;

// ----------------------------------------------------------------------------
// Type Guards
// ----------------------------------------------------------------------------

/**
 * Check if a string is a valid RoundStatus
 */
export function isValidRoundStatus(status: string): status is RoundStatus {
  return ['draft', 'open', 'full', 'confirmed', 'in_progress', 'completed', 'cancelled'].includes(status);
}

/**
 * Check if a string is a valid InvitationStatus
 */
export function isValidInvitationStatus(status: string): status is InvitationStatus {
  return ['pending', 'accepted', 'declined', 'expired'].includes(status);
}

/**
 * Check if a string is a valid CartPreference
 */
export function isValidCartPreference(pref: string): pref is CartPreference {
  return ['walking', 'cart', 'either'].includes(pref);
}

/**
 * Check if a number is a valid max players value
 */
export function isValidMaxPlayers(num: number): boolean {
  return VALID_MAX_PLAYERS.includes(num as any);
}

/**
 * Check if a round can be joined
 */
export function canJoinRound(round: Round): boolean {
  return round.status === 'open';
}

/**
 * Check if a round can be edited by the creator
 */
export function canEditRound(round: Round, userId: UUID): boolean {
  return round.creatorId === userId && !['in_progress', 'completed', 'cancelled'].includes(round.status);
}

/**
 * Check if a round can be cancelled
 */
export function canCancelRound(round: Round, userId: UUID): boolean {
  return round.creatorId === userId && !['in_progress', 'completed', 'cancelled'].includes(round.status);
}
