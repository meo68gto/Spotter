// ============================================================================
// Tournament Organizer Portal Types - Sprint 4 Complete Type Definitions
// ============================================================================

import type { UUID } from "./index.js";

// ============================================================================
// Organizer Account Types
// ============================================================================

/**
 * Organizer membership tiers
 * - Bronze: Basic tournament management (up to 5 tournaments/year)
 * - Silver: Enhanced features + priority support (up to 20 tournaments/year)
 * - Gold: Full access + API keys + white-label options (unlimited tournaments)
 */
export type OrganizerTier = 'bronze' | 'silver' | 'gold';

/**
 * Organizer account status
 * - pending: Awaiting verification
 * - active: Fully functional
 * - suspended: Payment issues or violations
 * - cancelled: Account closed
 */
export type OrganizerStatus = 'pending' | 'active' | 'suspended' | 'cancelled';

/**
 * Full organizer account information
 */
export interface OrganizerAccount {
  /** Unique identifier */
  id: UUID;
  /** Organization/company name */
  name: string;
  /** URL-friendly slug */
  slug: string;
  /** Organization description */
  description?: string;
  /** Organization website */
  website?: string;
  /** Primary contact email */
  email: string;
  /** Organization phone number */
  phone?: string;
  /** Physical address (optional) */
  address?: {
    street?: string;
    city: string;
    state?: string;
    zipCode?: string;
    country: string;
  };
  /** Current membership tier */
  tier: OrganizerTier;
  /** Current account status */
  status: OrganizerStatus;
  /** Logo/image URL */
  logoUrl?: string;
  /** ID of the owner user */
  ownerId: UUID;
  /** When the account was created */
  createdAt: string;
  /** When the account was last updated */
  updatedAt: string;
  /** When the subscription expires (if applicable) */
  subscriptionExpiresAt?: string;
}

/**
 * Organizer account with usage statistics
 */
export interface OrganizerWithStats extends OrganizerAccount {
  /** Total events created */
  totalEvents: number;
  /** Total registrations across all events */
  totalRegistrations: number;
  /** Events currently active */
  activeEvents: number;
  /** Total revenue generated (if applicable) */
  totalRevenue?: number;
  /** Member count */
  memberCount: number;
  /** Last activity timestamp */
  lastActivityAt?: string;
}

/**
 * Quota usage information for display
 */
export interface OrganizerQuotaInfo {
  /** Events used this billing period */
  eventsUsed: number;
  /** Events allowed per period (null = unlimited) */
  eventsLimit: number | null;
  /** Registrations this billing period */
  registrationsUsed: number;
  /** Registrations allowed per period (null = unlimited) */
  registrationsLimit: number | null;
  /** Storage used in bytes */
  storageUsed: number;
  /** Storage limit in bytes (null = unlimited) */
  storageLimit: number | null;
  /** API calls made this period (Gold tier) */
  apiCallsUsed: number;
  /** API calls allowed per period (null = unlimited) */
  apiCallsLimit: number | null;
  /** Current period start date */
  periodStart: string;
  /** Current period end date */
  periodEnd: string;
}

// ============================================================================
// Organizer Member Types
// ============================================================================

/**
 * Role within an organizer account
 * - owner: Full control, billing access
 * - admin: Manage events, members, settings
 * - manager: Create/edit events, view registrations
 * - viewer: View-only access to events and analytics
 */
export type OrganizerRole = 'owner' | 'admin' | 'manager' | 'viewer';

/**
 * Granular permissions for organizer members
 */
export interface OrganizerPermissions {
  /** Can manage account settings and billing */
  manageSettings: boolean;
  /** Can add/remove members */
  manageMembers: boolean;
  /** Can create new events */
  createEvents: boolean;
  /** Can edit existing events */
  editEvents: boolean;
  /** Can delete events */
  deleteEvents: boolean;
  /** Can view registrations */
  viewRegistrations: boolean;
  /** Can manage registrations (check-in, cancel) */
  manageRegistrations: boolean;
  /** Can view analytics */
  viewAnalytics: boolean;
  /** Can export data */
  exportData: boolean;
  /** Can send invites */
  sendInvites: boolean;
  /** Can manage API keys (Gold tier) */
  manageApiKeys: boolean;
}

/**
 * Member of an organizer account
 */
export interface OrganizerMember {
  /** Unique identifier */
  id: UUID;
  /** Organizer account ID */
  organizerId: UUID;
  /** User ID of the member */
  userId: UUID;
  /** Role within the organization */
  role: OrganizerRole;
  /** Custom permissions (if role is overridden) */
  customPermissions?: Partial<OrganizerPermissions>;
  /** When the member was added */
  joinedAt: string;
  /** Who added this member */
  addedByUserId: UUID;
  /** Whether the member has accepted the invitation */
  accepted: boolean;
  /** When the invitation was accepted */
  acceptedAt?: string;
}

/**
 * Member with user data populated
 */
export interface OrganizerMemberWithUser extends OrganizerMember {
  /** User display name */
  displayName: string;
  /** User email */
  email: string;
  /** User avatar URL */
  avatarUrl?: string;
  /** User's professional info */
  professional?: {
    role?: string;
    company?: string;
  };
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Types of events organizers can create
 * - tournament: Competitive tournament with scoring
 * - scramble: Team scramble format
 * - charity: Fundraising event
 * - corporate: Corporate outing/team building
 * - social: Casual social event
 */
export type EventType = 'tournament' | 'scramble' | 'charity' | 'corporate' | 'social';

/**
 * Event status lifecycle
 * - draft: Being created, not visible to public
 * - published: Visible but registration not open
 * - registration_open: Accepting registrations
 * - full: Registration closed (at capacity)
 * - in_progress: Event is happening now
 * - completed: Event has concluded
 * - cancelled: Event was cancelled
 */
export type EventStatus = 'draft' | 'published' | 'registration_open' | 'full' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Full event definition for organizers
 */
export interface OrganizerEvent {
  /** Unique identifier */
  id: UUID;
  /** Organizer account ID */
  organizerId: UUID;
  /** Event title */
  title: string;
  /** Event description */
  description?: string;
  /** Type of event */
  type: EventType;
  /** Current status */
  status: EventStatus;
  /** Golf course ID */
  courseId: UUID;
  /** Course name (cached) */
  courseName: string;
  /** Event start time */
  startTime: string;
  /** Event end time */
  endTime: string;
  /** Registration open time */
  registrationOpensAt?: string;
  /** Registration close time */
  registrationClosesAt?: string;
  /** Maximum number of participants */
  maxParticipants: number;
  /** Current registration count */
  registrationCount: number;
  /** Waitlist count */
  waitlistCount: number;
  /** Entry fee in cents (if applicable) */
  entryFeeCents?: number;
  /** Currency for entry fee */
  currency?: string;
  /** Whether event is public or invite-only */
  isPublic: boolean;
  /** Event image/logo URL */
  imageUrl?: string;
  /** Format-specific settings (e.g., tournament format) */
  formatSettings?: Record<string, unknown>;
  /** Custom fields for registration form */
  customFields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
    required: boolean;
    options?: string[];
  }>;
  /** Tags for categorization */
  tags?: string[];
  /** Which member tiers can see this event (Spotter integration) */
  targetTiers?: OrganizerTier[];
  /** Created by user ID */
  createdByUserId: UUID;
  /** When the event was created */
  createdAt: string;
  /** When the event was last updated */
  updatedAt: string;
}

/**
 * Event with course data populated
 */
export interface OrganizerEventWithCourse extends OrganizerEvent {
  /** Full course location */
  courseLocation: {
    lat: number;
    lng: number;
    city: string;
    state?: string;
    country: string;
  };
  /** Course difficulty */
  courseDifficulty?: string;
  /** Course image */
  courseImageUrl?: string;
}

/**
 * Event with registration statistics
 */
export interface OrganizerEventWithStats extends OrganizerEvent {
  /** Number of confirmed registrations */
  confirmedCount: number;
  /** Number of checked-in participants */
  checkedInCount: number;
  /** Number of no-shows */
  noShowCount: number;
  /** Number of cancellations */
  cancelledCount: number;
  /** Revenue collected (if paid event) */
  revenueCollected?: number;
  /** Registration trend (last 7 days) */
  registrationTrend?: Array<{
    date: string;
    count: number;
  }>;
}

/**
 * Target tier visibility configuration
 */
export interface EventTargetTiers {
  /** Bronze tier members can see */
  bronze: boolean;
  /** Silver tier members can see */
  silver: boolean;
  /** Gold tier members can see */
  gold: boolean;
}

// ============================================================================
// Registration Types
// ============================================================================

/**
 * Registration status for event participants
 * - registered: Signed up but not confirmed
 * - waitlisted: On waitlist (event full)
 * - confirmed: Confirmed spot
 * - checked_in: Arrived and checked in
 * - no_show: Did not attend
 * - cancelled: Registration cancelled
 */
export type RegistrationStatus = 'registered' | 'waitlisted' | 'confirmed' | 'checked_in' | 'no_show' | 'cancelled';

/**
 * Payment status for paid events
 * - pending: Payment not yet received
 * - paid: Payment confirmed
 * - waived: Fee waived (e.g., VIP, sponsor)
 * - refunded: Payment refunded
 */
export type PaymentStatus = 'pending' | 'paid' | 'waived' | 'refunded';

/**
 * Event registration record
 */
export interface EventRegistration {
  /** Unique identifier */
  id: UUID;
  /** Event ID */
  eventId: UUID;
  /** User ID of registrant (if Spotter member) */
  userId?: UUID;
  /** Guest email (if not a Spotter member) */
  guestEmail?: string;
  /** Guest name (if not a Spotter member) */
  guestName?: string;
  /** Current registration status */
  status: RegistrationStatus;
  /** Payment status */
  paymentStatus: PaymentStatus;
  /** Amount paid in cents */
  amountPaidCents?: number;
  /** Registration date/time */
  registeredAt: string;
  /** When status was confirmed (if applicable) */
  confirmedAt?: string;
  /** When checked in */
  checkedInAt?: string;
  /** Who checked them in (user ID) */
  checkedInByUserId?: UUID;
  /** Custom field responses */
  customFieldResponses?: Record<string, string | number | boolean>;
  /** Dietary restrictions/preferences */
  dietaryRestrictions?: string;
  /** Team/Group name */
  teamName?: string;
  /** Handicap at time of registration */
  handicapAtRegistration?: number;
  /** Whether they opted into communications */
  marketingOptIn: boolean;
  /** Cancellation reason */
  cancellationReason?: string;
  /** When cancelled */
  cancelledAt?: string;
  /** Who cancelled (user ID) */
  cancelledByUserId?: UUID;
  /** Notes from organizer */
  organizerNotes?: string;
}

/**
 * Registration with user data populated
 */
export interface RegistrationWithUser extends EventRegistration {
  /** User display name */
  displayName?: string;
  /** User email */
  email?: string;
  /** User avatar URL */
  avatarUrl?: string;
  /** User's current handicap */
  currentHandicap?: number;
  /** User's home course */
  homeCourseName?: string;
  /** User's professional info */
  professional?: {
    role?: string;
    company?: string;
  };
}

/**
 * Registration with event data populated
 */
export interface RegistrationWithEvent extends EventRegistration {
  /** Event title */
  eventTitle: string;
  /** Event start time */
  eventStartTime: string;
  /** Course name */
  courseName: string;
  /** Event type */
  eventType: EventType;
  /** Event status */
  eventStatus: EventStatus;
  /** Organizer name */
  organizerName: string;
}

// ============================================================================
// Invite Types
// ============================================================================

/**
 * Invite status
 * - pending: Awaiting response
 * - accepted: User accepted invite
 * - declined: User declined invite
 * - expired: Invite timed out
 */
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/**
 * Invite sent to a member for an event
 */
export interface OrganizerInvite {
  /** Unique identifier */
  id: UUID;
  /** Event ID */
  eventId: UUID;
  /** Organizer ID */
  organizerId: UUID;
  /** Recipient user ID (if Spotter member) */
  recipientUserId?: UUID;
  /** Recipient email (if guest) */
  recipientEmail?: string;
  /** Recipient name (if guest) */
  recipientName?: string;
  /** Personalized message */
  message?: string;
  /** Invite code for URL */
  inviteCode: string;
  /** Current status */
  status: InviteStatus;
  /** Who sent the invite */
  sentByUserId: UUID;
  /** When the invite was sent */
  sentAt: string;
  /** When the invite expires */
  expiresAt: string;
  /** When the invite was responded to */
  respondedAt?: string;
  /** Associated registration ID (if accepted) */
  registrationId?: UUID;
}

/**
 * Invite with event data populated
 */
export interface OrganizerInviteWithEvent extends OrganizerInvite {
  /** Event title */
  eventTitle: string;
  /** Event start time */
  eventStartTime: string;
  /** Course name */
  courseName: string;
  /** Event image URL */
  eventImageUrl?: string;
  /** Organizer name */
  organizerName: string;
  /** Organizer logo URL */
  organizerLogoUrl?: string;
}

/**
 * Quota tracking for invites
 */
export interface InviteQuotaInfo {
  /** Invites sent this period */
  invitesSent: number;
  /** Invites accepted this period */
  invitesAccepted: number;
  /** Invite limit (null = unlimited) */
  invitesLimit: number | null;
  /** Acceptance rate percentage */
  acceptanceRate: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Types of analytics metrics
 * - registration: Registration funnel metrics
 * - attendance: Check-in and participation metrics
 * - revenue: Payment and revenue metrics
 * - engagement: Interaction and engagement metrics
 */
export type AnalyticsMetricType = 'registration' | 'attendance' | 'revenue' | 'engagement';

/**
 * Aggregated analytics for an organizer
 */
export interface OrganizerAnalytics {
  /** Organizer ID */
  organizerId: UUID;
  /** Reporting period start */
  periodStart: string;
  /** Reporting period end */
  periodEnd: string;
  /** Registration metrics */
  registrationMetrics: RegistrationMetrics;
  /** Attendance metrics */
  attendanceMetrics: AttendanceMetrics;
  /** Revenue metrics (if applicable) */
  revenueMetrics?: RevenueMetrics;
  /** Engagement metrics */
  engagementMetrics: EngagementMetrics;
  /** Comparison to previous period */
  periodComparison?: {
    registrationsChange: number;
    attendanceRateChange: number;
    revenueChange?: number;
  };
}

/**
 * Registration analytics data
 */
export interface RegistrationMetrics {
  /** Total registrations this period */
  totalRegistrations: number;
  /** New registrations by day */
  registrationsByDay: Array<{
    date: string;
    count: number;
  }>;
  /** Registration sources (invite, public, etc.) */
  registrationSources: Record<string, number>;
  /** Conversion rate from view to register */
  conversionRate: number;
  /** Device breakdown */
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  /** Geographic distribution */
  geographicDistribution: Array<{
    city: string;
    count: number;
  }>;
}

/**
 * Attendance analytics data
 */
export interface AttendanceMetrics {
  /** Total check-ins */
  totalCheckIns: number;
  /** Check-in rate (vs registrations) */
  checkInRate: number;
  /** No-show count */
  noShows: number;
  /** No-show rate */
  noShowRate: number;
  /** Average time before event that check-ins occur */
  averageCheckInTimeBefore?: number;
  /** Check-ins by time bucket */
  checkInsByTime: Array<{
    timeBucket: string;
    count: number;
  }>;
}

/**
 * Revenue analytics data
 */
export interface RevenueMetrics {
  /** Total revenue this period */
  totalRevenue: number;
  /** Revenue by event */
  revenueByEvent: Array<{
    eventId: UUID;
    eventTitle: string;
    revenue: number;
  }>;
  /** Revenue by payment method */
  revenueByMethod: Record<string, number>;
  /** Refunds processed */
  totalRefunds: number;
  /** Refund rate */
  refundRate: number;
  /** Average transaction value */
  averageTransactionValue: number;
}

/**
 * Engagement analytics data
 */
export interface EngagementMetrics {
  /** Email open rate for event invites */
  emailOpenRate: number;
  /** Email click rate */
  emailClickRate: number;
  /** Average time spent on event page */
  averageTimeOnPage: number;
  /** Social shares */
  socialShares: number;
  /** Return attendee rate */
  returnAttendeeRate: number;
  /** Net Promoter Score (if collected) */
  npsScore?: number;
}

// ============================================================================
// API Key Types
// ============================================================================

/**
 * API key for Gold tier organizers
 * Allows programmatic access to organizer data
 */
export interface OrganizerApiKey {
  /** Unique identifier */
  id: UUID;
  /** Organizer account ID */
  organizerId: UUID;
  /** Key name/description */
  name: string;
  /** Hashed key value (prefix only shown to user) */
  keyPrefix: string;
  /** Key hash for verification */
  keyHash: string;
  /** Permissions granted to this key */
  permissions: OrganizerPermissions;
  /** Rate limit (requests per minute) */
  rateLimitPerMinute: number;
  /** Last used timestamp */
  lastUsedAt?: string;
  /** Usage count */
  usageCount: number;
  /** Whether the key is active */
  active: boolean;
  /** Created by user ID */
  createdByUserId: UUID;
  /** When the key was created */
  createdAt: string;
  /** When the key expires (if applicable) */
  expiresAt?: string;
  /** When the key was revoked */
  revokedAt?: string;
  /** Who revoked the key */
  revokedByUserId?: UUID;
}

/**
 * API key with permissions breakdown
 */
export interface ApiKeyWithPermissions extends OrganizerApiKey {
  /** Human-readable permissions list */
  permissionSummary: string[];
  /** Current usage rate (calls per hour) */
  currentUsageRate: number;
}

/**
 * API key usage tracking
 */
export interface ApiKeyUsage {
  /** API key ID */
  apiKeyId: UUID;
  /** Hour of usage */
  hour: string;
  /** Number of requests */
  requestCount: number;
  /** Number of errors */
  errorCount: number;
  /** Average response time in ms */
  averageResponseTime: number;
  /** Endpoints called */
  endpoints: Record<string, number>;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a new organizer account
 */
export interface CreateOrganizerInput {
  /** Organization name */
  name: string;
  /** Organization description */
  description?: string;
  /** Organization website */
  website?: string;
  /** Primary contact email */
  email: string;
  /** Organization phone */
  phone?: string;
  /** Physical address */
  address?: {
    street?: string;
    city: string;
    state?: string;
    zipCode?: string;
    country: string;
  };
  /** Initial tier selection */
  tier: OrganizerTier;
  /** Logo file upload (will be processed separately) */
  logoFile?: File;
}

/**
 * Input for updating an organizer account
 */
export interface UpdateOrganizerInput {
  /** Organization name to update */
  name?: string;
  /** Description to update */
  description?: string;
  /** Website to update */
  website?: string;
  /** Phone to update */
  phone?: string;
  /** Address to update */
  address?: {
    street?: string;
    city: string;
    state?: string;
    zipCode?: string;
    country: string;
  };
  /** New logo file */
  logoFile?: File;
}

/**
 * Input for creating a new event
 */
export interface CreateEventInput {
  /** Event title */
  title: string;
  /** Event description */
  description?: string;
  /** Type of event */
  type: EventType;
  /** Golf course ID */
  courseId: UUID;
  /** Event start time */
  startTime: string;
  /** Event end time */
  endTime: string;
  /** When registration opens (defaults to now) */
  registrationOpensAt?: string;
  /** When registration closes (defaults to start time) */
  registrationClosesAt?: string;
  /** Maximum participants */
  maxParticipants: number;
  /** Entry fee in cents (optional) */
  entryFeeCents?: number;
  /** Currency for entry fee */
  currency?: string;
  /** Whether event is public or invite-only */
  isPublic: boolean;
  /** Event image file */
  imageFile?: File;
  /** Format-specific settings */
  formatSettings?: Record<string, unknown>;
  /** Custom registration fields */
  customFields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
    required: boolean;
    options?: string[];
  }>;
  /** Tags */
  tags?: string[];
  /** Target tier visibility */
  targetTiers?: OrganizerTier[];
}

/**
 * Input for updating an existing event
 */
export interface UpdateEventInput {
  /** Title to update */
  title?: string;
  /** Description to update */
  description?: string;
  /** Type to update */
  type?: EventType;
  /** Start time to update */
  startTime?: string;
  /** End time to update */
  endTime?: string;
  /** Registration open time to update */
  registrationOpensAt?: string;
  /** Registration close time to update */
  registrationClosesAt?: string;
  /** Max participants to update */
  maxParticipants?: number;
  /** Entry fee to update */
  entryFeeCents?: number;
  /** Public/private status to update */
  isPublic?: boolean;
  /** New image file */
  imageFile?: File;
  /** Format settings to update */
  formatSettings?: Record<string, unknown>;
  /** Custom fields to update */
  customFields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
    required: boolean;
    options?: string[];
  }>;
  /** Tags to update */
  tags?: string[];
  /** Target tiers to update */
  targetTiers?: OrganizerTier[];
}

/**
 * Input for registering for an event
 */
export interface RegisterForEventInput {
  /** Event ID */
  eventId: UUID;
  /** User ID (if Spotter member) */
  userId?: UUID;
  /** Guest email (if not a Spotter member) */
  guestEmail?: string;
  /** Guest name (if not a Spotter member) */
  guestName?: string;
  /** Custom field responses */
  customFieldResponses?: Record<string, string | number | boolean>;
  /** Dietary restrictions */
  dietaryRestrictions?: string;
  /** Team/group name */
  teamName?: string;
  /** Handicap at registration */
  handicap?: number;
  /** Marketing opt-in */
  marketingOptIn: boolean;
  /** Payment token (if paid event) */
  paymentToken?: string;
}

/**
 * Input for sending an invite
 */
export interface SendInviteInput {
  /** Event ID */
  eventId: UUID;
  /** Recipient user ID (if Spotter member) */
  recipientUserId?: UUID;
  /** Recipient email (if guest) */
  recipientEmail?: string;
  /** Recipient name (if guest) */
  recipientName?: string;
  /** Personalized message */
  message?: string;
}

/**
 * Input for creating an API key
 */
export interface CreateApiKeyInput {
  /** Key name/description */
  name: string;
  /** Permissions to grant */
  permissions: Partial<OrganizerPermissions>;
  /** Rate limit per minute (default: 60) */
  rateLimitPerMinute?: number;
  /** Expiration date (optional) */
  expiresAt?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Organizer membership tiers with pricing and limits
 */
export const ORGANIZER_TIERS: {
  value: OrganizerTier;
  label: string;
  description: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  eventsPerYear: number | null;
  registrationsPerYear: number | null;
  features: string[];
}[] = [
  {
    value: 'bronze',
    label: 'Bronze',
    description: 'Basic tournament management for small groups',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    eventsPerYear: 5,
    registrationsPerYear: 500,
    features: [
      'Up to 5 tournaments per year',
      'Up to 500 registrations',
      'Basic event management',
      'Email notifications',
      'Registration tracking',
    ],
  },
  {
    value: 'silver',
    label: 'Silver',
    description: 'Enhanced features for growing golf groups',
    priceMonthlyCents: 2999,
    priceYearlyCents: 29990,
    eventsPerYear: 20,
    registrationsPerYear: 2500,
    features: [
      'Up to 20 tournaments per year',
      'Up to 2,500 registrations',
      'Priority support',
      'Advanced analytics',
      'Custom branding',
      'Waitlist management',
    ],
  },
  {
    value: 'gold',
    label: 'Gold',
    description: 'Full access for professional tournament organizers',
    priceMonthlyCents: 9999,
    priceYearlyCents: 99990,
    eventsPerYear: null,
    registrationsPerYear: null,
    features: [
      'Unlimited tournaments',
      'Unlimited registrations',
      'White-label options',
      'API access',
      'Dedicated support',
      'Advanced integrations',
      'Custom workflows',
      'Team collaboration',
    ],
  },
];

/**
 * All event types with display labels
 */
export const EVENT_TYPES: { value: EventType; label: string; description: string }[] = [
  { value: 'tournament', label: 'Tournament', description: 'Competitive tournament with scoring and leaderboards' },
  { value: 'scramble', label: 'Scramble', description: 'Team scramble format event' },
  { value: 'charity', label: 'Charity Event', description: 'Fundraising golf event' },
  { value: 'corporate', label: 'Corporate Outing', description: 'Company team building or client entertainment' },
  { value: 'social', label: 'Social Event', description: 'Casual social gathering on the course' },
];

/**
 * All event statuses with display labels
 */
export const EVENT_STATUSES: { value: EventStatus; label: string; description: string }[] = [
  { value: 'draft', label: 'Draft', description: 'Event being created, not yet published' },
  { value: 'published', label: 'Published', description: 'Event visible but registration not open' },
  { value: 'registration_open', label: 'Registration Open', description: 'Accepting registrations' },
  { value: 'full', label: 'Full', description: 'Registration closed - at capacity' },
  { value: 'in_progress', label: 'In Progress', description: 'Event is happening now' },
  { value: 'completed', label: 'Completed', description: 'Event has concluded' },
  { value: 'cancelled', label: 'Cancelled', description: 'Event was cancelled' },
];

/**
 * Organizer roles with their default permissions
 */
export const ORGANIZER_ROLES: {
  value: OrganizerRole;
  label: string;
  description: string;
  defaultPermissions: OrganizerPermissions;
}[] = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full control of the organization including billing',
    defaultPermissions: {
      manageSettings: true,
      manageMembers: true,
      createEvents: true,
      editEvents: true,
      deleteEvents: true,
      viewRegistrations: true,
      manageRegistrations: true,
      viewAnalytics: true,
      exportData: true,
      sendInvites: true,
      manageApiKeys: true,
    },
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Manage events, members, and settings',
    defaultPermissions: {
      manageSettings: true,
      manageMembers: true,
      createEvents: true,
      editEvents: true,
      deleteEvents: true,
      viewRegistrations: true,
      manageRegistrations: true,
      viewAnalytics: true,
      exportData: true,
      sendInvites: true,
      manageApiKeys: false,
    },
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Create and edit events, view registrations',
    defaultPermissions: {
      manageSettings: false,
      manageMembers: false,
      createEvents: true,
      editEvents: true,
      deleteEvents: false,
      viewRegistrations: true,
      manageRegistrations: true,
      viewAnalytics: true,
      exportData: false,
      sendInvites: true,
      manageApiKeys: false,
    },
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'View-only access to events and analytics',
    defaultPermissions: {
      manageSettings: false,
      manageMembers: false,
      createEvents: false,
      editEvents: false,
      deleteEvents: false,
      viewRegistrations: true,
      manageRegistrations: false,
      viewAnalytics: true,
      exportData: false,
      sendInvites: false,
      manageApiKeys: false,
    },
  },
];

/**
 * All registration statuses with display labels
 */
export const REGISTRATION_STATUSES: { value: RegistrationStatus; label: string; description: string }[] = [
  { value: 'registered', label: 'Registered', description: 'Signed up but not yet confirmed' },
  { value: 'waitlisted', label: 'Waitlisted', description: 'On waitlist - event is full' },
  { value: 'confirmed', label: 'Confirmed', description: 'Spot confirmed' },
  { value: 'checked_in', label: 'Checked In', description: 'Arrived and checked in' },
  { value: 'no_show', label: 'No Show', description: 'Did not attend the event' },
  { value: 'cancelled', label: 'Cancelled', description: 'Registration was cancelled' },
];

/**
 * Analytics metric types with descriptions
 */
export const ANALYTICS_METRICS: { value: AnalyticsMetricType; label: string; description: string }[] = [
  { value: 'registration', label: 'Registrations', description: 'Registration funnel and conversion metrics' },
  { value: 'attendance', label: 'Attendance', description: 'Check-in rates and participation metrics' },
  { value: 'revenue', label: 'Revenue', description: 'Payment and financial performance metrics' },
  { value: 'engagement', label: 'Engagement', description: 'Interaction and communication metrics' },
];

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid OrganizerTier
 */
export function isValidOrganizerTier(tier: string): tier is OrganizerTier {
  return ['bronze', 'silver', 'gold'].includes(tier);
}

/**
 * Check if a string is a valid EventType
 */
export function isValidEventType(type: string): type is EventType {
  return ['tournament', 'scramble', 'charity', 'corporate', 'social'].includes(type);
}

/**
 * Check if a string is a valid EventStatus
 */
export function isValidEventStatus(status: string): status is EventStatus {
  return ['draft', 'published', 'registration_open', 'full', 'in_progress', 'completed', 'cancelled'].includes(status);
}

/**
 * Check if a string is a valid OrganizerRole
 */
export function isValidOrganizerRole(role: string): role is OrganizerRole {
  return ['owner', 'admin', 'manager', 'viewer'].includes(role);
}

// ============================================================================
// Operator Session (Web App Auth)
// ============================================================================

export type UserRole = 'golfer' | 'operator' | 'admin';

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
  memberRole?: 'owner' | 'admin' | 'manager' | 'viewer';
}
