import type { UUID } from './index';

export type CoachServiceType = 'video_review' | 'live_video_call' | 'swing_plan' | 'text_qna';

export type CoachRequestSourceSurface =
  | 'discovery'
  | 'matching'
  | 'network'
  | 'intro'
  | 'chat'
  | 'post_round'
  | 'profile'
  | 'direct';

export type CoachRequestStatus =
  | 'draft'
  | 'payment_pending'
  | 'paid'
  | 'queued'
  | 'accepted'
  | 'reschedule_pending'
  | 'in_review'
  | 'scheduled'
  | 'in_call'
  | 'delivered'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded';

export type CoachAssetType = 'video_submission' | 'response_video' | 'response_audio' | 'attachment';

export interface CoachServiceDTO {
  id: UUID;
  coachId: UUID;
  serviceType: CoachServiceType;
  title: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  turnaroundHours?: number | null;
  durationMinutes?: number | null;
  requiresVideo: boolean;
  requiresSchedule: boolean;
  active: boolean;
  sortOrder: number;
  metadata: Record<string, unknown>;
}

export interface CoachCatalogServiceDTO extends CoachServiceDTO {
  coachDisplayName?: string;
}

export interface CoachCatalogItemDTO {
  coachId: UUID;
  displayName: string;
  headline: string;
  bio: string;
  city: string;
  specialties: string[];
  ratingAvg: number | null;
  ratingCount: number;
  avgResponseMinutes: number | null;
  services: CoachCatalogServiceDTO[];
  minPrice: number;
  maxPrice: number;
  hasVideoReview: boolean;
}

export interface CoachRequestAssetDTO {
  id: UUID;
  engagementRequestId: UUID;
  assetType: CoachAssetType;
  videoSubmissionId?: UUID | null;
  storagePath?: string | null;
  role: string;
  sortOrder: number;
  metadata: Record<string, unknown>;
}

export interface CoachRequestTimelineEventDTO {
  id: UUID;
  engagementRequestId: UUID;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: UUID | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DeliveredFeedbackPackageDTO {
  engagementRequestId: UUID;
  responseId: UUID;
  summaryText?: string | null;
  responseText?: string | null;
  responseVideoUrl?: string | null;
  responseAudioUrl?: string | null;
  transcript?: string | null;
  structuredFeedback: Record<string, unknown>;
  attachments: Array<Record<string, unknown>>;
  deliveredAt?: string | null;
}

export interface CoachInboxRowDTO {
  engagementRequestId: UUID;
  reviewOrderId?: UUID | null;
  status: CoachRequestStatus;
  serviceTitle: string;
  serviceType: CoachServiceType;
  buyerName: string;
  buyerUserId?: UUID | null;
  questionText: string;
  amountCents: number;
  currency: string;
  sourceSurface?: CoachRequestSourceSurface | null;
  paidAt?: string | null;
  acceptedDeadlineAt?: string | null;
  deliveryDeadlineAt?: string | null;
  createdAt: string;
  assetCount: number;
}
