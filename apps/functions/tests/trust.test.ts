/**
 * Trust & Enforcement Tests
 * Tests the same-tier enforcement logic used across edge functions.
 * The core enforcement functions from _shared/enforcement.ts are testable without DB.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the Supabase client module
vi.mock('../supabase/functions/_shared/client', () => ({
  createClient: vi.fn(),
  createAuthedClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import {
  TIER_SLUGS,
  canSeeTier,
  getVisibleTiers,
  hasAccess,
  isValidTier,
  getDefaultTier,
  getTierPriority,
  canUpgrade,
} from '../supabase/functions/_shared/tier-gate';

describe('Same-tier enforcement — canSeeTier', () => {
  // This function is the backbone of tier visibility across all edge functions

  describe('free tier', () => {
    it('sees free members', () => {
      expect(canSeeTier('free', 'free')).toBe(true);
    });

    it('sees select members', () => {
      expect(canSeeTier('free', 'select')).toBe(true);
    });

    it('sees summit members', () => {
      expect(canSeeTier('free', 'summit')).toBe(true);
    });

    it('sees any tier if connected', () => {
      expect(canSeeTier('free', 'summit', true)).toBe(true);
    });
  });

  describe('select tier', () => {
    it('does NOT see free members by default', () => {
      expect(canSeeTier('select', 'free')).toBe(false);
    });

    it('sees select members', () => {
      expect(canSeeTier('select', 'select')).toBe(true);
    });

    it('sees summit members', () => {
      expect(canSeeTier('select', 'summit')).toBe(true);
    });

    it('sees free if connected', () => {
      expect(canSeeTier('select', 'free', true)).toBe(true);
    });
  });

  describe('summit tier', () => {
    it('does NOT see free members', () => {
      expect(canSeeTier('summit', 'free')).toBe(false);
    });

    it('does NOT see select members', () => {
      expect(canSeeTier('summit', 'select')).toBe(false);
    });

    it('sees summit members', () => {
      expect(canSeeTier('summit', 'summit')).toBe(true);
    });

    it('sees any tier if connected', () => {
      expect(canSeeTier('summit', 'free', true)).toBe(true);
      expect(canSeeTier('summit', 'select', true)).toBe(true);
    });
  });
});

describe('Discovery visibility — getVisibleTiers', () => {
  it('free: returns only free', () => {
    expect(getVisibleTiers('free')).toEqual(['free']);
  });

  it('free: huntMode ignored', () => {
    expect(getVisibleTiers('free', true)).toEqual(['free']);
  });

  it('select: returns select + summit', () => {
    expect(getVisibleTiers('select')).toEqual(['select', 'summit']);
  });

  it('select + huntMode: includes free', () => {
    expect(getVisibleTiers('select', true)).toEqual(['select', 'summit', 'free']);
  });

  it('summit: returns only summit', () => {
    expect(getVisibleTiers('summit')).toEqual(['summit']);
  });

  it('summit: huntMode ignored', () => {
    expect(getVisibleTiers('summit', true)).toEqual(['summit']);
  });

  it('unknown tier: defaults to free', () => {
    expect(getVisibleTiers('unknown' as any)).toEqual(['free']);
  });
});

describe('hasAccess feature flags', () => {
  describe('free tier access', () => {
    it('unlimitedSearch: false', () => {
      expect(hasAccess('free', 'unlimitedSearch')).toBe(false);
    });

    it('createRounds: false', () => {
      expect(hasAccess('free', 'createRounds')).toBe(false);
    });

    it('sendIntros: false', () => {
      expect(hasAccess('free', 'sendIntros')).toBe(false);
    });

    it('receiveIntros: true', () => {
      expect(hasAccess('free', 'receiveIntros')).toBe(true);
    });

    it('huntMode: false', () => {
      expect(hasAccess('free', 'huntMode')).toBe(false);
    });

    it('verifiedDirectory: false', () => {
      expect(hasAccess('free', 'verifiedDirectory')).toBe(false);
    });

    it('searchBoost: false', () => {
      expect(hasAccess('free', 'searchBoost')).toBe(false);
    });

    it('advancedAnalytics: false', () => {
      expect(hasAccess('free', 'advancedAnalytics')).toBe(false);
    });

    it('customProfileUrl: false', () => {
      expect(hasAccess('free', 'customProfileUrl')).toBe(false);
    });

    it('eventAccess: false', () => {
      expect(hasAccess('free', 'eventAccess')).toBe(false);
    });
  });

  describe('select tier access', () => {
    it('unlimitedSearch: true', () => {
      expect(hasAccess('select', 'unlimitedSearch')).toBe(true);
    });

    it('createRounds: true', () => {
      expect(hasAccess('select', 'createRounds')).toBe(true);
    });

    it('sendIntros: true', () => {
      expect(hasAccess('select', 'sendIntros')).toBe(true);
    });

    it('huntMode: true', () => {
      expect(hasAccess('select', 'huntMode')).toBe(true);
    });

    it('verifiedDirectory: true', () => {
      expect(hasAccess('select', 'verifiedDirectory')).toBe(true);
    });

    it('advancedAnalytics: false (basic only)', () => {
      expect(hasAccess('select', 'advancedAnalytics')).toBe(false);
    });

    it('eventAccess: true (select_events)', () => {
      expect(hasAccess('select', 'eventAccess')).toBe(true);
    });

    it('customProfileUrl: false', () => {
      expect(hasAccess('select', 'customProfileUrl')).toBe(false);
    });

    it('createExclusiveEvents: false', () => {
      expect(hasAccess('select', 'createExclusiveEvents')).toBe(false);
    });
  });

  describe('summit tier access', () => {
    it('unlimitedSearch: true', () => {
      expect(hasAccess('summit', 'unlimitedSearch')).toBe(true);
    });

    it('unlimitedConnections: true', () => {
      expect(hasAccess('summit', 'unlimitedConnections')).toBe(true);
    });

    it('createRounds: true', () => {
      expect(hasAccess('summit', 'createRounds')).toBe(true);
    });

    it('sendIntros: true', () => {
      expect(hasAccess('summit', 'sendIntros')).toBe(true);
    });

    it('huntMode: true', () => {
      expect(hasAccess('summit', 'huntMode')).toBe(true);
    });

    it('hideFromLowerTiers: true', () => {
      expect(hasAccess('summit', 'hideFromLowerTiers')).toBe(true);
    });

    it('verifiedDirectory: true', () => {
      expect(hasAccess('summit', 'verifiedDirectory')).toBe(true);
    });

    it('searchBoost: true', () => {
      expect(hasAccess('summit', 'searchBoost')).toBe(true);
    });

    it('advancedAnalytics: true', () => {
      expect(hasAccess('summit', 'advancedAnalytics')).toBe(true);
    });

    it('eventAccess: true (all_events)', () => {
      expect(hasAccess('summit', 'eventAccess')).toBe(true);
    });

    it('customProfileUrl: true', () => {
      expect(hasAccess('summit', 'customProfileUrl')).toBe(true);
    });

    it('createExclusiveEvents: true', () => {
      expect(hasAccess('summit', 'createExclusiveEvents')).toBe(true);
    });
  });

  describe('unknown feature', () => {
    it('returns false', () => {
      expect(hasAccess('free', 'unknownFeature' as any)).toBe(false);
    });
  });
});

describe('Tier validation', () => {
  it('isValidTier accepts valid slugs', () => {
    expect(isValidTier('free')).toBe(true);
    expect(isValidTier('select')).toBe(true);
    expect(isValidTier('summit')).toBe(true);
  });

  it('isValidTier rejects invalid slugs', () => {
    expect(isValidTier('pro')).toBe(false);
    expect(isValidTier('basic')).toBe(false);
    expect(isValidTier('')).toBe(false);
    expect(isValidTier('FREE')).toBe(false);
    expect(isValidTier('trial')).toBe(false);
  });

  it('getDefaultTier returns free', () => {
    expect(getDefaultTier()).toBe('free');
  });
});

describe('Tier upgrade logic', () => {
  it('getTierPriority: free=1, select=2, summit=3', () => {
    expect(getTierPriority('free')).toBe(1);
    expect(getTierPriority('select')).toBe(2);
    expect(getTierPriority('summit')).toBe(3);
  });

  it('canUpgrade: free → select', () => {
    expect(canUpgrade('free', 'select')).toBe(true);
  });

  it('canUpgrade: free → summit', () => {
    expect(canUpgrade('free', 'summit')).toBe(true);
  });

  it('canUpgrade: select → summit', () => {
    expect(canUpgrade('select', 'summit')).toBe(true);
  });

  it('canUpgrade: same tier fails', () => {
    expect(canUpgrade('free', 'free')).toBe(false);
    expect(canUpgrade('select', 'select')).toBe(false);
    expect(canUpgrade('summit', 'summit')).toBe(false);
  });

  it('canUpgrade: downgrade fails', () => {
    expect(canUpgrade('select', 'free')).toBe(false);
    expect(canUpgrade('summit', 'select')).toBe(false);
    expect(canUpgrade('summit', 'free')).toBe(false);
  });
});

describe('Tier slugs constant', () => {
  it('has free, select, summit', () => {
    expect(TIER_SLUGS.FREE).toBe('free');
    expect(TIER_SLUGS.SELECT).toBe('select');
    expect(TIER_SLUGS.SUMMIT).toBe('summit');
  });
});
