export type UUID = string;

export interface SkillDimension {
  key: string;
  label: string;
  score: number;
  maxScore?: number;
}

export interface SkillProfileDTO {
  id: UUID;
  userId: UUID;
  activityId: UUID;
  canonicalScore: number;
  confidence: number;
  sourceScale: string;
  skillBand: string;
  dimensions: SkillDimension[];
  updatedAt: string;
}

export interface MatchCandidateDTO {
  userId: UUID;
  activityId: UUID;
  distanceKm: number;
  skillDelta: number;
  availabilityOverlapMinutes: number;
  reasons: string[];
  matchScore?: number;
}

export type MatchStatus = "pending" | "accepted" | "rejected" | "expired";

export interface AvailabilitySlotDTO {
  weekday: number;
  startMinute: number;
  endMinute: number;
  timezone?: string;
}

export type SessionStatus =
  | "proposed"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface SessionDTO {
  id: UUID;
  matchId: UUID;
  proposerUserId: UUID;
  partnerUserId: UUID;
  proposedStartTime: string;
  confirmedTime?: string;
  locationPoint: {
    latitude: number;
    longitude: number;
  };
  status: SessionStatus;
}

export interface AnalysisMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
}

export interface AnalysisResultDTO {
  provider: "openai-vision" | "replicate" | "manual";
  summary: string;
  metrics: AnalysisMetric[];
  annotations?: Array<{
    tsMs: number;
    note: string;
  }>;
}

export interface VideoSubmissionDTO {
  id: UUID;
  userId: UUID;
  activityId: UUID;
  storagePath: string;
  status: "uploaded" | "processing" | "analyzed" | "failed";
  aiAnalysis?: AnalysisResultDTO;
  coachReviewId?: UUID;
  createdAt: string;
}

export interface ProgressSnapshotDTO {
  id: UUID;
  userId: UUID;
  activityId: UUID;
  snapshotDate: string;
  metrics: AnalysisMetric[];
  trendSummary: string;
  sourceSubmissionIds: UUID[];
}

export interface MatchRequestDTO {
  candidateUserId: UUID;
  activityId: UUID;
  requestedFrom?: string;
  requestedTo?: string;
}

export interface MatchActionDTO {
  matchId: UUID;
}

export interface SessionActionDTO {
  sessionId: UUID;
  confirmedTime?: string;
  latitude?: number;
  longitude?: number;
}

export interface ChatMessageDTO {
  sessionId: UUID;
  message: string;
  clientMessageId?: string;
}

export interface VideoUploadIntentDTO {
  activityId: UUID;
  fileExt?: string;
  sessionId?: UUID;
}

export interface VideoAnalysisIngestDTO {
  videoSubmissionId: UUID;
  provider: "openai-vision" | "replicate" | "manual";
  summary: string;
  metrics: AnalysisMetric[];
  annotations?: Array<{ tsMs: number; note: string }>;
}

export interface ProgressSeriesDTO {
  activityId: UUID;
  snapshots: ProgressSnapshotDTO[];
}

export type ReviewOrderStatus =
  | 'created'
  | 'requires_payment_method'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export interface CoachProductDTO {
  id: UUID;
  coachId: UUID;
  activityId?: UUID;
  title: string;
  description?: string;
  durationMinutes: number;
  currency: string;
  priceCents: number;
  active: boolean;
}

export interface ReviewOrderCreateDTO {
  coachId: UUID;
  coachReviewProductId: UUID;
  videoSubmissionId: UUID;
}

export interface ReviewOrderStatusDTO {
  id: UUID;
  status: ReviewOrderStatus;
  amountCents: number;
  currency: string;
  platformFeeCents: number;
  coachPayoutCents: number;
  stripePaymentIntentId?: string;
  paidAt?: string;
  refundedAt?: string;
}

export interface RefundRequestDTO {
  reviewOrderId: UUID;
  reason?: string;
}

export interface LegalConsentStatusDTO {
  accepted: boolean;
  requiredVersions: {
    tos: string;
    privacy: string;
    cookie: string;
  };
  acceptedVersions?: {
    tos: string;
    privacy: string;
    cookie: string;
  };
  acceptedAt?: string;
}

export interface FeedbackSummaryDTO {
  userId: UUID;
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  positiveRatio: number;
  topTags: string[];
}

export type EngagementMode = 'text_answer' | 'video_answer' | 'video_call';
export type EngagementStatus =
  | 'created'
  | 'awaiting_expert'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export interface EngagementRequestDTO {
  id: UUID;
  requesterUserId?: UUID;
  coachId: UUID;
  engagementMode: EngagementMode;
  questionText: string;
  attachmentUrls?: string[];
  scheduledTime?: string;
  status: EngagementStatus;
  expiresAt: string;
  acceptedAt?: string;
  completedAt?: string;
  publicOptIn: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
}

export interface EngagementResponseDTO {
  id: UUID;
  engagementRequestId: UUID;
  coachId: UUID;
  responseText?: string;
  audioUrl?: string;
  videoUrl?: string;
  transcript?: string;
  submittedAt: string;
}

export interface ExpertPricingDTO {
  coachId: UUID;
  engagementMode: EngagementMode;
  currency: string;
  priceCents: number;
  perMinuteRateCents?: number;
  active: boolean;
}

export interface GuestCheckoutStartDTO {
  email: string;
}

export interface GuestVerifyDTO {
  token: string;
}

export interface MCPBookingPlanRequestDTO {
  activityId: UUID;
  radiusKm?: number;
  limit?: number;
  includeEvents?: boolean;
  objective?: 'balanced' | 'fast_match' | 'tournament_ready';
}

export interface MCPPairingRecommendationDTO {
  type: 'pairing';
  candidateUserId: UUID | null;
  candidateDisplayName: string;
  candidateAvatarUrl?: string | null;
  score: number;
  distanceKm?: number | null;
  skillDelta?: number | null;
  availabilityOverlapMinutes?: number | null;
  reasons: unknown;
}

export interface MCPEventRecommendationDTO {
  type: 'event';
  eventId: UUID | null;
  title: string;
  city?: string | null;
  venueName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sponsorName?: string | null;
  score: number;
  distanceKm?: number | null;
  reasons: unknown;
}

export interface MCPBookingPlanResponseDTO {
  run: {
    id: UUID;
    requester_user_id: UUID;
    activity_id: UUID;
    objective: string;
    radius_km: number;
    include_events: boolean;
    created_at: string;
  };
  pairings: MCPPairingRecommendationDTO[];
  events: MCPEventRecommendationDTO[];
}

export interface SponsorEventCreateDTO {
  sponsorId?: UUID;
  sponsorName?: string;
  sponsorCity?: string;
  title: string;
  description?: string;
  activityId: UUID;
  city?: string;
  venueName?: string;
  latitude?: number;
  longitude?: number;
  startTime: string;
  endTime: string;
  maxParticipants?: number;
}

export interface SponsorEventDTO {
  id: UUID;
  sponsor_id: UUID;
  sponsor_name?: string;
  activity_id: UUID;
  title: string;
  description?: string;
  city?: string;
  venue_name?: string;
  start_time: string;
  end_time: string;
  status: 'draft' | 'published' | 'closed' | 'cancelled';
  max_participants: number;
  registration_count?: number;
  my_registration_status?: 'registered' | 'waitlist' | 'cancelled' | 'checked_in' | null;
}

export interface SponsorEventInviteLocalsDTO {
  eventId: UUID;
  radiusKm?: number;
  limit?: number;
  message?: string;
}

export interface SponsorEventRSVPDTO {
  eventId: UUID;
  recommendationId?: UUID;
  action: 'register' | 'cancel' | 'accept_invite' | 'decline_invite';
}

export interface NetworkingInviteSendDTO {
  receiverUserId: UUID;
  activityId: UUID;
  recommendationId?: UUID;
  relatedEventId?: UUID;
  purpose?: 'session' | 'tournament' | 'networking';
  message?: string;
}

export interface InboxConversationDTO {
  threadType: 'session' | 'engagement';
  threadId: UUID;
  title: string;
  status: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface InboxThreadMessageDTO {
  id: UUID;
  threadType: 'session' | 'engagement';
  threadId: UUID;
  senderUserId: UUID;
  message: string;
  clientMessageId?: string | null;
  createdAt: string;
}

export interface InboxMarkReadDTO {
  threadType: 'session' | 'engagement';
  threadId: UUID;
  lastReadAt?: string;
}

export interface SkillRadarPointDTO {
  key: string;
  label: string;
  value: number;
  maxValue: number;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface ToastPayloadDTO {
  type?: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  durationMs?: number;
}

export interface OnboardingStepDraftDTO {
  activityId: UUID;
  sourceScale: string;
  sourceValue: string;
  canonicalScore: number;
  skillBand: string;
  city: string;
  timezone: string;
  availabilitySlots: AvailabilitySlotDTO[];
}

// Profile & Networking Types
export type {
  // Professional Identity
  ProfessionalIdentity,
  CompanyVerificationStatus,
  // Golf Identity
  GolfIdentity,
  PlayFrequency,
  TeeTimePreference,
  // Extended Profile
  ExtendedProfile,
  ProfileCompleteness,
  ProfileSection,
  // Connection Types
  Connection,
  ConnectionStatus,
  ConnectionType,
  ConnectionWithMembers,
  PendingConnection,
  // Introduction Types
  ConnectionIntro,
  IntroStatus,
  IntroWithConnection,
  // Reputation Types
  ReputationScore,
  ReputationComponent,
  ReputationComponentScore,
  ReputationEvent,
  ReputationEventType,
  // Input Types
  UpdateProfileInput,
  SendConnectionRequestInput,
  RespondToConnectionInput,
  RequestIntroInput,
} from "./profile.js";

export {
  // Constants
  PLAY_FREQUENCIES,
  TEE_TIME_PREFERENCES,
  CONNECTION_STATUSES,
  CONNECTION_TYPES,
  PROFILE_SECTIONS,
  REPUTATION_WEIGHTS,
  // Type Guards
  isValidPlayFrequency,
  isValidConnectionStatus,
  isValidConnectionType,
  isValidTeeTimePreference,
  isValidProfileSection,
  isValidCompanyVerificationStatus,
  isValidIntroStatus,
  isValidReputationComponent,
} from "./profile.js";

// ============================================================================
// Organizer Types Re-exports
// ============================================================================

export type {
  // Organizer Account Types
  OrganizerAccount,
  OrganizerTier,
  OrganizerStatus,
  OrganizerWithStats,
  OrganizerQuotaInfo,
  // Organizer Member Types
  OrganizerMember,
  OrganizerRole,
  OrganizerPermissions,
  OrganizerMemberWithUser,
  // Event Types
  OrganizerEvent,
  EventType,
  EventStatus,
  OrganizerEventWithCourse,
  OrganizerEventWithStats,
  EventTargetTiers,
  // Registration Types
  EventRegistration,
  RegistrationStatus,
  PaymentStatus,
  RegistrationWithUser,
  RegistrationWithEvent,
  // Invite Types
  OrganizerInvite,
  InviteStatus,
  OrganizerInviteWithEvent,
  InviteQuotaInfo,
  // Analytics Types
  OrganizerAnalytics,
  AnalyticsMetricType,
  RegistrationMetrics,
  AttendanceMetrics,
  RevenueMetrics,
  EngagementMetrics,
  // API Key Types
  OrganizerApiKey,
  ApiKeyWithPermissions,
  ApiKeyUsage,
  // Input Types
  CreateOrganizerInput,
  UpdateOrganizerInput,
  CreateEventInput,
  UpdateEventInput,
  RegisterForEventInput,
  SendInviteInput,
  CreateApiKeyInput,
} from "./organizer.js";

export {
  // Constants
  ORGANIZER_TIERS,
  EVENT_TYPES,
  EVENT_STATUSES,
  ORGANIZER_ROLES,
  REGISTRATION_STATUSES,
  ANALYTICS_METRICS,
  // Type Guards
  isValidOrganizerTier,
  isValidEventType,
  isValidEventStatus,
  isValidOrganizerRole,
} from "./organizer.js";

// ============================================================================
// Discovery Types Re-exports
// ============================================================================

export type {
  // Filter Types
  HandicapBand,
  NetworkingIntentFilter,
  SearchFilters,
  // Golfer Types
  DiscoverableProfessionalIdentity,
  DiscoverableGolfIdentity,
  DiscoverableNetworkingPreferences,
  DiscoverableGolfer,
  // Result Types
  DiscoveryPagination,
  CallerTierInfo,
  DiscoveryResult,
  // Input Types
  DiscoverySearchInput,
  // Error Types
  DiscoveryError,
  DiscoveryErrorCode,
  // Helper Types
  DiscoverGolfersRow,
} from "./discovery.js";

export {
  // Constants
  HANDICAP_BANDS,
  NETWORKING_INTENT_FILTERS,
  DISCOVERY_DEFAULTS,
  // Type Guards
  isValidHandicapBand,
  isValidNetworkingIntentFilter,
  validateDiscoveryInput,
  // Transformers
  transformDiscoverableGolfer,
} from "./discovery.js";

// ============================================================================
// Matching Engine Types Re-exports
// ============================================================================

export type {
  // Match Score Types
  CompatibilityFactor,
  MatchScore,
  MatchSuggestion,
  TopMatchesResponse,
  CalculateMatchRequest,
  CalculateMatchResponse,
  // Configuration Types
  MatchWeights,
  // Input Types
  GetTopMatchesInput,
  GetMatchWithUserInput,
} from "./matching.js";

export {
  // Constants
  DEFAULT_MATCH_WEIGHTS,
  HANDICAP_THRESHOLDS,
  HANDICAP_SCORES,
  NETWORKING_INTENT_COMPATIBILITY,
  LOCATION_THRESHOLDS,
  LOCATION_SCORES,
  GROUP_SIZE_COMPATIBILITY,
  MATCH_TIERS,
  DEFAULT_MATCH_LIMIT,
  MIN_MATCH_SCORE,
  // Helper Functions
  calculateHandicapScore,
  calculateNetworkingIntentScore,
  calculateLocationScore,
  calculateGroupSizeScore,
  getMatchTier,
  formatMatchScore,
  generateMatchReasoning,
} from "./matching.js";
