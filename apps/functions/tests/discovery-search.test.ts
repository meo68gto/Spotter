/**
 * Discovery Search Tests
 * Tests the validation logic and shared utilities used by the discovery-search edge function.
 * The serve() handler itself runs in Deno but the filter validation and tier logic are testable.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the Supabase client module before importing anything that uses it
vi.mock('../supabase/functions/_shared/client', () => ({
  createClient: vi.fn(),
  createAuthedClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

// Mock env to avoid Deno dependencies
vi.mock('../supabase/functions/_shared/env', () => ({
  getRuntimeEnv: () => ({
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    serviceRoleKey: 'test-service-key',
  }),
}));

import { TIER_SLUGS, getTierFeatures, getVisibleTiers, type TierSlug } from '../supabase/functions/_shared/tier-gate';
import { rateLimitUser, exceededMessageLimit, exceededDiscoveryLimit, exceededPaymentLimit } from '../supabase/functions/_shared/rate-limit';

// Re-export TierSlug so tests can use it
export type { TierSlug };

// Validation constants from discovery-search/index.ts
const VALID_HANDICAP_BANDS = ['low', 'mid', 'high'] as const;
const VALID_INTENTS = ['business', 'social', 'competitive', 'business_social'] as const;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

// Filter validation logic extracted from the edge function
function validateHandicapBand(value: unknown): { valid: boolean; value?: string; error?: string } {
  if (value === undefined || value === null) {
    return { valid: true };
  }
  if (!VALID_HANDICAP_BANDS.includes(value as typeof VALID_HANDICAP_BANDS[number])) {
    return {
      valid: false,
      error: `Invalid handicap_band. Must be one of: ${VALID_HANDICAP_BANDS.join(', ')}`,
    };
  }
  return { valid: true, value: value as string };
}

function validateIntent(value: unknown): { valid: boolean; value?: string; error?: string } {
  if (value === undefined || value === null) {
    return { valid: true };
  }
  if (!VALID_INTENTS.includes(value as typeof VALID_INTENTS[number])) {
    return {
      valid: false,
      error: `Invalid intent. Must be one of: ${VALID_INTENTS.join(', ')}`,
    };
  }
  return { valid: true, value: value as string };
}

function validateLocation(value: unknown): { valid: boolean; value?: string; error?: string } {
  if (value === undefined || value === null) {
    return { valid: true };
  }
  const str = String(value).trim();
  if (str.length > 100) {
    return { valid: false, error: 'Location too long. Maximum 100 characters' };
  }
  if (!str) {
    return { valid: true };
  }
  return { valid: true, value: str };
}

function parseLimit(value: unknown, maxAllowed: number | null): { limit: number; valid: boolean; error?: string } {
  if (value === undefined || value === null) {
    return { limit: DEFAULT_LIMIT, valid: true };
  }
  const parsed = Math.min(Math.max(1, parseInt(String(value), 10)), MAX_LIMIT);
  const enforced = maxAllowed !== null ? Math.min(parsed, maxAllowed) : parsed;
  return { limit: enforced, valid: true };
}

function parseOffset(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }
  return Math.max(0, parseInt(String(value), 10));
}

describe('handicap band validation', () => {
  it('accepts valid handicap bands', () => {
    expect(validateHandicapBand('low').valid).toBe(true);
    expect(validateHandicapBand('mid').valid).toBe(true);
    expect(validateHandicapBand('high').valid).toBe(true);
  });

  it('rejects invalid handicap bands', () => {
    expect(validateHandicapBand('beginner').valid).toBe(false);
    expect(validateHandicapBand('').valid).toBe(false);
    expect(validateHandicapBand('LOW').valid).toBe(false);
  });

  it('allows undefined (no filter)', () => {
    expect(validateHandicapBand(undefined).valid).toBe(true);
    expect(validateHandicapBand(null).valid).toBe(true);
  });
});

describe('intent validation', () => {
  it('accepts valid intents', () => {
    expect(validateIntent('business').valid).toBe(true);
    expect(validateIntent('social').valid).toBe(true);
    expect(validateIntent('competitive').valid).toBe(true);
    expect(validateIntent('business_social').valid).toBe(true);
  });

  it('rejects invalid intents', () => {
    expect(validateIntent('work').valid).toBe(false);
    expect(validateIntent('').valid).toBe(false);
    expect(validateIntent('BUSINESS').valid).toBe(false);
  });

  it('allows undefined (no filter)', () => {
    expect(validateIntent(undefined).valid).toBe(true);
    expect(validateIntent(null).valid).toBe(true);
  });
});

describe('location validation', () => {
  it('accepts valid locations', () => {
    expect(validateLocation('Scottsdale, AZ').valid).toBe(true);
    expect(validateLocation('New York').valid).toBe(true);
    expect(validateLocation('AZ').valid).toBe(true);
  });

  it('rejects locations over 100 characters', () => {
    const longLocation = 'A'.repeat(101);
    expect(validateLocation(longLocation).valid).toBe(false);
  });

  it('accepts empty string as no filter', () => {
    expect(validateLocation('').valid).toBe(true);
    expect(validateLocation('   ').valid).toBe(true);
  });

  it('allows undefined/null', () => {
    expect(validateLocation(undefined).valid).toBe(true);
    expect(validateLocation(null).valid).toBe(true);
  });

  it('trims whitespace', () => {
    expect(validateLocation('  Phoenix, AZ  ').value).toBe('Phoenix, AZ');
  });
});

describe('limit parsing', () => {
  it('defaults to 20', () => {
    expect(parseLimit(undefined, null).limit).toBe(20);
  });

  it('enforces minimum of 1', () => {
    expect(parseLimit(0, null).limit).toBe(1);
    expect(parseLimit(-5, null).limit).toBe(1);
  });

  it('enforces maximum of 100', () => {
    expect(parseLimit(500, null).limit).toBe(100);
  });

  it('respects tier maxSearchResults cap', () => {
    // Free tier maxSearchResults = 20
    expect(parseLimit(50, 20).limit).toBe(20);
    expect(parseLimit(10, 20).limit).toBe(10);
    // Select tier unlimited (null)
    expect(parseLimit(50, null).limit).toBe(50);
  });

  it('keeps valid values inside bounds', () => {
    expect(parseLimit(30, null).limit).toBe(30);
    expect(parseLimit(100, null).limit).toBe(100);
    expect(parseLimit(1, null).limit).toBe(1);
  });
});

describe('offset parsing', () => {
  it('defaults to 0', () => {
    expect(parseOffset(undefined)).toBe(0);
    expect(parseOffset(null)).toBe(0);
  });

  it('clamps negative to 0', () => {
    expect(parseOffset(-10)).toBe(0);
    expect(parseOffset(-1)).toBe(0);
  });

  it('accepts valid offsets', () => {
    expect(parseOffset(0)).toBe(0);
    expect(parseOffset(20)).toBe(20);
    expect(parseOffset(1000)).toBe(1000);
  });
});

describe('tier-based search limits', () => {
  it('free tier enforces 20 max results', () => {
    const features = getTierFeatures('free');
    expect(features.maxSearchResults).toBe(20);
  });

  it('select tier is unlimited', () => {
    const features = getTierFeatures('select');
    expect(features.maxSearchResults).toBeNull();
  });

  it('summit tier is unlimited', () => {
    const features = getTierFeatures('summit');
    expect(features.maxSearchResults).toBeNull();
  });
});

describe('rate limit constants', () => {
  it('exceededMessageLimit triggers at 20 messages', () => {
    expect(exceededMessageLimit(19)).toBe(false);
    expect(exceededMessageLimit(20)).toBe(true);
    expect(exceededMessageLimit(100)).toBe(true);
  });

  it('exceededDiscoveryLimit triggers at 30 searches', () => {
    expect(exceededDiscoveryLimit(29)).toBe(false);
    expect(exceededDiscoveryLimit(30)).toBe(true);
  });

  it('exceededPaymentLimit triggers at 10 operations', () => {
    expect(exceededPaymentLimit(9)).toBe(false);
    expect(exceededPaymentLimit(10)).toBe(true);
  });
});

describe('visible tiers by tier', () => {
  it('free sees only free', () => {
    expect(getVisibleTiers('free')).toEqual(['free']);
  });

  it('select sees select and summit', () => {
    expect(getVisibleTiers('select')).toEqual(['select', 'summit']);
  });

  it('select sees free with huntMode', () => {
    expect(getVisibleTiers('select', true)).toEqual(['select', 'summit', 'free']);
  });

  it('summit sees only summit', () => {
    expect(getVisibleTiers('summit')).toEqual(['summit']);
  });
});
