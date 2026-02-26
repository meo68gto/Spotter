// _shared/engagements.ts
// Engagement state machine helpers and DB query utilities
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type EngagementStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'responded'
  | 'reschedule_requested'
  | 'reschedule_accepted'
  | 'expired'
  | 'completed';

export type EngagementType = 'text' | 'video' | 'call';

export interface Engagement {
  id: string;
  user_id: string;
  expert_id: string;
  type: EngagementType;
  status: EngagementStatus;
  question?: string;
  response?: string;
  scheduled_at?: string;
  expires_at?: string;
  payment_intent_id?: string;
  amount_cents: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/** Valid status transitions for the engagement state machine */
const ALLOWED_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  pending: ['accepted', 'declined', 'expired'],
  accepted: ['responded', 'reschedule_requested', 'expired'],
  declined: [],
  responded: ['completed'],
  reschedule_requested: ['reschedule_accepted', 'declined', 'expired'],
  reschedule_accepted: ['responded', 'expired'],
  expired: [],
  completed: [],
};

/** Check whether a status transition is allowed */
export function isTransitionAllowed(
  current: EngagementStatus,
  next: EngagementStatus
): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}

/** Get the next allowed statuses from a given status */
export function getNextStatuses(current: EngagementStatus): EngagementStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

/** Fetch a single engagement by ID */
export async function fetchEngagement(
  client: SupabaseClient,
  engagementId: string
): Promise<Engagement | null> {
  const { data, error } = await client
    .from('engagements')
    .select('*')
    .eq('id', engagementId)
    .single();

  if (error) throw error;
  return data as Engagement | null;
}

/** Update engagement status with transition validation */
export async function updateEngagementStatus(
  client: SupabaseClient,
  engagementId: string,
  currentStatus: EngagementStatus,
  newStatus: EngagementStatus,
  extra?: Partial<Engagement>
): Promise<Engagement> {
  if (!isTransitionAllowed(currentStatus, newStatus)) {
    throw new Error(
      `Invalid engagement transition: ${currentStatus} → ${newStatus}`
    );
  }

  const { data, error } = await client
    .from('engagements')
    .update({ status: newStatus, updated_at: new Date().toISOString(), ...extra })
    .eq('id', engagementId)
    .select()
    .single();

  if (error) throw error;
  return data as Engagement;
}

/** Check if an engagement has expired */
export function isEngagementExpired(engagement: Engagement): boolean {
  if (!engagement.expires_at) return false;
  return new Date(engagement.expires_at) < new Date();
}

/** Check if a user is the expert of an engagement */
export function isExpert(engagement: Engagement, userId: string): boolean {
  return engagement.expert_id === userId;
}

/** Check if a user is the requester of an engagement */
export function isRequester(engagement: Engagement, userId: string): boolean {
  return engagement.user_id === userId;
}

// ---------------------------------------------------------------------------
// Engagement utilities (consolidated from engagement-utils.ts)
// ---------------------------------------------------------------------------

/** Format an engagement for public display (strip private fields) */
export function formatPublicEngagement(
  engagement: Engagement
): Omit<Engagement, 'payment_intent_id'> {
  const { payment_intent_id: _paymentIntentId, ...publicFields } = engagement;
  return publicFields;
}

/** Calculate whether an engagement is within the response window */
export function isWithinResponseWindow(
  engagement: Engagement,
  windowHours = 48
): boolean {
  const created = new Date(engagement.created_at);
  const windowEnd = new Date(created.getTime() + windowHours * 60 * 60 * 1000);
  return new Date() < windowEnd;
}
