// ============================================================================
// Epic 5: Rounds as Social Infrastructure - Complete Types
// ============================================================================

import type { UUID } from "./index.js";

// ----------------------------------------------------------------------------
// Legacy Round Status (for backwards compatibility)
// ----------------------------------------------------------------------------

export type RoundStatus = 
  | 'draft'
  | 'open'
  | 'full'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type InvitationStatus = 
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired';

export type CartPreference = 'walking' | 'cart' | 'either';

// ----------------------------------------------------------------------------
// NEW: Round Lifecycle Status (Epic 5)
// More granular states for social round flow
// ----------------------------------------------------------------------------

export type RoundLifecycleStatus =
  | 'planning'      // Initial creation, building the group
  | 'invited'       // Invitations sent, awaiting responses
  | 'confirmed'     // All players confirmed
  | 'played'        // Round has been played
  | 'review_pending' // Awaiting post-round ratings
  | 'reviewed'      // All ratings submitted
  | 'review_closed' // Rating window closed
  | 'cancelled';    // Round was cancelled

// ----------------------------------------------------------------------------
// NEW: Round Source Type (Epic 5)
// Tracks how the round was created
// ----------------------------------------------------------------------------

export type RoundSourceType =
  | 'standing_foursome'  // Created from a standing foursome
  | 'network_invite'     // Invited via network connection
  | 'discovery'          // Found through discovery/matching
  | 'direct';            // Direct creation

// ----------------------------------------------------------------------------
// NEW: Standing Foursome Types (Epic 5)
// ----------------------------------------------------------------------------

export type FoursomeCadence = 'weekly' | 'biweekly' | 'monthly' | 'flexible';
export type FoursomePreferredDay = 'weekday' | 'weekend' | 'flexible';
export type FoursomePreferredTime = 'morning' | 'midday' | 'afternoon' | 'flexible';
export type StandingFoursomeStatus = 'active' | 'paused' | 'disbanded';

export interface StandingFoursome {
  id: UUID;
  name: string;
  description?: string;
  organizerId: UUID;
  preferredCourseId?: UUID;
  cadence: FoursomeCadence;
  preferredDay?: FoursomePreferredDay;
  preferredTime?: FoursomePreferredTime;
  roundsPlayedCount: number;
  lastRoundAt?: string;
  nextRoundAt?: string;
  status: StandingFoursomeStatus;
  tierId: UUID;
  createdAt: string;
  updatedAt: string;
}

export interface StandingFoursomeMember {
  foursomeId: UUID;
  userId: UUID;
  displayName: string;
  avatarUrl?: string;
  role: 'organizer' | 'member';
  joinedAt: string;
}

export interface StandingFoursomeWithMembers extends StandingFoursome {
  members: StandingFoursomeMember[];
  organizer: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
  };
  preferredCourse?: {
    id: UUID;
    name: string;
    city: string;
    state: string;
  };
}

// ----------------------------------------------------------------------------
// NEW: Round Rating Types (Epic 5)
// Post-round player ratings
// ----------------------------------------------------------------------------

export interface RoundRating {
  id: UUID;
  roundId: UUID;
  raterId: UUID;
  rateeId: UUID;
  punctuality: number;      // 1-5
  golfEtiquette: number;    // 1-5
  enjoyment: number;        // 1-5
  businessValue?: number;   // 1-5 (optional)
  playAgain: boolean;
  wouldIntroduce: boolean;
  privateNote?: string;
  publicCompliment?: string;
  publicComplimentApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoundRatingInput {
  rateeId: string;
  punctuality: number;
  golfEtiquette: number;
  enjoyment: number;
  businessValue?: number;
  playAgain: boolean;
  wouldIntroduce: boolean;
  privateNote?: string;
  publicCompliment?: string;
}

export interface RoundRatingAggregate {
  userId: UUID;
  totalRoundsRated: number;
  avgPunctuality: number;
  avgGolfEtiquette: number;
  avgEnjoyment: number;
  avgBusinessValue?: number;
  playAgainPercentage: number;
  wouldIntroducePercentage: number;
}

// ----------------------------------------------------------------------------
// Round Interface (UPDATED for Epic 5)
// ----------------------------------------------------------------------------

export interface Round {
  id: UUID;
  creatorId: UUID;
  courseId: UUID;
  scheduledAt: string;
  maxPlayers: number;
  cartPreference: CartPreference;
  tierId: UUID;
  status: RoundStatus;
  lifecycleStatus?: RoundLifecycleStatus;  // NEW (Epic 5)
  sourceType?: RoundSourceType;           // NEW (Epic 5)
  standingFoursomeId?: UUID;              // NEW (Epic 5)
  networkContext?: RoundNetworkContext;  // NEW (Epic 5)
  playedAt?: string;                    // NEW (Epic 5)
  reviewedAt?: string;                 // NEW (Epic 5)
  reviewWindowClosesAt?: string;         // NEW (Epic 5)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// NEW: Network Context (Epic 5)
// Tracks network-driven round creation
// ----------------------------------------------------------------------------

export interface RoundNetworkContext {
  mutualConnections?: UUID[];
  sharedMemberships?: UUID[];
  referralSource?: string;
  introductionId?: UUID;
}

// ----------------------------------------------------------------------------
// Round With Joined Data
// ----------------------------------------------------------------------------

export interface RoundWithCourse extends Round {
  course: {
    id: UUID;
    name: string;
    city: string;
    state: string;
  };
  confirmedParticipants: number;
  isParticipant?: boolean;
  myInvitationStatus?: InvitationStatus;
  // NEW: Standing foursome info (Epic 5)
  standingFoursome?: {
    id: UUID;
    name: string;
  };
}

// ----------------------------------------------------------------------------
// Round Invitation Interface
// ----------------------------------------------------------------------------

export interface RoundInvitation {
  id: UUID;
  roundId: UUID;
  inviteeId: UUID;
  status: InvitationStatus;
  message?: string;
  invitedAt: string;
  respondedAt?: string;
}

export interface RoundInvitationWithRound extends RoundInvitation {
  round: RoundWithCourse;
  invitee?: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
  };
}

// ----------------------------------------------------------------------------
// Round Participant Interface
// ----------------------------------------------------------------------------

export interface RoundParticipant {
  id: UUID;
  roundId: UUID;
  userId: UUID;
  isCreator: boolean;
  joinedAt: string;
}

export interface RoundParticipantWithUser extends RoundParticipant {
  user: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
    currentHandicap?: number;
  };
}

// ----------------------------------------------------------------------------
// Input Types (UPDATED for Epic 5)
// ----------------------------------------------------------------------------

export interface CreateRoundInput {
  courseId: UUID;
  scheduledAt: string;
  maxPlayers?: number;
  cartPreference?: CartPreference;
  notes?: string;
  // NEW (Epic 5)
  sourceType?: RoundSourceType;
  standingFoursomeId?: UUID;
  networkContext?: RoundNetworkContext;
  inviteeIds?: UUID[];
}

export interface UpdateRoundInput {
  scheduledAt?: string;
  maxPlayers?: number;
  cartPreference?: CartPreference;
  notes?: string;
  status?: RoundStatus;
  lifecycleStatus?: RoundLifecycleStatus;  // NEW (Epic 5)
}

export interface InviteToRoundInput {
  roundId: UUID;
  userId: UUID;
  message?: string;
}

export interface RespondToRoundInput {
  roundId?: UUID;
  invitationId?: UUID;
  action: 'accept' | 'decline';
}

export interface RoundFilters {
  courseId?: UUID;
  creatorId?: UUID;
  status?: RoundStatus | RoundStatus[];
  lifecycleStatus?: RoundLifecycleStatus | RoundLifecycleStatus[];  // NEW (Epic 5)
  sourceType?: RoundSourceType;  // NEW (Epic 5)
  dateFrom?: string;
  dateTo?: string;
  tierId?: UUID;
  invitedOnly?: boolean;
  participatingOnly?: boolean;
  // NEW (Epic 5)
  standingFoursomeId?: UUID;
  pendingReview?: boolean;  // Filter for rounds awaiting ratings
  limit?: number;
  offset?: number;
}

// ----------------------------------------------------------------------------
// NEW: Standing Foursome Input Types (Epic 5)
// ----------------------------------------------------------------------------

export interface CreateStandingFoursomeInput {
  name: string;
  description?: string;
  memberIds: UUID[];  // 2-3 other members
  preferredCourseId?: UUID;
  cadence?: FoursomeCadence;
  preferredDay?: FoursomePreferredDay;
  preferredTime?: FoursomePreferredTime;
}

export interface UpdateStandingFoursomeInput {
  name?: string;
  description?: string;
  preferredCourseId?: UUID;
  cadence?: FoursomeCadence;
  preferredDay?: FoursomePreferredDay;
  preferredTime?: FoursomePreferredTime;
  status?: StandingFoursomeStatus;
}

export interface ScheduleFromFoursomeInput {
  foursomeId: UUID;
  scheduledAt: string;
  courseId?: UUID;  // Override preferred course
  notes?: string;
}

// ----------------------------------------------------------------------------
// Response Types
// ----------------------------------------------------------------------------

export interface RoundApiResponse {
  data: Round | RoundWithCourse | Round[];
  error?: string;
  code?: string;
}

export interface InvitationApiResponse {
  data: RoundInvitation | RoundInvitation[];
  error?: string;
  code?: string;
}

export interface RoundListResponse {
  data: RoundWithCourse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// NEW (Epic 5)
export interface StandingFoursomeApiResponse {
  data: StandingFoursome | StandingFoursomeWithMembers | StandingFoursome[];
  error?: string;
  code?: string;
}

export interface StandingFoursomeListResponse {
  data: StandingFoursomeWithMembers[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface RoundRatingApiResponse {
  data: RoundRating | RoundRatingInput[] | RoundRatingAggregate;
  error?: string;
  code?: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

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

// NEW (Epic 5)
export const ROUND_LIFECYCLE_META: Record<RoundLifecycleStatus, {
  label: string;
  description: string;
  isActive: boolean;
  canInvite: boolean;
  canRate: boolean;
}> = {
  planning: {
    label: 'Planning',
    description: 'Building the group',
    isActive: true,
    canInvite: true,
    canRate: false,
  },
  invited: {
    label: 'Invited',
    description: 'Waiting for responses',
    isActive: true,
    canInvite: false,
    canRate: false,
  },
  confirmed: {
    label: 'Confirmed',
    description: 'Group confirmed, ready to play',
    isActive: true,
    canInvite: false,
    canRate: false,
  },
  played: {
    label: 'Played',
    description: 'Round completed',
    isActive: false,
    canInvite: false,
    canRate: true,
  },
  review_pending: {
    label: 'Review Pending',
    description: 'Awaiting player ratings',
    isActive: false,
    canInvite: false,
    canRate: true,
  },
  reviewed: {
    label: 'Reviewed',
    description: 'All ratings submitted',
    isActive: false,
    canInvite: false,
    canRate: false,
  },
  review_closed: {
    label: 'Review Closed',
    description: 'Rating window expired',
    isActive: false,
    canInvite: false,
    canRate: false,
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Round cancelled',
    isActive: false,
    canInvite: false,
    canRate: false,
  },
};

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

// NEW (Epic 5)
export const FOURSOME_CADENCE_OPTIONS: Record<FoursomeCadence, {
  label: string;
  description: string;
}> = {
  weekly: {
    label: 'Weekly',
    description: 'Play every week',
  },
  biweekly: {
    label: 'Bi-weekly',
    description: 'Play every other week',
  },
  monthly: {
    label: 'Monthly',
    description: 'Play once a month',
  },
  flexible: {
    label: 'Flexible',
    description: 'Play when everyone is available',
  },
};

export const ROUND_DEFAULTS = {
  maxPlayers: 4,
  cartPreference: 'either' as CartPreference,
} as const;

export const VALID_MAX_PLAYERS = [2, 3, 4] as const;

// NEW (Epic 5): Free tier monthly limit
export const FREE_TIER_ROUND_LIMIT = 3;

// ----------------------------------------------------------------------------
// Type Guards
// ----------------------------------------------------------------------------

export function isValidRoundStatus(status: string): status is RoundStatus {
  return ['draft', 'open', 'full', 'confirmed', 'in_progress', 'completed', 'cancelled'].includes(status);
}

export function isValidInvitationStatus(status: string): status is InvitationStatus {
  return ['pending', 'accepted', 'declined', 'expired'].includes(status);
}

export function isValidCartPreference(pref: string): pref is CartPreference {
  return ['walking', 'cart', 'either'].includes(pref);
}

export function isValidMaxPlayers(num: number): boolean {
  return VALID_MAX_PLAYERS.includes(num as any);
}

// NEW (Epic 5)
export function isValidRoundLifecycleStatus(status: string): status is RoundLifecycleStatus {
  return ['planning', 'invited', 'confirmed', 'played', 'review_pending', 'reviewed', 'review_closed', 'cancelled'].includes(status);
}

export function isValidRoundSourceType(source: string): source is RoundSourceType {
  return ['standing_foursome', 'network_invite', 'discovery', 'direct'].includes(source);
}

export function isValidFoursomeCadence(cadence: string): cadence is FoursomeCadence {
  return ['weekly', 'biweekly', 'monthly', 'flexible'].includes(cadence);
}

export function isValidStandingFoursomeStatus(status: string): status is StandingFoursomeStatus {
  return ['active', 'paused', 'disbanded'].includes(status);
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

export function canJoinRound(round: Round): boolean {
  return round.status === 'open';
}

export function canEditRound(round: Round, userId: UUID): boolean {
  return round.creatorId === userId && !['in_progress', 'completed', 'cancelled'].includes(round.status);
}

export function canCancelRound(round: Round, userId: UUID): boolean {
  return round.creatorId === userId && !['in_progress', 'completed', 'cancelled'].includes(round.status);
}

// NEW (Epic 5)
export function canRateRound(round: Round): boolean {
  return round.lifecycleStatus === 'played' || round.lifecycleStatus === 'review_pending';
}

export function isRatingWindowOpen(round: Round): boolean {
  if (!round.reviewWindowClosesAt) return false;
  return new Date(round.reviewWindowClosesAt) > new Date();
}

export function canInviteToRound(round: Round): boolean {
  return round.lifecycleStatus === 'planning' || round.lifecycleStatus === 'invited';
}

export function getRoundLifecycleLabel(status: RoundLifecycleStatus): string {
  return ROUND_LIFECYCLE_META[status]?.label || status;
}

export function getRoundSourceLabel(source: RoundSourceType): string {
  const labels: Record<RoundSourceType, string> = {
    standing_foursome: 'Standing Foursome',
    network_invite: 'Network',
    discovery: 'Discovery',
    direct: 'Direct',
  };
  return labels[source] || source;
}
