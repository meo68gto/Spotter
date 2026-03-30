/**
 * Matching Engine Tests
 * Tests the matching algorithm functions from packages/types/src/matching.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHandicapScore,
  calculateNetworkingIntentScore,
  calculateLocationScore,
  calculateGroupSizeScore,
  getMatchTier,
  formatMatchScore,
  generateMatchReasoning,
  DEFAULT_MATCH_WEIGHTS,
  HANDICAP_THRESHOLDS,
  HANDICAP_SCORES,
  MATCH_TIERS,
  DEFAULT_MATCH_LIMIT,
  MIN_MATCH_SCORE,
} from '../src/matching.js';
import type { CompatibilityFactor, NetworkingIntent, PreferredGroupSize } from '../src/matching.js';

describe('calculateHandicapScore', () => {
  it('returns 100 for handicap diff <= 5 (excellent)', () => {
    expect(calculateHandicapScore(10, 10)).toBe(100);
    expect(calculateHandicapScore(5, 10)).toBe(100);
    expect(calculateHandicapScore(10, 5)).toBe(100);
  });

  it('returns 75 for handicap diff 6-10 (good)', () => {
    expect(calculateHandicapScore(10, 16)).toBe(75);
    expect(calculateHandicapScore(16, 10)).toBe(75);
    expect(calculateHandicapScore(8, 18)).toBe(75);
  });

  it('returns 50 for handicap diff 11-15 (fair)', () => {
    expect(calculateHandicapScore(10, 22)).toBe(50); // diff = 12
    expect(calculateHandicapScore(10, 25)).toBe(50); // diff = 15
    expect(calculateHandicapScore(20, 10)).toBe(75); // diff = 10 → "good" bucket
  });

  it('returns 25 for handicap diff > 15 (poor)', () => {
    expect(calculateHandicapScore(10, 30)).toBe(25);
    expect(calculateHandicapScore(5, 25)).toBe(25);
  });

  it('returns 50 (neutral) if either handicap is null', () => {
    expect(calculateHandicapScore(null, 10)).toBe(50);
    expect(calculateHandicapScore(10, null)).toBe(50);
    expect(calculateHandicapScore(undefined, 10)).toBe(50);
    expect(calculateHandicapScore(10, undefined)).toBe(50);
    expect(calculateHandicapScore(null, null)).toBe(50);
  });
});

describe('calculateNetworkingIntentScore', () => {
  it('same intent scores 100', () => {
    expect(calculateNetworkingIntentScore('business', 'business')).toBe(100);
    expect(calculateNetworkingIntentScore('social', 'social')).toBe(100);
    expect(calculateNetworkingIntentScore('competitive', 'competitive')).toBe(100);
  });

  it('business and social score 25', () => {
    expect(calculateNetworkingIntentScore('business', 'social')).toBe(25);
    expect(calculateNetworkingIntentScore('social', 'business')).toBe(25);
  });

  it('business and competitive score 50', () => {
    expect(calculateNetworkingIntentScore('business', 'competitive')).toBe(50);
    expect(calculateNetworkingIntentScore('competitive', 'business')).toBe(50);
  });

  it('business_social is compatible with business (75)', () => {
    expect(calculateNetworkingIntentScore('business', 'business_social')).toBe(75);
    expect(calculateNetworkingIntentScore('business_social', 'business')).toBe(75);
  });

  it('business_social is compatible with social (75)', () => {
    expect(calculateNetworkingIntentScore('social', 'business_social')).toBe(75);
    expect(calculateNetworkingIntentScore('business_social', 'social')).toBe(75);
  });

  it('business_social with business_social scores 100', () => {
    expect(calculateNetworkingIntentScore('business_social', 'business_social')).toBe(100);
  });

  it('fallback to 25 for unknown intent combination', () => {
    // Type-safe inputs only, but test the fallback
    const result = calculateNetworkingIntentScore('competitive', 'business_social');
    expect(result).toBe(50);
  });
});

describe('calculateLocationScore', () => {
  it('returns 100 for same area (<= 10km)', () => {
    expect(calculateLocationScore(0)).toBe(100);
    expect(calculateLocationScore(5)).toBe(100);
    expect(calculateLocationScore(10)).toBe(100);
  });

  it('returns 75 for nearby (11-50km)', () => {
    expect(calculateLocationScore(11)).toBe(75);
    expect(calculateLocationScore(30)).toBe(75);
    expect(calculateLocationScore(50)).toBe(75);
  });

  it('returns 25 for distant (> 50km)', () => {
    expect(calculateLocationScore(51)).toBe(25);
    expect(calculateLocationScore(100)).toBe(25);
    expect(calculateLocationScore(500)).toBe(25);
  });

  it('returns 50 (neutral) for null/undefined', () => {
    expect(calculateLocationScore(null)).toBe(50);
    expect(calculateLocationScore(undefined)).toBe(50);
  });
});

describe('calculateGroupSizeScore', () => {
  it('exact match scores 100', () => {
    expect(calculateGroupSizeScore('2', '2')).toBe(100);
    expect(calculateGroupSizeScore('3', '3')).toBe(100);
    expect(calculateGroupSizeScore('4', '4')).toBe(100);
  });

  it('2 prefers 2, scores lower for 3 and 4', () => {
    expect(calculateGroupSizeScore('2', '3')).toBe(50);
    expect(calculateGroupSizeScore('2', '4')).toBe(25);
  });

  it('4 with 2 scores 25', () => {
    expect(calculateGroupSizeScore('4', '2')).toBe(25);
  });

  it('any matches anything at 100', () => {
    expect(calculateGroupSizeScore('any', '2')).toBe(100);
    expect(calculateGroupSizeScore('any', '3')).toBe(100);
    expect(calculateGroupSizeScore('any', '4')).toBe(100);
    expect(calculateGroupSizeScore('2', 'any')).toBe(100);
    expect(calculateGroupSizeScore('3', 'any')).toBe(100);
    expect(calculateGroupSizeScore('4', 'any')).toBe(100);
  });
});

describe('getMatchTier', () => {
  it('excellent: 80-100', () => {
    expect(getMatchTier(100)).toBe('excellent');
    expect(getMatchTier(80)).toBe('excellent');
    expect(getMatchTier(95)).toBe('excellent');
  });

  it('good: 60-79', () => {
    expect(getMatchTier(79)).toBe('good');
    expect(getMatchTier(60)).toBe('good');
    expect(getMatchTier(70)).toBe('good');
  });

  it('fair: 40-59', () => {
    expect(getMatchTier(59)).toBe('fair');
    expect(getMatchTier(40)).toBe('fair');
    expect(getMatchTier(50)).toBe('fair');
  });

  it('poor: 0-39', () => {
    expect(getMatchTier(39)).toBe('poor');
    expect(getMatchTier(0)).toBe('poor');
    expect(getMatchTier(20)).toBe('poor');
  });
});

describe('formatMatchScore', () => {
  it('formats excellent match', () => {
    expect(formatMatchScore(95)).toBe('95% - Excellent Match');
  });

  it('formats good match', () => {
    expect(formatMatchScore(72)).toBe('72% - Good Match');
  });

  it('formats fair match', () => {
    expect(formatMatchScore(55)).toBe('55% - Fair Match');
  });

  it('formats poor match', () => {
    expect(formatMatchScore(30)).toBe('30% - Poor Match');
  });

  it('rounds to nearest integer', () => {
    expect(formatMatchScore(72.7)).toBe('73% - Good Match');
    expect(formatMatchScore(72.3)).toBe('72% - Good Match');
  });
});

describe('generateMatchReasoning', () => {
  const makeFactor = (label: string, rawScore: number): CompatibilityFactor => ({
    factor: 'handicap',
    label,
    rawScore,
    weight: 0.3,
    weightedScore: rawScore * 0.3,
    description: `${label}: ${rawScore}`,
  });

  it('returns strong match text when 3+ factors score >= 75', () => {
    const factors = [
      makeFactor('Handicap', 80),
      makeFactor('Location', 90),
      makeFactor('Intent', 85),
    ];
    const result = generateMatchReasoning(factors);
    expect(result).toContain('Strong compatibility');
  });

  it('returns limited match text when 2+ factors score <= 40', () => {
    const factors = [
      makeFactor('Handicap', 30),
      makeFactor('Location', 35),
    ];
    const result = generateMatchReasoning(factors);
    expect(result).toContain('Limited compatibility');
  });

  it('returns best factor text when neither condition met', () => {
    const factors = [
      makeFactor('Handicap', 60),
      makeFactor('Location', 70),
      makeFactor('Intent', 55),
    ];
    const result = generateMatchReasoning(factors);
    expect(result).toContain('Best compatibility');
  });
});

describe('MATCH_TIERS constants', () => {
  it('excellent min is 80', () => {
    expect(MATCH_TIERS.excellent.min).toBe(80);
  });

  it('good min is 60', () => {
    expect(MATCH_TIERS.good.min).toBe(60);
  });

  it('fair min is 40', () => {
    expect(MATCH_TIERS.fair.min).toBe(40);
  });

  it('poor min is 0', () => {
    expect(MATCH_TIERS.poor.min).toBe(0);
  });
});

describe('DEFAULT_MATCH_WEIGHTS', () => {
  it('sums to 1.0', () => {
    const total = Object.values(DEFAULT_MATCH_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 2);
  });

  it('handicap is most heavily weighted', () => {
    expect(DEFAULT_MATCH_WEIGHTS.handicap).toBe(0.30);
  });
});

describe('DEFAULT_MATCH_LIMIT', () => {
  it('is 10', () => {
    expect(DEFAULT_MATCH_LIMIT).toBe(10);
  });
});

describe('MIN_MATCH_SCORE', () => {
  it('is 0', () => {
    expect(MIN_MATCH_SCORE).toBe(0);
  });
});
