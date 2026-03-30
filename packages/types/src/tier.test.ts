/**
 * Tier Tests — @spotter/types
 * Tests only the functions actually exported from packages/types/src/tier.ts
 */

import { describe, it, expect } from 'vitest';
import {
  TIER_SLUGS,
  hasAccess,
  canSeeTier,
  getVisibleTiers,
  isValidTier,
  isPaidTier,
  isTierUpgrade,
  isTierDowngrade,
  hasFeatureAccess,
  TIER_LIMITS,
  TIER_DEFINITIONS,
  FEATURE_NAMES,
  TIER_PRICES,
  type TierSlug,
  type FeatureKey,
} from '../src/tier.js';

describe('TIER_SLUGS', () => {
  it('has free, select, summit', () => {
    expect(TIER_SLUGS.FREE).toBe('free');
    expect(TIER_SLUGS.SELECT).toBe('select');
    expect(TIER_SLUGS.SUMMIT).toBe('summit');
  });
});

describe('hasAccess — free tier', () => {
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

  it('eventAccess: false', () => {
    expect(hasAccess('free', 'eventAccess')).toBe(false);
  });

  it('customProfileUrl: false', () => {
    expect(hasAccess('free', 'customProfileUrl')).toBe(false);
  });

  it('seeAllSelects: true', () => {
    expect(hasAccess('free', 'seeAllSelects')).toBe(true);
  });

  it('seeAllSummits: false', () => {
    expect(hasAccess('free', 'seeAllSummits')).toBe(false);
  });

  it('createExclusiveEvents: false', () => {
    expect(hasAccess('free', 'createExclusiveEvents')).toBe(false);
  });

  it('hideFromLowerTiers: false', () => {
    expect(hasAccess('free', 'hideFromLowerTiers')).toBe(false);
  });

  it('unknown feature: false', () => {
    expect(hasAccess('free', 'unknown' as FeatureKey)).toBe(false);
  });
});

describe('hasAccess — select tier', () => {
  it('unlimitedSearch: true', () => {
    expect(hasAccess('select', 'unlimitedSearch')).toBe(true);
  });

  it('createRounds: true', () => {
    expect(hasAccess('select', 'createRounds')).toBe(true);
  });

  it('sendIntros: true', () => {
    expect(hasAccess('select', 'sendIntros')).toBe(true);
  });

  it('receiveIntros: true', () => {
    expect(hasAccess('select', 'receiveIntros')).toBe(true);
  });

  it('huntMode: true', () => {
    expect(hasAccess('select', 'huntMode')).toBe(true);
  });

  it('hideFromLowerTiers: false', () => {
    expect(hasAccess('select', 'hideFromLowerTiers')).toBe(false);
  });

  it('seeAllSummits: true', () => {
    expect(hasAccess('select', 'seeAllSummits')).toBe(true);
  });

  it('seeAllSelects: true', () => {
    expect(hasAccess('select', 'seeAllSelects')).toBe(true);
  });

  it('verifiedDirectory: true', () => {
    expect(hasAccess('select', 'verifiedDirectory')).toBe(true);
  });

  it('searchBoost: false', () => {
    expect(hasAccess('select', 'searchBoost')).toBe(false);
  });

  it('advancedAnalytics: false (basic only)', () => {
    expect(hasAccess('select', 'advancedAnalytics')).toBe(false);
  });

  it('eventAccess: true', () => {
    expect(hasAccess('select', 'eventAccess')).toBe(true);
  });

  it('customProfileUrl: false', () => {
    expect(hasAccess('select', 'customProfileUrl')).toBe(false);
  });

  it('createExclusiveEvents: false', () => {
    expect(hasAccess('select', 'createExclusiveEvents')).toBe(false);
  });
});

describe('hasAccess — summit tier', () => {
  it('unlimitedSearch: true', () => {
    expect(hasAccess('summit', 'unlimitedSearch')).toBe(true);
  });

  it('unlimitedConnections: true', () => {
    expect(hasAccess('summit', 'unlimitedConnections')).toBe(true);
  });

  it('unlimitedRounds: true', () => {
    expect(hasAccess('summit', 'unlimitedRounds')).toBe(true);
  });

  it('createRounds: true', () => {
    expect(hasAccess('summit', 'createRounds')).toBe(true);
  });

  it('sendIntros: true', () => {
    expect(hasAccess('summit', 'sendIntros')).toBe(true);
  });

  it('receiveIntros: true', () => {
    expect(hasAccess('summit', 'receiveIntros')).toBe(true);
  });

  it('huntMode: true', () => {
    expect(hasAccess('summit', 'huntMode')).toBe(true);
  });

  it('hideFromLowerTiers: true', () => {
    expect(hasAccess('summit', 'hideFromLowerTiers')).toBe(true);
  });

  it('seeAllSummits: true', () => {
    expect(hasAccess('summit', 'seeAllSummits')).toBe(true);
  });

  it('seeAllSelects: true', () => {
    expect(hasAccess('summit', 'seeAllSelects')).toBe(true);
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

describe('canSeeTier', () => {
  describe('free viewer', () => {
    it('sees free', () => {
      expect(canSeeTier('free', 'free')).toBe(true);
    });

    it('sees select', () => {
      expect(canSeeTier('free', 'select')).toBe(true);
    });

    it('sees summit', () => {
      expect(canSeeTier('free', 'summit')).toBe(true);
    });

    it('sees any tier if connected', () => {
      expect(canSeeTier('free', 'summit', true)).toBe(true);
    });
  });

  describe('select viewer', () => {
    it('does NOT see free', () => {
      expect(canSeeTier('select', 'free')).toBe(false);
    });

    it('sees select', () => {
      expect(canSeeTier('select', 'select')).toBe(true);
    });

    it('sees summit', () => {
      expect(canSeeTier('select', 'summit')).toBe(true);
    });

    it('sees free if connected', () => {
      expect(canSeeTier('select', 'free', true)).toBe(true);
    });
  });

  describe('summit viewer', () => {
    it('does NOT see free', () => {
      expect(canSeeTier('summit', 'free')).toBe(false);
    });

    it('does NOT see select', () => {
      expect(canSeeTier('summit', 'select')).toBe(false);
    });

    it('sees summit', () => {
      expect(canSeeTier('summit', 'summit')).toBe(true);
    });

    it('sees any tier if connected', () => {
      expect(canSeeTier('summit', 'free', true)).toBe(true);
      expect(canSeeTier('summit', 'select', true)).toBe(true);
    });
  });
});

describe('getVisibleTiers', () => {
  it('free: only free', () => {
    expect(getVisibleTiers('free')).toEqual(['free']);
  });

  it('free ignores huntMode', () => {
    expect(getVisibleTiers('free', true)).toEqual(['free']);
  });

  it('select: select + summit', () => {
    expect(getVisibleTiers('select')).toEqual(['select', 'summit']);
  });

  it('select with huntMode: includes free', () => {
    expect(getVisibleTiers('select', true)).toEqual(['select', 'summit', 'free']);
  });

  it('summit: only summit', () => {
    expect(getVisibleTiers('summit')).toEqual(['summit']);
  });

  it('summit ignores huntMode', () => {
    expect(getVisibleTiers('summit', true)).toEqual(['summit']);
  });
});

describe('isValidTier', () => {
  it('accepts valid slugs', () => {
    expect(isValidTier('free')).toBe(true);
    expect(isValidTier('select')).toBe(true);
    expect(isValidTier('summit')).toBe(true);
  });

  it('rejects invalid slugs', () => {
    expect(isValidTier('pro')).toBe(false);
    expect(isValidTier('basic')).toBe(false);
    expect(isValidTier('')).toBe(false);
    expect(isValidTier('FREE')).toBe(false);
    expect(isValidTier('trial')).toBe(false);
  });
});

describe('isPaidTier', () => {
  it('free is not paid', () => {
    expect(isPaidTier('free')).toBe(false);
  });

  it('select is paid', () => {
    expect(isPaidTier('select')).toBe(true);
  });

  it('summit is paid', () => {
    expect(isPaidTier('summit')).toBe(true);
  });
});

describe('isTierUpgrade', () => {
  it('free → select is upgrade', () => {
    expect(isTierUpgrade('free', 'select')).toBe(true);
  });

  it('free → summit is upgrade', () => {
    expect(isTierUpgrade('free', 'summit')).toBe(true);
  });

  it('select → summit is upgrade', () => {
    expect(isTierUpgrade('select', 'summit')).toBe(true);
  });

  it('same tier is NOT upgrade', () => {
    expect(isTierUpgrade('free', 'free')).toBe(false);
    expect(isTierUpgrade('select', 'select')).toBe(false);
    expect(isTierUpgrade('summit', 'summit')).toBe(false);
  });

  it('downgrade is NOT upgrade', () => {
    expect(isTierUpgrade('select', 'free')).toBe(false);
    expect(isTierUpgrade('summit', 'select')).toBe(false);
  });
});

describe('isTierDowngrade', () => {
  it('select → free is downgrade', () => {
    expect(isTierDowngrade('select', 'free')).toBe(true);
  });

  it('summit → select is downgrade', () => {
    expect(isTierDowngrade('summit', 'select')).toBe(true);
  });

  it('summit → free is downgrade', () => {
    expect(isTierDowngrade('summit', 'free')).toBe(true);
  });

  it('same tier is NOT downgrade', () => {
    expect(isTierDowngrade('free', 'free')).toBe(false);
    expect(isTierDowngrade('select', 'select')).toBe(false);
  });

  it('upgrade is NOT downgrade', () => {
    expect(isTierDowngrade('free', 'select')).toBe(false);
    expect(isTierDowngrade('select', 'summit')).toBe(false);
  });
});

describe('TIER_LIMITS constants', () => {
  it('free: limited search', () => {
    expect(TIER_LIMITS.free.maxSearchResults).toBe(20);
  });

  it('select: unlimited search', () => {
    expect(TIER_LIMITS.select.maxSearchResults).toBeNull();
  });

  it('summit: unlimited search', () => {
    expect(TIER_LIMITS.summit.maxSearchResults).toBeNull();
  });

  it('free: cannot create rounds', () => {
    expect(TIER_LIMITS.free.canCreateRounds).toBe(false);
  });

  it('select: can create rounds', () => {
    expect(TIER_LIMITS.select.canCreateRounds).toBe(true);
  });

  it('summit: can create rounds', () => {
    expect(TIER_LIMITS.summit.canCreateRounds).toBe(true);
  });

  it('free: max 0 rounds/month', () => {
    expect(TIER_LIMITS.free.maxRoundsPerMonth).toBe(0);
  });

  it('select: 4 rounds/month', () => {
    expect(TIER_LIMITS.select.maxRoundsPerMonth).toBe(4);
  });

  it('summit: unlimited rounds', () => {
    expect(TIER_LIMITS.summit.maxRoundsPerMonth).toBeNull();
  });

  it('free: hunt mode off', () => {
    expect(TIER_LIMITS.free.flags.canUseHuntMode).toBe(false);
  });

  it('select: hunt mode available', () => {
    expect(TIER_LIMITS.select.flags.canUseHuntMode).toBe(true);
  });

  it('summit: hunt mode available', () => {
    expect(TIER_LIMITS.summit.flags.canUseHuntMode).toBe(true);
  });

  it('summit: can hide from lower tiers', () => {
    expect(TIER_LIMITS.summit.flags.canHideFromLowerTiers).toBe(true);
  });

  it('select: cannot hide from lower tiers', () => {
    expect(TIER_LIMITS.select.flags.canHideFromLowerTiers).toBe(false);
  });
});

describe('TIER_PRICES', () => {
  it('free: $0', () => {
    expect(TIER_PRICES.free.yearly).toBe(0);
  });

  it('select: $1,000/year', () => {
    expect(TIER_PRICES.select.yearly).toBe(100000); // cents
    expect(TIER_PRICES.select.billingInterval).toBe('annual');
  });

  it('summit: $10,000/year (lifetime)', () => {
    expect(TIER_PRICES.summit.yearly).toBe(1000000); // cents
    expect(TIER_PRICES.summit.billingInterval).toBe('lifetime');
  });
});

describe('FEATURE_NAMES', () => {
  it('contains expected feature keys', () => {
    expect(FEATURE_NAMES).toContain('matchmaking');
    expect(FEATURE_NAMES).toContain('advancedAnalytics');
    expect(FEATURE_NAMES).toContain('coachMessaging');
    expect(FEATURE_NAMES).toContain('boostedVisibility');
  });
});
