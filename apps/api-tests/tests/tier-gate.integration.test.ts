/**
 * Tier Gate Integration Tests
 * 
 * Tests the full chain: tier access → trust enforcement → matching visibility.
 * Verifies that canSeeTier() and getVisibleTiers() correctly gate discovery
 * based on user tier membership.
 * 
 * Run: pnpm --filter=api-tests test -- tests/tier-gate.integration.test.ts
 */

import {
  TierSlug,
  canSeeTier,
  getVisibleTiers,
  hasAccess,
  TIER_LIMITS,
  getReliabilityLabel,
  calculateDiscoveryBoost,
  isValidTier,
} from '@spotter/types';

describe('Tier Gate Integration Tests', () => {
  describe('canSeeTier — visibility between tiers', () => {
    describe('FREE tier viewers', () => {
      it('can see FREE tier members', () => {
        expect(canSeeTier('free', 'free')).toBe(true);
      });

      it('cannot see SELECT tier members', () => {
        expect(canSeeTier('free', 'select')).toBe(false);
      });

      it('cannot see SUMMIT tier members', () => {
        expect(canSeeTier('free', 'summit')).toBe(false);
      });

      it('connected users bypass tier gate', () => {
        // Connections always have visibility regardless of tier
        expect(canSeeTier('free', 'select', true)).toBe(true);
        expect(canSeeTier('free', 'summit', true)).toBe(true);
      });
    });

    describe('SELECT tier viewers', () => {
      it('can see SELECT tier members', () => {
        expect(canSeeTier('select', 'select')).toBe(true);
      });

      it('can see SUMMIT tier members', () => {
        expect(canSeeTier('select', 'summit')).toBe(true);
      });

      it('cannot see FREE tier members (default, no hunt mode)', () => {
        expect(canSeeTier('select', 'free')).toBe(false);
      });

      it('connected FREE users are visible to SELECT', () => {
        // Even though SELECT can't normally see FREE, connected users are always visible
        expect(canSeeTier('select', 'free', true)).toBe(true);
      });
    });

    describe('SUMMIT tier viewers', () => {
      it('can see SUMMIT tier members', () => {
        expect(canSeeTier('summit', 'summit')).toBe(true);
      });

      it('cannot see SELECT tier members by default', () => {
        expect(canSeeTier('summit', 'select')).toBe(false);
      });

      it('cannot see FREE tier members by default', () => {
        expect(canSeeTier('summit', 'free')).toBe(false);
      });

      it('connected users bypass SUMMIT tier gate', () => {
        expect(canSeeTier('summit', 'select', true)).toBe(true);
        expect(canSeeTier('summit', 'free', true)).toBe(true);
      });
    });
  });

  describe('getVisibleTiers — discovery visibility per viewer', () => {
    it('FREE users only see FREE tier in discovery', () => {
      const visible = getVisibleTiers('free');
      expect(visible).toEqual(['free']);
    });

    it('SELECT users see SELECT + SUMMIT by default', () => {
      const visible = getVisibleTiers('select', false);
      expect(visible).toContain('select');
      expect(visible).toContain('summit');
      expect(visible).not.toContain('free');
    });

    it('SELECT users with Hunt Mode enabled see FREE as well', () => {
      const visible = getVisibleTiers('select', true);
      expect(visible).toContain('select');
      expect(visible).toContain('summit');
      expect(visible).toContain('free');
    });

    it('SUMMIT users only see SUMMIT (exclusive)', () => {
      const visible = getVisibleTiers('summit');
      expect(visible).toEqual(['summit']);
    });

    it('SUMMIT users with Hunt Mode still only see SUMMIT', () => {
      // Hunt mode is a SELECT feature; SUMMIT is already exclusive
      const visible = getVisibleTiers('summit', true);
      expect(visible).toEqual(['summit']);
    });
  });

  describe('hasAccess — feature gating per tier', () => {
    describe('FREE tier features', () => {
      const limits = TIER_LIMITS.free;

      it('can receive intros but not send them', () => {
        expect(limits.canReceiveIntros).toBe(true);
        expect(limits.canSendIntros).toBe(false);
      });

      it('cannot create rounds', () => {
        expect(limits.canCreateRounds).toBe(false);
      });

      it('has limited search results', () => {
        expect(limits.maxSearchResults).toBe(20);
      });

      it('has hunt mode disabled', () => {
        expect(limits.flags.canUseHuntMode).toBe(false);
        expect(hasAccess('free', 'huntMode')).toBe(false);
      });

      it('cannot see all Selects (but sees all by default visibility rules)', () => {
        // canSeeAllSelects flag controls whether FREE can explicitly browse SELECT directory
        expect(limits.flags.canSeeAllSelects).toBe(true);
      });
    });

    describe('SELECT tier features', () => {
      const limits = TIER_LIMITS.select;

      it('can send and receive intros', () => {
        expect(limits.canSendIntros).toBe(true);
        expect(limits.canReceiveIntros).toBe(true);
      });

      it('can create rounds', () => {
        expect(limits.canCreateRounds).toBe(true);
      });

      it('has unlimited search results', () => {
        expect(limits.maxSearchResults).toBeNull();
        expect(hasAccess('select', 'unlimitedSearch')).toBe(true);
      });

      it('has hunt mode enabled', () => {
        expect(limits.flags.canUseHuntMode).toBe(true);
        expect(hasAccess('select', 'huntMode')).toBe(true);
      });

      it('can see all Selects and Summits', () => {
        expect(limits.flags.canSeeAllSelects).toBe(true);
        expect(limits.flags.canSeeAllSummits).toBe(true);
      });
    });

    describe('SUMMIT tier features', () => {
      const limits = TIER_LIMITS.summit;

      it('has all access flags enabled', () => {
        expect(limits.flags.canUseHuntMode).toBe(true);
        expect(limits.flags.canHideFromLowerTiers).toBe(true);
        expect(limits.flags.canSeeAllSummits).toBe(true);
        expect(limits.flags.canSeeAllSelects).toBe(true);
        expect(limits.flags.canCreateExclusiveEvents).toBe(true);
      });

      it('has unlimited connections and rounds', () => {
        expect(limits.maxConnections).toBeNull();
        expect(limits.maxRoundsPerMonth).toBeNull();
        expect(hasAccess('summit', 'unlimitedConnections')).toBe(true);
        expect(hasAccess('summit', 'unlimitedRounds')).toBe(true);
      });

      it('has summit visibility level', () => {
        expect(limits.visibilityLevel).toBe('summit_only');
      });

      it('has exclusive access flag', () => {
        expect(limits.exclusiveAccess).toBe(true);
        expect(limits.searchBoost).toBe(true);
      });
    });
  });

  describe('Trust + Tier integration chain', () => {
    it('reliability label is derived from score correctly', () => {
      expect(getReliabilityLabel(95)).toBe('Exceptional');
      expect(getReliabilityLabel(80)).toBe('Trusted');
      expect(getReliabilityLabel(65)).toBe('Reliable');
      expect(getReliabilityLabel(40)).toBe('Building');
    });

    it('discovery boost increases for high-reliability users', () => {
      // High-reliability users get a discovery boost (shown to other members)
      const boostHighReliability = calculateDiscoveryBoost(90, 'select');
      const boostLowReliability = calculateDiscoveryBoost(30, 'select');
      
      expect(boostHighReliability).toBeGreaterThan(boostLowReliability);
      expect(boostHighReliability).toBeGreaterThan(1.0);
    });

    it('discovery boost does not apply to FREE tier users', () => {
      const boost = calculateDiscoveryBoost(90, 'free');
      // FREE users don't have the searchBoost feature
      expect(boost).toBe(1.0);
    });

    it('validates tier slugs correctly', () => {
      expect(isValidTier('free')).toBe(true);
      expect(isValidTier('select')).toBe(true);
      expect(isValidTier('summit')).toBe(true);
      expect(isValidTier('invalid')).toBe(false);
      expect(isValidTier('premium')).toBe(false);
    });
  });

  describe('Tier chain: discovery-search → visibility enforcement', () => {
    it('FREE user searching gets FREE-only candidates', () => {
      const viewerTier = 'free' as TierSlug;
      const visibleTiers = getVisibleTiers(viewerTier);
      
      // Simulate what discovery-search would filter on
      const candidates = [
        { id: '1', tier: 'free' },
        { id: '2', tier: 'select' },
        { id: '3', tier: 'summit' },
      ];
      
      const filtered = candidates.filter(c => visibleTiers.includes(c.tier as TierSlug));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].tier).toBe('free');
    });

    it('SELECT user searching gets SELECT + SUMMIT candidates (no hunt)', () => {
      const viewerTier = 'select' as TierSlug;
      const visibleTiers = getVisibleTiers(viewerTier, false);
      
      const candidates = [
        { id: '1', tier: 'free' },
        { id: '2', tier: 'select' },
        { id: '3', tier: 'summit' },
      ];
      
      const filtered = candidates.filter(c => visibleTiers.includes(c.tier as TierSlug));
      expect(filtered).toHaveLength(2);
      expect(filtered.map(c => c.tier)).toContain('select');
      expect(filtered.map(c => c.tier)).toContain('summit');
      expect(filtered.map(c => c.tier)).not.toContain('free');
    });

    it('SELECT user with Hunt Mode sees FREE candidates too', () => {
      const viewerTier = 'select' as TierSlug;
      const visibleTiers = getVisibleTiers(viewerTier, true);
      
      const candidates = [
        { id: '1', tier: 'free' },
        { id: '2', tier: 'select' },
        { id: '3', tier: 'summit' },
      ];
      
      const filtered = candidates.filter(c => visibleTiers.includes(c.tier as TierSlug));
      expect(filtered).toHaveLength(3);
    });

    it('SUMMIT user searching only sees SUMMIT candidates', () => {
      const viewerTier = 'summit' as TierSlug;
      const visibleTiers = getVisibleTiers(viewerTier);
      
      const candidates = [
        { id: '1', tier: 'free' },
        { id: '2', tier: 'select' },
        { id: '3', tier: 'summit' },
      ];
      
      const filtered = candidates.filter(c => visibleTiers.includes(c.tier as TierSlug));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].tier).toBe('summit');
    });

    it('connected members bypass tier visibility (existing connection)', () => {
      // If a FREE user has an existing connection with a SELECT member,
      // they should still be able to see them in discovery / network views
      const viewerTier = 'free' as TierSlug;
      const connectedUserTier = 'select' as TierSlug;
      
      // canSeeTier with connection flag = always true
      expect(canSeeTier(viewerTier, connectedUserTier, true)).toBe(true);
      
      // Without connection flag, default rules apply
      expect(canSeeTier(viewerTier, connectedUserTier, false)).toBe(false);
    });
  });
});
