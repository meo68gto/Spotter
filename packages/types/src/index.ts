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
