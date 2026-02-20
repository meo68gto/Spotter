import { describe, expect, it } from 'vitest';
import { clampMatchLimit } from '../supabase/functions/_shared/matching';
import { exceededMessageLimit } from '../supabase/functions/_shared/rate-limit';
import {
  hasRequiredOnboardingFields,
  hasRequiredSessionFields
} from '../supabase/functions/_shared/validation';

describe('clampMatchLimit', () => {
  it('defaults to 5 when undefined', () => {
    expect(clampMatchLimit(undefined)).toBe(5);
  });

  it('enforces lower bound', () => {
    expect(clampMatchLimit(0)).toBe(1);
  });

  it('enforces upper bound', () => {
    expect(clampMatchLimit(20)).toBe(5);
  });

  it('keeps values inside bounds', () => {
    expect(clampMatchLimit(3)).toBe(3);
  });
});

describe('payload validation', () => {
  it('accepts valid onboarding payload', () => {
    expect(
      hasRequiredOnboardingFields({
        activityId: 'a',
        sourceScale: 'self_assessment',
        skillBand: 'intermediate'
      })
    ).toBe(true);
  });

  it('rejects invalid onboarding payload', () => {
    expect(
      hasRequiredOnboardingFields({
        activityId: '',
        sourceScale: 'self_assessment',
        skillBand: 'intermediate'
      })
    ).toBe(false);
  });

  it('accepts valid session payload', () => {
    expect(
      hasRequiredSessionFields({
        matchId: 'm',
        partnerUserId: 'u',
        proposedStartTime: '2026-02-19T12:00:00Z'
      })
    ).toBe(true);
  });

  it('rejects invalid session payload', () => {
    expect(
      hasRequiredSessionFields({
        matchId: 'm',
        partnerUserId: '',
        proposedStartTime: '2026-02-19T12:00:00Z'
      })
    ).toBe(false);
  });
});

describe('chat rate limits', () => {
  it('allows under threshold', () => {
    expect(exceededMessageLimit(19)).toBe(false);
  });

  it('blocks at threshold', () => {
    expect(exceededMessageLimit(20)).toBe(true);
  });
});
