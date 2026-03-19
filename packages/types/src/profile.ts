// ============================================================================
// Profile & Networking Types - Sprint 3 Complete Type Definitions
// ============================================================================

import type { UUID } from "./index.js";

// ============================================================================
// Professional Identity Types
// ============================================================================

/**
 * Verification status for company/employer information
 */
export type CompanyVerificationStatus = 'unverified' | 'pending' | 'verified';

/**
 * Professional identity information for networking and matching
 */
export interface ProfessionalIdentity {
  /** User's professional role/title */
  role: string;
  /** Company or employer name */
  company: string;
  /** Industry sector */
  industry: string;
  /** LinkedIn profile URL */
  linkedinUrl?: string;
  /** Years of professional experience */
  yearsExperience: number;
  /** Verification status of company information */
  verificationStatus: CompanyVerificationStatus;
}

// ============================================================================
// Golf Identity Types
// ============================================================================

/**
 * Frequency of play - how often the user plays golf
 */
export type PlayFrequency = 'weekly' | 'biweekly' | 'monthly' | 'occasionally';

/**
 * Preferred tee time preferences
 */
export type TeeTimePreference = 'early_bird' | 'mid_morning' | 'afternoon' | 'twilight';

/**
 * Golf-specific identity and preferences
 */
export interface GolfIdentity {
  /** Golf handicap index (e.g., 12.4) */
  handicap?: number;
  /** ID of user's home course */
  homeCourseId?: UUID;
  /** How often the user plays */
  playFrequency: PlayFrequency;
  /** Preferred tee times */
  preferredTeeTimes: TeeTimePreference[];
  /** Years playing golf */
  yearsPlaying: number;
}

// ============================================================================
// Extended Profile Types
// ============================================================================

/**
 * Profile section identifiers for completeness tracking
 */
export type ProfileSection = 'basic' | 'professional' | 'golf' | 'preferences';

/**
 * Tracks completion status of each profile section
 */
export interface ProfileCompleteness {
  /** Basic info section (name, avatar, location) */
  basic: boolean;
  /** Professional identity section */
  professional: boolean;
  /** Golf identity section */
  golf: boolean;
  /** Preferences section */
  preferences: boolean;
  /** Overall completion percentage (0-100) */
  overallPercentage: number;
}

/**
 * Extended user profile combining all identity aspects
 */
export interface ExtendedProfile {
  /** Unique user identifier */
  id: UUID;
  /** User's display name */
  displayName: string;
  /** User's email address */
  email: string;
  /** Profile avatar URL */
  avatarUrl?: string;
  /** User's city/location */
  city?: string;
  /** User's timezone */
  timezone?: string;
  /** Professional identity information */
  professional?: ProfessionalIdentity;
  /** Golf identity information */
  golf?: GolfIdentity;
  /** Profile completeness tracking */
  completeness: ProfileCompleteness;
  /** When the profile was created */
  createdAt: string;
  /** When the profile was last updated */
  updatedAt: string;
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Status of a connection between two users
 */
export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

/**
 * Type of connection - how the users know each other
 */
export type ConnectionType = 'played_together' | 'introduced' | 'met_offline' | 'online_only';

/**
 * Connection between two users
 */
export interface Connection {
  /** Unique connection identifier */
  id: UUID;
  /** ID of the user who initiated the connection */
  requesterId: UUID;
  /** ID of the user who received the connection request */
  receiverId: UUID;
  /** Current status of the connection */
  status: ConnectionStatus;
  /** How the users know each other */
  connectionType: ConnectionType;
  /** Optional message from requester */
  message?: string;
  /** When the connection was requested */
  requestedAt: string;
  /** When the connection was accepted/declined (if applicable) */
  respondedAt?: string;
  /** ID of the activity that brought them together (if applicable) */
  activityId?: UUID;
}

/**
 * Connection with member data populated
 */
export interface ConnectionWithMembers extends Connection {
  /** Requester user details */
  requester: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
    professional?: ProfessionalIdentity;
    golf?: GolfIdentity;
  };
  /** Receiver user details */
  receiver: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
    professional?: ProfessionalIdentity;
    golf?: GolfIdentity;
  };
}

/**
 * Simplified pending connection for incoming/outgoing requests
 */
export interface PendingConnection {
  /** Connection ID */
  id: UUID;
  /** The other user's ID */
  userId: UUID;
  /** The other user's display name */
  displayName: string;
  /** The other user's avatar URL */
  avatarUrl?: string;
  /** Professional info of the other user */
  professional?: ProfessionalIdentity;
  /** Golf info of the other user */
  golf?: GolfIdentity;
  /** Whether this is an incoming or outgoing request */
  direction: 'incoming' | 'outgoing';
  /** Connection status */
  status: ConnectionStatus;
  /** When the request was sent */
  requestedAt: string;
  /** Optional message */
  message?: string;
}

// ============================================================================
// Introduction Types
// ============================================================================

/**
 * Status of an introduction request
 */
export type IntroStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/**
 * Introduction facilitated by a mutual connection
 */
export interface ConnectionIntro {
  /** Unique introduction identifier */
  id: UUID;
  /** ID of the user requesting the introduction */
  requesterId: UUID;
  /** ID of the user being introduced to */
  targetId: UUID;
  /** ID of the mutual connection facilitating the intro */
  connectorId: UUID;
  /** Current status of the introduction */
  status: IntroStatus;
  /** Message from the requester */
  requesterMessage?: string;
  /** Message from the connector */
  connectorMessage?: string;
  /** When the introduction was requested */
  requestedAt: string;
  /** When the introduction was responded to */
  respondedAt?: string;
  /** When the introduction expires */
  expiresAt: string;
}

/**
 * Introduction with connection data populated
 */
export interface IntroWithConnection extends ConnectionIntro {
  /** Requester user details */
  requester: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
  };
  /** Target user details */
  target: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
  };
  /** Connector user details */
  connector: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
  };
}

// ============================================================================
// Reputation Types
// ============================================================================

/**
 * Components that contribute to reputation score
 */
export type ReputationComponent = 'completion' | 'ratings' | 'network' | 'referrals' | 'profile' | 'attendance';

/**
 * Individual component score breakdown
 */
export interface ReputationComponentScore {
  /** Component identifier */
  component: ReputationComponent;
  /** Score for this component (0-100) */
  score: number;
  /** Weight of this component in overall score */
  weight: number;
  /** Description of this component */
  description: string;
}

/**
 * Complete reputation score breakdown
 */
export interface ReputationScore {
  /** Unique identifier */
  id: UUID;
  /** User ID this score belongs to */
  userId: UUID;
  /** Overall reputation score (0-100) */
  overallScore: number;
  /** Individual component scores */
  components: ReputationComponentScore[];
  /** When the score was last calculated */
  calculatedAt: string;
  /** Score version for tracking algorithm changes */
  version: number;
}

/**
 * Types of events that affect reputation
 */
export type ReputationEventType =
  | 'profile_completed'
  | 'profile_updated'
  | 'positive_rating_received'
  | 'negative_rating_received'
  | 'connection_accepted'
  | 'connection_declined'
  | 'introduction_made'
  | 'introduction_accepted'
  | 'session_attended'
  | 'session_no_show'
  | 'session_cancelled_late'
  | 'referral_completed';

/**
 * Audit trail entry for reputation changes
 */
export interface ReputationEvent {
  /** Unique event identifier */
  id: UUID;
  /** User ID this event affects */
  userId: UUID;
  /** Type of event */
  eventType: ReputationEventType;
  /** Points change (positive or negative) */
  pointsChange: number;
  /** Description of the event */
  description: string;
  /** Related entity ID (session, connection, etc.) */
  relatedId?: UUID;
  /** Related entity type */
  relatedType?: string;
  /** When the event occurred */
  createdAt: string;
}

// ============================================================================
// Input Types (DTOs)
// ============================================================================

/**
 * Input for updating a user profile
 */
export interface UpdateProfileInput {
  /** Display name to update */
  displayName?: string;
  /** Avatar URL to update */
  avatarUrl?: string;
  /** City to update */
  city?: string;
  /** Timezone to update */
  timezone?: string;
  /** Professional identity to update */
  professional?: Partial<ProfessionalIdentity>;
  /** Golf identity to update */
  golf?: Partial<GolfIdentity>;
}

/**
 * Input for sending a connection request
 */
export interface SendConnectionRequestInput {
  /** ID of the user to connect with */
  receiverId: UUID;
  /** How you know this person */
  connectionType: ConnectionType;
  /** Optional personal message */
  message?: string;
  /** Related activity ID (if applicable) */
  activityId?: UUID;
}

/**
 * Input for responding to a connection request
 */
export interface RespondToConnectionInput {
  /** Connection ID to respond to */
  connectionId: UUID;
  /** Whether to accept or decline */
  action: 'accept' | 'decline';
  /** Optional response message */
  message?: string;
}

/**
 * Input for requesting an introduction
 */
export interface RequestIntroInput {
  /** ID of the user to be introduced to */
  targetId: UUID;
  /** ID of the mutual connection */
  connectorId: UUID;
  /** Message to the connector */
  message?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * All play frequency options with display labels
 */
export const PLAY_FREQUENCIES: { value: PlayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'occasionally', label: 'Occasionally' },
];

/**
 * All tee time preference options with display labels
 */
export const TEE_TIME_PREFERENCES: { value: TeeTimePreference; label: string }[] = [
  { value: 'early_bird', label: 'Early Bird (before 9am)' },
  { value: 'mid_morning', label: 'Mid-Morning (9am-12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm-4pm)' },
  { value: 'twilight', label: 'Twilight (after 4pm)' },
];

/**
 * All connection statuses
 */
export const CONNECTION_STATUSES: { value: ConnectionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'blocked', label: 'Blocked' },
];

/**
 * All connection types with labels
 */
export const CONNECTION_TYPES: { value: ConnectionType; label: string }[] = [
  { value: 'played_together', label: 'Played Together' },
  { value: 'introduced', label: 'Introduced' },
  { value: 'met_offline', label: 'Met Offline' },
  { value: 'online_only', label: 'Online Only' },
];

/**
 * All profile sections for completeness tracking
 */
export const PROFILE_SECTIONS: { value: ProfileSection; label: string }[] = [
  { value: 'basic', label: 'Basic Information' },
  { value: 'professional', label: 'Professional Identity' },
  { value: 'golf', label: 'Golf Identity' },
  { value: 'preferences', label: 'Preferences' },
];

/**
 * Reputation score calculation weights
 * Weights should sum to 1.0
 */
export const REPUTATION_WEIGHTS: Record<ReputationComponent, number> = {
  completion: 0.15,
  ratings: 0.30,
  network: 0.20,
  referrals: 0.15,
  profile: 0.10,
  attendance: 0.10,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid PlayFrequency
 */
export function isValidPlayFrequency(freq: string): freq is PlayFrequency {
  return ['weekly', 'biweekly', 'monthly', 'occasionally'].includes(freq);
}

/**
 * Check if a string is a valid ConnectionStatus
 */
export function isValidConnectionStatus(status: string): status is ConnectionStatus {
  return ['pending', 'accepted', 'declined', 'blocked'].includes(status);
}

/**
 * Check if a string is a valid ConnectionType
 */
export function isValidConnectionType(type: string): type is ConnectionType {
  return ['played_together', 'introduced', 'met_offline', 'online_only'].includes(type);
}

/**
 * Check if a string is a valid TeeTimePreference
 */
export function isValidTeeTimePreference(pref: string): pref is TeeTimePreference {
  return ['early_bird', 'mid_morning', 'afternoon', 'twilight'].includes(pref);
}

/**
 * Check if a string is a valid ProfileSection
 */
export function isValidProfileSection(section: string): section is ProfileSection {
  return ['basic', 'professional', 'golf', 'preferences'].includes(section);
}

/**
 * Check if a string is a valid CompanyVerificationStatus
 */
export function isValidCompanyVerificationStatus(status: string): status is CompanyVerificationStatus {
  return ['unverified', 'pending', 'verified'].includes(status);
}

/**
 * Check if a string is a valid IntroStatus
 */
export function isValidIntroStatus(status: string): status is IntroStatus {
  return ['pending', 'accepted', 'declined', 'expired'].includes(status);
}

/**
 * Check if a string is a valid ReputationComponent
 */
export function isValidReputationComponent(component: string): component is ReputationComponent {
  return ['completion', 'ratings', 'network', 'referrals', 'profile', 'attendance'].includes(component);
}
