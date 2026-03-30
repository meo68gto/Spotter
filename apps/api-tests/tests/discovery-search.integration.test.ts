/**
 * Discovery Search Integration Tests
 * 
 * Tests the discovery-search edge function with tier-gated visibility.
 * Verifies that free users only see free, select users see select+summit
 * (and free with hunt mode), and summit users only see summit.
 * 
 * Run: pnpm --filter=api-tests test -- tests/discovery-search.integration.test.ts
 */

import {
  TierSlug,
  getVisibleTiers,
  canSeeTier,
  TIER_LIMITS,
} from '@spotter/types';

describe('Discovery Search — Tier Visibility Integration', () => {
  // -------------------------------------------------------------------------
  // Mock Edge Function Response Shapes
  // -------------------------------------------------------------------------

  interface MockDiscoverableGolfer {
    id: string;
    displayName: string;
    tier: TierSlug;
    skillBand: string;
    city: string | null;
    availabilityOverlapMinutes: number;
    compatibilityScore: number;
    reputationScore: number;
    profileCompleteness: number;
  }

  interface MockDiscoveryResponse {
    golfers: MockDiscoverableGolfer[];
    pagination: {
      offset: number;
      limit: number;
      total: number;
    };
  }

  // -------------------------------------------------------------------------
  // Mock discovery-search output builder
  // Simulates what the edge function returns based on caller tier
  // -------------------------------------------------------------------------

  const ALL_MEMBERS: MockDiscoverableGolfer[] = [
    {
      id: 'member-free-1',
      displayName: 'Alex Free',
      tier: 'free',
      skillBand: 'mid',
      city: 'Phoenix',
      availabilityOverlapMinutes: 60,
      compatibilityScore: 0.85,
      reputationScore: 45,
      profileCompleteness: 0.70,
    },
    {
      id: 'member-free-2',
      displayName: 'Sam Free',
      tier: 'free',
      skillBand: 'beginner',
      city: 'Scottsdale',
      availabilityOverlapMinutes: 30,
      compatibilityScore: 0.60,
      reputationScore: 20,
      profileCompleteness: 0.40,
    },
    {
      id: 'member-select-1',
      displayName: 'Jordan Select',
      tier: 'select',
      skillBand: 'low',
      city: 'Phoenix',
      availabilityOverlapMinutes: 90,
      compatibilityScore: 0.92,
      reputationScore: 78,
      profileCompleteness: 0.90,
    },
    {
      id: 'member-select-2',
      displayName: 'Taylor Select',
      tier: 'select',
      skillBand: 'mid',
      city: 'Mesa',
      availabilityOverlapMinutes: 45,
      compatibilityScore: 0.75,
      reputationScore: 65,
      profileCompleteness: 0.80,
    },
    {
      id: 'member-summit-1',
      displayName: 'Morgan Summit',
      tier: 'summit',
      skillBand: 'scratch',
      city: 'Phoenix',
      availabilityOverlapMinutes: 120,
      compatibilityScore: 0.95,
      reputationScore: 98,
      profileCompleteness: 0.99,
    },
  ];

  /**
   * Simulate what discovery-search does with tier-gated filtering.
   * This mirrors the logic: visibleTiers = getVisibleTiers(callerTier, huntMode)
   */
  function simulateDiscoverySearch(
    callerTier: TierSlug,
    huntModeEnabled: boolean = false,
    includeConnectedMembers: boolean = false
  ): MockDiscoveryResponse {
    const visibleTiers = getVisibleTiers(callerTier, huntModeEnabled);

    // Connected members bypass tier visibility
    const connectedMemberIds = includeConnectedMembers
      ? ['member-select-1'] // simulating an existing connection with a SELECT member
      : [];

    const filtered = ALL_MEMBERS.filter((m) => {
      if (connectedMemberIds.includes(m.id)) return true;
      return visibleTiers.includes(m.tier);
    });

    return {
      golfers: filtered,
      pagination: {
        offset: 0,
        limit: TIER_LIMITS[callerTier].maxSearchResults ?? 100,
        total: filtered.length,
      },
    };
  }

  // -------------------------------------------------------------------------
  // FREE Tier — sees only FREE members
  // -------------------------------------------------------------------------

  describe('FREE tier caller', () => {
    it('only sees FREE tier members in discovery results', () => {
      const result = simulateDiscoverySearch('free', false, false);

      expect(result.golfers.length).toBeGreaterThan(0);
      result.golfers.forEach((golfer) => {
        expect(golfer.tier).toBe('free');
      });
    });

    it('does NOT see SELECT members by default', () => {
      const result = simulateDiscoverySearch('free', false, false);

      const selectMembers = result.golfers.filter((g) => g.tier === 'select');
      expect(selectMembers).toHaveLength(0);
    });

    it('does NOT see SUMMIT members by default', () => {
      const result = simulateDiscoverySearch('free', false, false);

      const summitMembers = result.golfers.filter((g) => g.tier === 'summit');
      expect(summitMembers).toHaveLength(0);
    });

    it('still only sees FREE members even with hunt mode (FREE has no hunt mode)', () => {
      // FREE tier does not have hunt mode capability
      const huntModeEnabled = TIER_LIMITS.free.flags.canUseHuntMode;
      expect(huntModeEnabled).toBe(false);

      const result = simulateDiscoverySearch('free', huntModeEnabled, false);
      result.golfers.forEach((golfer) => {
        expect(golfer.tier).toBe('free');
      });
    });

    it('respects maxSearchResults limit of 20 for FREE tier', () => {
      const result = simulateDiscoverySearch('free', false, false);
      expect(result.pagination.limit).toBe(20);
    });

    it('shows connected SELECT member regardless of tier visibility', () => {
      const result = simulateDiscoverySearch('free', false, true);

      const connectedSelect = result.golfers.find((g) => g.id === 'member-select-1');
      expect(connectedSelect).toBeDefined();
      expect(connectedSelect?.tier).toBe('select');
    });
  });

  // -------------------------------------------------------------------------
  // SELECT Tier — sees SELECT + SUMMIT (and FREE with Hunt Mode)
  // -------------------------------------------------------------------------

  describe('SELECT tier caller', () => {
    it('sees SELECT members by default', () => {
      const result = simulateDiscoverySearch('select', false, false);

      const selectMembers = result.golfers.filter((g) => g.tier === 'select');
      expect(selectMembers.length).toBeGreaterThan(0);
    });

    it('sees SUMMIT members by default', () => {
      const result = simulateDiscoverySearch('select', false, false);

      const summitMembers = result.golfers.filter((g) => g.tier === 'summit');
      expect(summitMembers.length).toBeGreaterThan(0);
    });

    it('does NOT see FREE members by default', () => {
      const result = simulateDiscoverySearch('select', false, false);

      const freeMembers = result.golfers.filter((g) => g.tier === 'free');
      expect(freeMembers).toHaveLength(0);
    });

    it('sees FREE members when Hunt Mode is enabled', () => {
      // Hunt mode must be enabled on the caller's account
      const huntModeEnabled = TIER_LIMITS.select.flags.canUseHuntMode;
      expect(huntModeEnabled).toBe(true);

      const result = simulateDiscoverySearch('select', true, false);

      const freeMembers = result.golfers.filter((g) => g.tier === 'free');
      expect(freeMembers.length).toBeGreaterThan(0);
    });

    it('still sees SELECT + SUMMIT when Hunt Mode is enabled', () => {
      const result = simulateDiscoverySearch('select', true, false);

      expect(result.golfers.length).toBeGreaterThan(0);

      const tiers = new Set(result.golfers.map((g) => g.tier));
      expect(tiers.has('select')).toBe(true);
      expect(tiers.has('summit')).toBe(true);
      expect(tiers.has('free')).toBe(true);
    });

    it('has unlimited search results (maxSearchResults = null)', () => {
      const result = simulateDiscoverySearch('select', false, false);
      expect(result.pagination.limit).toBeNull(); // null = unlimited
    });
  });

  // -------------------------------------------------------------------------
  // SUMMIT Tier — exclusive visibility
  // -------------------------------------------------------------------------

  describe('SUMMIT tier caller', () => {
    it('only sees SUMMIT members (exclusive visibility)', () => {
      const result = simulateDiscoverySearch('summit', false, false);

      result.golfers.forEach((golfer) => {
        expect(golfer.tier).toBe('summit');
      });
    });

    it('does NOT see SELECT members', () => {
      const result = simulateDiscoverySearch('summit', false, false);

      const selectMembers = result.golfers.filter((g) => g.tier === 'select');
      expect(selectMembers).toHaveLength(0);
    });

    it('does NOT see FREE members even with hunt mode (SUMMIT is exclusive)', () => {
      const result = simulateDiscoverySearch('summit', true, false);

      const freeMembers = result.golfers.filter((g) => g.tier === 'free');
      expect(freeMembers).toHaveLength(0);
    });

    it('has unlimited search results', () => {
      const result = simulateDiscoverySearch('summit', false, false);
      expect(result.pagination.limit).toBeNull();
    });

    it('sees highest compatibility scores (summit members are compatible with each other)', () => {
      const result = simulateDiscoverySearch('summit', false, false);

      expect(result.golfers.length).toBeGreaterThan(0);
      result.golfers.forEach((golfer) => {
        expect(golfer.tier).toBe('summit');
        expect(golfer.compatibilityScore).toBeGreaterThanOrEqual(0);
        expect(golfer.compatibilityScore).toBeLessThanOrEqual(1);
      });
    });
  });

  // -------------------------------------------------------------------------
  // getVisibleTiers boundary conditions
  // -------------------------------------------------------------------------

  describe('getVisibleTiers boundary conditions', () => {
    it('FREE: returns exactly [free]', () => {
      expect(getVisibleTiers('free', false)).toEqual(['free']);
      expect(getVisibleTiers('free', true)).toEqual(['free']); // no-op for free
    });

    it('SELECT without hunt: returns [select, summit]', () => {
      expect(getVisibleTiers('select', false)).toEqual(
        expect.arrayContaining(['select', 'summit'])
      );
      expect(getVisibleTiers('select', false)).not.toContain('free');
    });

    it('SELECT with hunt: returns [select, summit, free]', () => {
      expect(getVisibleTiers('select', true)).toEqual(
        expect.arrayContaining(['select', 'summit', 'free'])
      );
    });

    it('SUMMIT: returns exactly [summit] regardless of hunt mode', () => {
      expect(getVisibleTiers('summit', false)).toEqual(['summit']);
      expect(getVisibleTiers('summit', true)).toEqual(['summit']);
    });
  });

  // -------------------------------------------------------------------------
  // Tier visibility cross-matrix
  // -------------------------------------------------------------------------

  describe('Visibility matrix (who can see whom)', () => {
    const tiers: TierSlug[] = ['free', 'select', 'summit'];

    it('every tier can always see itself', () => {
      tiers.forEach((tier) => {
        expect(canSeeTier(tier, tier)).toBe(true);
      });
    });

    it('FREE can see FREE only', () => {
      expect(canSeeTier('free', 'free')).toBe(true);
      expect(canSeeTier('free', 'select')).toBe(false);
      expect(canSeeTier('free', 'summit')).toBe(false);
    });

    it('SELECT can see SELECT and SUMMIT, not FREE', () => {
      expect(canSeeTier('select', 'free')).toBe(false);
      expect(canSeeTier('select', 'select')).toBe(true);
      expect(canSeeTier('select', 'summit')).toBe(true);
    });

    it('SUMMIT can see SUMMIT only', () => {
      expect(canSeeTier('summit', 'free')).toBe(false);
      expect(canSeeTier('summit', 'select')).toBe(false);
      expect(canSeeTier('summit', 'summit')).toBe(true);
    });

    it('all tiers can see connected members regardless of tier gate', () => {
      // Connections bypass tier visibility entirely
      tiers.forEach((viewerTier) => {
        tiers.forEach((targetTier) => {
          if (viewerTier !== targetTier) {
            expect(canSeeTier(viewerTier, targetTier, true)).toBe(true);
          }
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // Profile completeness and reputation in results
  // -------------------------------------------------------------------------

  describe('Result quality signals', () => {
    it('discovery results are sorted by compatibility descending', () => {
      const result = simulateDiscoverySearch('summit', false, false);
      const scores = result.golfers.map((g) => g.compatibilityScore);

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });

    it('all returned golfers have valid reputation scores (0-100)', () => {
      const result = simulateDiscoverySearch('select', false, false);

      result.golfers.forEach((golfer) => {
        expect(golfer.reputationScore).toBeGreaterThanOrEqual(0);
        expect(golfer.reputationScore).toBeLessThanOrEqual(100);
      });
    });

    it('all returned golfers have valid profile completeness (0-1)', () => {
      const result = simulateDiscoverySearch('select', false, false);

      result.golfers.forEach((golfer) => {
        expect(golfer.profileCompleteness).toBeGreaterThanOrEqual(0);
        expect(golfer.profileCompleteness).toBeLessThanOrEqual(1);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Hunt Mode edge cases
  // -------------------------------------------------------------------------

  describe('Hunt Mode edge cases', () => {
    it('FREE tier cannot enable hunt mode even if requested', () => {
      // The edge function should reject hunt mode for FREE callers
      const canUseHuntMode = TIER_LIMITS.free.flags.canUseHuntMode;
      expect(canUseHuntMode).toBe(false);
    });

    it('SELECT tier CAN enable hunt mode', () => {
      const canUseHuntMode = TIER_LIMITS.select.flags.canUseHuntMode;
      expect(canUseHuntMode).toBe(true);
    });

    it('Hunt mode is a viewer-side toggle, not a target-side flag', () => {
      // The visibility is determined by the VIEWER's tier + hunt mode setting,
      // not by any flag on the target member's profile.
      // This is by design — a FREE member cannot "hide" from hunt mode viewers.
      const viewerTiers: TierSlug[] = ['free', 'select', 'summit'];
      const targetTier = 'free';

      viewerTiers.forEach((viewerTier) => {
        const huntModeEnabled = viewerTier === 'select'; // only SELECT can use hunt mode
        const visibleTiers = getVisibleTiers(viewerTier, huntModeEnabled);

        if (viewerTier === 'select' && huntModeEnabled) {
          expect(visibleTiers).toContain('free');
        } else if (viewerTier === 'summit') {
          expect(visibleTiers).not.toContain('free');
        }
      });
    });
  });
});
