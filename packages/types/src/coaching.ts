// Coaching domain types
import type { UUID } from './common';

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

export interface FeedbackSummaryDTO {
  userId: UUID;
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  positiveRatio: number;
  topTags: string[];
}
