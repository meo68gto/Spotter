/**
 * Tier Access Tests
 * Tests the tier assignment logic used by tier-assignment edge functions.
 * Tests upgrade validation, downgrade validation, and tier slug handling.
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
  isValidTier,
  canUpgrade,
  getDefaultTier,
  getTierPriority,
  hasAccess,
  getNextTier,
  canSeeTier,
  getVisibleTiers,
} from '../supabase/functions/_shared/tier-gate';

describe('Tier assignment — isValidTier', () => {
  it('accepts free', () => {
    expect(isValidTier('free')).toBe(true);
  });

  it('accepts select', () => {
    expect(isValidTier('select')).toBe(true);
  });

  it('accepts summit', () => {
    expect(isValidTier('summit')).toBe(true);
  });

  it('rejects unknown slugs', () => {
    expect(isValidTier('pro')).toBe(false);
    expect(isValidTier('trial')).toBe(false);
    expect(isValidTier('')).toBe(false);
    expect(isValidTier('FREE')).toBe(false);
    expect(isValidTier('basic')).toBe(false);
  });
});

describe('Tier assignment — canUpgrade', () => {
  it('free can upgrade to select', () => {
    expect(canUpgrade('free', 'select')).toBe(true);
  });

  it('free can upgrade to summit', () => {
    expect(canUpgrade('free', 'summit')).toBe(true);
  });

  it('select can upgrade to summit', () => {
    expect(canUpgrade('select', 'summit')).toBe(true);
  });

  it('same tier is NOT an upgrade', () => {
    expect(canUpgrade('free', 'free')).toBe(false);
    expect(canUpgrade('select', 'select')).toBe(false);
    expect(canUpgrade('summit', 'summit')).toBe(false);
  });

  it('downgrade is NOT allowed', () => {
    expect(canUpgrade('select', 'free')).toBe(false);
    expect(canUpgrade('summit', 'select')).toBe(false);
    expect(canUpgrade('summit', 'free')).toBe(false);
  });

  it('getNextTier: free → select', () => {
    expect(getNextTier('free')).toBe('select');
  });

  it('getNextTier: select → summit', () => {
    expect(getNextTier('select')).toBe('summit');
  });

  it('getNextTier: summit → null', () => {
    expect(getNextTier('summit')).toBe(null);
  });
});

describe('Tier enrollment — getDefaultTier', () => {
  it('new users default to free', () => {
    expect(getDefaultTier()).toBe('free');
  });
});

describe('Tier priority — getTierPriority', () => {
  it('free is lowest priority (1)', () => {
    expect(getTierPriority('free')).toBe(1);
  });

  it('select is middle priority (2)', () => {
    expect(getTierPriority('select')).toBe(2);
  });

  it('summit is highest priority (3)', () => {
    expect(getTierPriority('summit')).toBe(3);
  });
});

describe('Tier assignment — feature-based access', () => {
  describe('FREE tier capabilities', () => {
    it('can receive intros', () => {
      expect(hasAccess('free', 'receiveIntros')).toBe(true);
    });

    it('cannot create rounds', () => {
      expect(hasAccess('free', 'createRounds')).toBe(false);
    });

    it('cannot send intros', () => {
      expect(hasAccess('free', 'sendIntros')).toBe(false);
    });

    it('limited search (20 results)', () => {
      expect(hasAccess('free', 'unlimitedSearch')).toBe(false);
    });

    it('cannot use hunt mode', () => {
      expect(hasAccess('free', 'huntMode')).toBe(false);
    });

    it('cannot see all summit members', () => {
      expect(hasAccess('free', 'seeAllSummits')).toBe(false);
    });

    it('CAN see all select members (canSeeAllSelects)', () => {
      expect(hasAccess('free', 'seeAllSelects')).toBe(true);
    });
  });

  describe('SELECT tier capabilities', () => {
    it('unlimited search', () => {
      expect(hasAccess('select', 'unlimitedSearch')).toBe(true);
    });

    it('can create rounds', () => {
      expect(hasAccess('select', 'createRounds')).toBe(true);
    });

    it('can send intros', () => {
      expect(hasAccess('select', 'sendIntros')).toBe(true);
    });

    it('can use hunt mode', () => {
      expect(hasAccess('select', 'huntMode')).toBe(true);
    });

    it('can see all summits', () => {
      expect(hasAccess('select', 'seeAllSummits')).toBe(true);
    });

    it('verified directory access', () => {
      expect(hasAccess('select', 'verifiedDirectory')).toBe(true);
    });

    it('basic analytics only (not advanced)', () => {
      expect(hasAccess('select', 'advancedAnalytics')).toBe(false);
    });

    it('select events access', () => {
      expect(hasAccess('select', 'eventAccess')).toBe(true);
    });

    it('cannot create exclusive events', () => {
      expect(hasAccess('select', 'createExclusiveEvents')).toBe(false);
    });
  });

  describe('SUMMIT tier capabilities', () => {
    it('all select capabilities plus more', () => {
      expect(hasAccess('summit', 'unlimitedSearch')).toBe(true);
      expect(hasAccess('summit', 'createRounds')).toBe(true);
      expect(hasAccess('summit', 'sendIntros')).toBe(true);
      expect(hasAccess('summit', 'verifiedDirectory')).toBe(true);
    });

    it('can hide from lower tiers', () => {
      expect(hasAccess('summit', 'hideFromLowerTiers')).toBe(true);
    });

    it('has search boost', () => {
      expect(hasAccess('summit', 'searchBoost')).toBe(true);
    });

    it('advanced analytics', () => {
      expect(hasAccess('summit', 'advancedAnalytics')).toBe(true);
    });

    it('all events access', () => {
      expect(hasAccess('summit', 'eventAccess')).toBe(true);
    });

    it('custom profile URL', () => {
      expect(hasAccess('summit', 'customProfileUrl')).toBe(true);
    });

    it('can create exclusive events', () => {
      expect(hasAccess('summit', 'createExclusiveEvents')).toBe(true);
    });
  });
});

describe('Tier visibility — canSeeTier', () => {
  it('free sees free members', () => {
    expect(canSeeTier('free', 'free')).toBe(true);
  });

  it('free can see select members', () => {
    expect(canSeeTier('free', 'select')).toBe(true);
  });

  it('select cannot see free (without hunt mode)', () => {
    expect(canSeeTier('select', 'free')).toBe(false);
  });

  it('select can see connected free members', () => {
    expect(canSeeTier('select', 'free', true)).toBe(true);
  });

  it('summit cannot see free', () => {
    expect(canSeeTier('summit', 'free')).toBe(false);
  });

  it('summit cannot see select', () => {
    expect(canSeeTier('summit', 'select')).toBe(false);
  });

  it('summit can see summit', () => {
    expect(canSeeTier('summit', 'summit')).toBe(true);
  });

  it('any tier can see its own members', () => {
    expect(canSeeTier('select', 'select')).toBe(true);
    expect(canSeeTier('summit', 'summit')).toBe(true);
  });
});

describe('Discovery visibility — getVisibleTiers', () => {
  it('free: only free visible', () => {
    expect(getVisibleTiers('free')).toEqual(['free']);
  });

  it('select: select + summit visible', () => {
    expect(getVisibleTiers('select')).toEqual(['select', 'summit']);
  });

  it('select with huntMode: includes free', () => {
    expect(getVisibleTiers('select', true)).toEqual(['select', 'summit', 'free']);
  });

  it('summit: only summit visible', () => {
    expect(getVisibleTiers('summit')).toEqual(['summit']);
  });
});

describe('TIER_SLUGS constant', () => {
  it('has correct slug values', () => {
    expect(TIER_SLUGS.FREE).toBe('free');
    expect(TIER_SLUGS.SELECT).toBe('select');
    expect(TIER_SLUGS.SUMMIT).toBe('summit');
  });
});
