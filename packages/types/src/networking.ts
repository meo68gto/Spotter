// ============================================================================
// Epic 4: Private Network Graph & Saved Members - Type Definitions
// ============================================================================

import type { UUID } from "./index.js";

// ============================================================================
// Network Connection Types (Extended from Sprint 3)
// ============================================================================

/**
 * Relationship evolution states for connections
 */
export type RelationshipState = 
  | 'matched'           // Initial match via app
  | 'invited'           // Round invitation extended
  | 'played_together'   // Completed at least one round
  | 'regular_partner';  // Played 3+ rounds together

/**
 * Extended connection with network graph data
 */
export interface NetworkConnection {
  /** Unique connection identifier */
  id: UUID;
  /** ID of the user who initiated the connection */
  userId: UUID;
  /** ID of the user who received the connection request */
  connectedUserId: UUID;
  /** Current status of the connection */
  status: 'pending_sent' | 'pending_received' | 'accepted' | 'declined';
  /** Current relationship state in the evolution chain */
  relationshipState: RelationshipState;
  /** Connection strength score (0-100) */
  strengthScore: number;
  /** Whether saved by current user */
  isSavedByMe: boolean;
  /** Number of rounds played together */
  roundsCount: number;
  /** Last interaction timestamp */
  lastInteractionAt: string | null;
  /** When connection was accepted */
  connectedAt: string | null;
  /** Connected member data */
  member: NetworkMember;
}

/**
 * Network member profile data
 */
export interface NetworkMember {
  /** User ID */
  id: UUID;
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatarUrl: string | null;
  /** Membership tier slug */
  tier: string;
  /** User bio */
  bio: string | null;
  /** Professional identity (optional) */
  professional?: {
    role?: string;
    company?: string;
    industry?: string;
  };
  /** Golf identity (optional) */
  golf?: {
    handicap?: number;
  };
}

// ============================================================================
// Saved Members Types
// ============================================================================

/**
 * Tier for saved members (personal organization)
 */
export type SavedMemberTier = 'favorite' | 'standard' | 'archived';

/**
 * Saved member record for personal network management
 */
export interface SavedMember {
  /** Unique identifier */
  id: UUID;
  /** User who saved this member */
  saverId: UUID;
  /** User being saved */
  savedId: UUID;
  /** Personal tier for organization */
  tier: SavedMemberTier;
  /** Personal notes about this member */
  notes: string | null;
  /** Personal tags for organization */
  tags: string[];
  /** When the member was saved */
  createdAt: string;
  /** When the record was last updated */
  updatedAt: string;
  /** Saved member data */
  member: SavedMemberData;
}

/**
 * Saved member data with profile info
 */
export interface SavedMemberData {
  /** User ID */
  id: UUID;
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatarUrl: string | null;
  /** Membership tier slug */
  tier: string;
  /** Professional identity (optional) */
  professional?: {
    role?: string;
    company?: string;
  };
  /** Golf identity (optional) */
  golf?: {
    handicap?: number;
  };
}

// ============================================================================
// Introduction Types (Epic 4 Enhanced)
// ============================================================================

/**
 * Status of an introduction request
 */
export type IntroductionStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/**
 * Introduction request (replaces/enhances ConnectionIntro from Sprint 3)
 */
export interface Introduction {
  /** Unique identifier */
  id: UUID;
  /** User requesting the introduction */
  requesterId: UUID;
  /** User being introduced to */
  targetId: UUID;
  /** Mutual connection facilitating the intro */
  connectorId: UUID;
  /** Current status */
  status: IntroductionStatus;
  /** Message from connector (when responding) */
  connectorMessage: string | null;
  /** Message from target (when accepting/declining) */
  targetMessage: string | null;
  /** Reason for declining */
  declineReason: string | null;
  /** When the introduction expires */
  expiresAt: string;
  /** When the introduction was created */
  createdAt: string;
  /** When the introduction was responded to */
  respondedAt: string | null;
  /** When the record was last updated */
  updatedAt: string;
}

/**
 * Introduction with participant details
 */
export interface IntroductionWithParticipants extends Introduction {
  /** Connector details */
  connector: {
    id: UUID;
    displayName: string;
    avatarUrl: string | null;
  };
  /** Target details */
  target: {
    id: UUID;
    displayName: string;
    avatarUrl: string | null;
  };
  /** Requester details */
  requester?: {
    id: UUID;
    displayName: string;
    avatarUrl: string | null;
  };
}

// ============================================================================
// Network Graph Types
// ============================================================================

/**
 * Node in the network graph visualization
 */
export interface GraphNode {
  /** User ID */
  id: UUID;
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatarUrl: string | null;
  /** Membership tier */
  tier: string;
  /** Is this the current user */
  isMe: boolean;
  /** Is this user saved by current user */
  isSaved: boolean;
  /** Professional info */
  professional?: {
    role?: string;
    company?: string;
    industry?: string;
  };
  /** Golf info */
  golf?: {
    handicap?: number;
  };
}

/**
 * Edge in the network graph visualization
 */
export interface GraphEdge {
  /** Connection ID */
  id: UUID;
  /** Source user ID */
  source: UUID;
  /** Target user ID */
  target: UUID;
  /** Relationship state */
  relationshipState: RelationshipState;
  /** Connection strength (0-100) */
  strengthScore: number;
  /** Number of rounds played together */
  roundsCount: number;
  /** Last interaction timestamp */
  lastInteractionAt: string | null;
}

/**
 * Network graph data response
 */
export interface NetworkGraphData {
  /** Graph nodes */
  nodes: GraphNode[];
  /** Graph edges */
  edges: GraphEdge[];
  /** Graph statistics */
  stats: NetworkGraphStats;
}

/**
 * Network graph statistics
 */
export interface NetworkGraphStats {
  /** Total number of nodes */
  totalNodes: number;
  /** Total number of edges */
  totalEdges: number;
  /** Average connection strength */
  avgStrength: number;
  /** Number of saved nodes */
  savedNodes: number;
  /** Number of regular partner connections */
  regularPartners: number;
}

// ============================================================================
// Network Statistics Types
// ============================================================================

/**
 * Network statistics for a user
 */
export interface NetworkStats {
  /** Total accepted connections */
  totalConnections: number;
  /** Number of saved connections */
  savedConnections: number;
  /** Number of regular partner connections */
  regularPartners: number;
  /** Average connection strength score */
  avgStrengthScore: number;
  /** Number of pending introductions involving user */
  pendingIntroductions: number;
}

// ============================================================================
// Input Types (DTOs)
// ============================================================================

/**
 * Input for saving a member
 */
export interface SaveMemberInput {
  /** User ID to save */
  userId: UUID;
  /** Personal tier for organization */
  tier?: SavedMemberTier;
  /** Personal notes */
  notes?: string;
  /** Personal tags */
  tags?: string[];
}

/**
 * Input for updating a saved member
 */
export interface UpdateSavedMemberInput {
  /** User ID of saved member */
  userId: UUID;
  /** Updated tier */
  tier?: SavedMemberTier;
  /** Updated notes */
  notes?: string;
  /** Updated tags */
  tags?: string[];
}

/**
 * Input for requesting an introduction
 */
export interface RequestIntroductionInput {
  /** Connector (mutual connection) ID */
  connectorId: UUID;
  /** Target user ID to be introduced to */
  targetId: UUID;
  /** Message to connector */
  connectorMessage?: string;
}

/**
 * Input for responding to an introduction
 */
export interface RespondToIntroductionInput {
  /** Introduction ID */
  introId: UUID;
  /** Response action */
  action: 'accept' | 'decline';
  /** Response message */
  message?: string;
  /** Reason for declining */
  declineReason?: string;
}

/**
 * Input for filtering network connections
 */
export interface NetworkConnectionsFilter {
  /** Filter by status */
  filter?: 'all' | 'accepted' | 'pending_sent' | 'pending_received';
  /** Filter by relationship state */
  state?: RelationshipState;
  /** Only show saved connections */
  savedOnly?: boolean;
  /** Minimum strength score filter */
  minStrength?: number;
  /** Page number */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Include network stats in response */
  includeStats?: boolean;
}

/**
 * Input for network graph data
 */
export interface NetworkGraphInput {
  /** Graph depth (1 or 2) */
  depth?: number;
  /** Include saved members not in connections */
  includeSaved?: boolean;
  /** Minimum strength score filter */
  minStrength?: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * All relationship states with display labels
 */
export const RELATIONSHIP_STATES: { value: RelationshipState; label: string; description: string }[] = [
  { value: 'matched', label: 'Matched', description: 'Initial match via app' },
  { value: 'invited', label: 'Invited', description: 'Round invitation extended' },
  { value: 'played_together', label: 'Played Together', description: 'Completed at least one round' },
  { value: 'regular_partner', label: 'Regular Partner', description: 'Played 3+ rounds together' },
];

/**
 * All saved member tiers with display labels
 */
export const SAVED_MEMBER_TIERS: { value: SavedMemberTier; label: string; description: string }[] = [
  { value: 'favorite', label: 'Favorite', description: 'Most important connections' },
  { value: 'standard', label: 'Standard', description: 'Regular saved members' },
  { value: 'archived', label: 'Archived', description: 'Archived connections' },
];

/**
 * All introduction statuses with display labels
 */
export const INTRODUCTION_STATUSES: { value: IntroductionStatus; label: string; description: string }[] = [
  { value: 'pending', label: 'Pending', description: 'Awaiting response' },
  { value: 'accepted', label: 'Accepted', description: 'Introduction accepted' },
  { value: 'declined', label: 'Declined', description: 'Introduction declined' },
  { value: 'expired', label: 'Expired', description: 'Introduction expired' },
];

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid RelationshipState
 */
export function isValidRelationshipState(state: string): state is RelationshipState {
  return ['matched', 'invited', 'played_together', 'regular_partner'].includes(state);
}

/**
 * Check if a string is a valid SavedMemberTier
 */
export function isValidSavedMemberTier(tier: string): tier is SavedMemberTier {
  return ['favorite', 'standard', 'archived'].includes(tier);
}

/**
 * Check if a string is a valid IntroductionStatus
 */
export function isValidIntroductionStatus(status: string): status is IntroductionStatus {
  return ['pending', 'accepted', 'declined', 'expired'].includes(status);
}

/**
 * Get display label for relationship state
 */
export function getRelationshipStateLabel(state: RelationshipState): string {
  const found = RELATIONSHIP_STATES.find(s => s.value === state);
  return found?.label || state;
}

/**
 * Get display label for saved member tier
 */
export function getSavedMemberTierLabel(tier: SavedMemberTier): string {
  const found = SAVED_MEMBER_TIERS.find(t => t.value === tier);
  return found?.label || tier;
}

/**
 * Calculate next relationship state based on rounds count
 */
export function getNextRelationshipState(roundsCount: number): RelationshipState {
  if (roundsCount >= 3) return 'regular_partner';
  if (roundsCount >= 1) return 'played_together';
  return 'invited';
}

/**
 * Get color for strength score (for visualization)
 */
export function getStrengthScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green-500
  if (score >= 60) return '#84cc16'; // lime-500
  if (score >= 40) return '#eab308'; // yellow-500
  if (score >= 20) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

/**
 * Get label for strength score range
 */
export function getStrengthScoreLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Weak';
  return 'Very Weak';
}