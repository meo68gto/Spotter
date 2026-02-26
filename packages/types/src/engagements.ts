// Engagements domain types
import type { UUID } from './common';

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
