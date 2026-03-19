/**
 * Trust & Reliability Tests
 * Epic 6: Comprehensive test suite for trust system
 */

import { describe, it, expect } from 'vitest';
import { 
  calculateDiscoveryBoost,
  getReliabilityLabel,
  TRUST_CONFIG 
} from './trust-config';
import type { 
  ReliabilityBreakdown, 
  TrustBadge, 
  Vouch,
  Incident,
  CreateIncidentInput 
} from './trust';

describe('Trust & Reliability System', () => {
  describe('Discovery Boost', () => {
    it('should return base boost (1.00) for low reliability', () => {
      expect(calculateDiscoveryBoost(50, 0)).toBe(1.00);
      expect(calculateDiscoveryBoost(74, 0)).toBe(1.00);
    });

    it('should add +5% for medium reliability (75%+)', () => {
      expect(calculateDiscoveryBoost(75, 0)).toBe(1.05);
      expect(calculateDiscoveryBoost(84, 0)).toBe(1.05);
    });

    it('should add +15% for high reliability (85%+)', () => {
      expect(calculateDiscoveryBoost(85, 0)).toBe(1.15);
      expect(calculateDiscoveryBoost(94, 0)).toBe(1.15);
    });

    it('should add +30% for max reliability (95%+)', () => {
      expect(calculateDiscoveryBoost(95, 0)).toBe(1.30);
      expect(calculateDiscoveryBoost(100, 0)).toBe(1.30);
    });

    it('should add +10% for bronze badge tier (1+ badges)', () => {
      expect(calculateDiscoveryBoost(50, 1)).toBe(1.10);
      expect(calculateDiscoveryBoost(50, 2)).toBe(1.10);
    });

    it('should add +20% for gold badge tier (3+ badges)', () => {
      expect(calculateDiscoveryBoost(50, 3)).toBe(1.20);
      expect(calculateDiscoveryBoost(50, 5)).toBe(1.20);
    });

    it('should combine reliability and badge boosts', () => {
      expect(calculateDiscoveryBoost(95, 3)).toBe(1.50); // 30% + 20%
      expect(calculateDiscoveryBoost(85, 1)).toBe(1.25); // 15% + 10%
    });

    it('should cap at maximum (1.50)', () => {
      expect(calculateDiscoveryBoost(100, 10)).toBe(1.50);
    });
  });

  describe('Reliability Labels', () => {
    it('should return Building for scores 0-74', () => {
      expect(getReliabilityLabel(0)).toBe('Building');
      expect(getReliabilityLabel(74)).toBe('Building');
    });

    it('should return Reliable for scores 75-89', () => {
      expect(getReliabilityLabel(75)).toBe('Reliable');
      expect(getReliabilityLabel(89)).toBe('Reliable');
    });

    it('should return Trusted for scores 90-97', () => {
      expect(getReliabilityLabel(90)).toBe('Trusted');
      expect(getReliabilityLabel(97)).toBe('Trusted');
    });

    it('should return Exceptional for scores 98-100', () => {
      expect(getReliabilityLabel(98)).toBe('Exceptional');
      expect(getReliabilityLabel(100)).toBe('Exceptional');
    });
  });

  describe('Configuration', () => {
    it('should have valid reliability weights', () => {
      const weights = TRUST_CONFIG.reliability.weights;
      const total = weights.showRate + weights.punctuality + weights.incidentPenalty;
      expect(total).toBeCloseTo(1.0, 2);
    });

    it('should have valid vouch settings', () => {
      expect(TRUST_CONFIG.vouch.minRounds).toBe(3);
      expect(TRUST_CONFIG.vouch.maxGiven).toBe(5);
      expect(TRUST_CONFIG.vouch.expirationDays).toBe(365);
    });

    it('should have valid incident penalties', () => {
      expect(TRUST_CONFIG.incident.penalties.minor).toBe(2);
      expect(TRUST_CONFIG.incident.penalties.moderate).toBe(5);
      expect(TRUST_CONFIG.incident.penalties.serious).toBe(15);
    });
  });

  describe('Type Guards', () => {
    it('should validate VouchStatus', () => {
      const { isValidVouchStatus } = require('./trust');
      expect(isValidVouchStatus('active')).toBe(true);
      expect(isValidVouchStatus('expired')).toBe(true);
      expect(isValidVouchStatus('revoked')).toBe(true);
      expect(isValidVouchStatus('invalid')).toBe(false);
    });

    it('should validate IncidentSeverity', () => {
      const { isValidIncidentSeverity } = require('./trust');
      expect(isValidIncidentSeverity('minor')).toBe(true);
      expect(isValidIncidentSeverity('moderate')).toBe(true);
      expect(isValidIncidentSeverity('serious')).toBe(true);
      expect(isValidIncidentSeverity('critical')).toBe(false);
    });

    it('should validate IncidentCategory', () => {
      const { isValidIncidentCategory } = require('./trust');
      expect(isValidIncidentCategory('no_show')).toBe(true);
      expect(isValidIncidentCategory('late')).toBe(true);
      expect(isValidIncidentCategory('behavior')).toBe(true);
      expect(isValidIncidentCategory('safety')).toBe(true);
      expect(isValidIncidentCategory('other')).toBe(true);
      expect(isValidIncidentCategory('spam')).toBe(false);
    });

    it('should validate TrustBadgeType', () => {
      const { isValidTrustBadgeType } = require('./trust');
      expect(isValidTrustBadgeType('first_round')).toBe(true);
      expect(isValidTrustBadgeType('reliable_player')).toBe(true);
      expect(isValidTrustBadgeType('exceptional')).toBe(true);
      expect(isValidTrustBadgeType('invalid_badge')).toBe(false);
    });
  });
});
