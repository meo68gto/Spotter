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
