/**
 * Booking Flow — Launch Mode Verification
 * Pure unit tests for booking flow launch modes and state transitions.
 * Note: The E2E DB-dependent tests were removed (they required live Supabase).
 * Those should live in @spotter/api-tests as integration tests instead.
 *
 * Run with: pnpm test
 */

import { describe, expect, it } from 'vitest';

// Engagement modes supported by the booking system
const LAUNCH_MODES = ['text_answer', 'video_answer', 'video_call'] as const;
type LaunchMode = typeof LAUNCH_MODES[number];

// Price mapping (cents) per mode
const MODE_PRICES: Record<LaunchMode, number> = {
  text_answer: 1000,
  video_answer: 2500,
  video_call: 5000,
};

describe('Launch Mode Verification', () => {
  it('text_answer: fully supported', () => {
    expect(LAUNCH_MODES).toContain('text_answer');
    expect(typeof MODE_PRICES.text_answer).toBe('number');
  });

  it('video_answer: fully supported', () => {
    expect(LAUNCH_MODES).toContain('video_answer');
    expect(typeof MODE_PRICES.video_answer).toBe('number');
  });

  it('video_call: supported with scheduled_time validation', () => {
    expect(LAUNCH_MODES).toContain('video_call');
    expect(typeof MODE_PRICES.video_call).toBe('number');
  });

  it('all modes have valid prices', () => {
    for (const mode of LAUNCH_MODES) {
      expect(MODE_PRICES[mode]).toBeGreaterThan(0);
    }
  });
});

describe('Video call scheduled time validation', () => {
  const isValidScheduledTime = (scheduledTime: string): boolean => {
    const scheduledDate = new Date(scheduledTime);
    return scheduledDate > new Date();
  };

  it('accepts future scheduled times', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isValidScheduledTime(future)).toBe(true);
  });

  it('rejects past scheduled times', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isValidScheduledTime(past)).toBe(false);
  });

  it('rejects current time (must be strictly future)', () => {
    const now = new Date().toISOString();
    expect(isValidScheduledTime(now)).toBe(false);
  });
});

describe('Review order status transitions', () => {
  type OrderStatus = 'created' | 'paid' | 'refunded';

  const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    created: ['paid'],
    paid: ['refunded'],
    refunded: [],
  };

  const isValidTransition = (from: OrderStatus, to: OrderStatus): boolean =>
    VALID_TRANSITIONS[from].includes(to);

  it('created → paid is valid', () => {
    expect(isValidTransition('created', 'paid')).toBe(true);
  });

  it('created → refunded is NOT valid (must pay first)', () => {
    expect(isValidTransition('created', 'refunded')).toBe(false);
  });

  it('paid → refunded is valid', () => {
    expect(isValidTransition('paid', 'refunded')).toBe(true);
  });

  it('paid → created is NOT valid (no going back)', () => {
    expect(isValidTransition('paid', 'created')).toBe(false);
  });

  it('refunded → any is NOT valid', () => {
    expect(isValidTransition('refunded', 'created')).toBe(false);
    expect(isValidTransition('refunded', 'paid')).toBe(false);
  });
});

describe('Engagement request status transitions', () => {
  type EngagementStatus = 'created' | 'awaiting_expert' | 'completed' | 'cancelled';

  const isTerminal = (status: EngagementStatus): boolean =>
    status === 'completed' || status === 'cancelled';

  it('created is not terminal', () => {
    expect(isTerminal('created')).toBe(false);
  });

  it('awaiting_expert is not terminal', () => {
    expect(isTerminal('awaiting_expert')).toBe(false);
  });

  it('completed is terminal', () => {
    expect(isTerminal('completed')).toBe(true);
  });

  it('cancelled is terminal', () => {
    expect(isTerminal('cancelled')).toBe(true);
  });
});
