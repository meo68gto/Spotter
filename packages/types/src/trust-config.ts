// Trust & Reliability Configuration
// Epic 6: Centralized configuration for trust system

export const TRUST_CONFIG = {
  // Reliability Calculation
  reliability: {
    weights: {
      showRate: 0.50,
      punctuality: 0.30,
      incidentPenalty: 0.20
    },
    labels: {
      building: { min: 0, max: 74, label: 'Building' },
      reliable: { min: 75, max: 89, label: 'Reliable' },
      trusted: { min: 90, max: 97, label: 'Trusted' },
      exceptional: { min: 98, max: 100, label: 'Exceptional' }
    }
  },

  // Vouch Settings
  vouch: {
    minRounds: 3,
    maxGiven: 5,
    expirationDays: 365
  },

  // Incident Settings
  incident: {
    penalties: {
      minor: 2,
      moderate: 5,
      serious: 15
    },
    cooldownDays: 30
  },

  // Discovery Boost
  discovery: {
    reliability: {
      max: { threshold: 95, boost: 0.30 },
      high: { threshold: 85, boost: 0.15 },
      medium: { threshold: 75, boost: 0.05 }
    },
    badges: {
      gold: { count: 3, boost: 0.20 },
      bronze: { count: 1, boost: 0.10 }
    },
    maxTotal: 1.50
  },

  // Badge Criteria
  badges: {
    first_round: { rounds: 1, field: 'roundsCompleted' },
    reliable_player: { reliability: 95 },
    punctual: { minutesEarly: 5, minRounds: 5 },
    social_connector: { connections: 10 },
    community_vouched: { vouches: 3 },
    regular: { rounds: 10 },
    veteran: { rounds: 50 },
    exceptional: { reliability: 98, rounds: 20 },
    vouch_giver: { vouchesGiven: 5 }
  }
};

// Calculate discovery boost from reliability score and badge count
export function calculateDiscoveryBoost(
  reliabilityScore: number,
  badgeCount: number
): number {
  let boost = 1.00;

  // Reliability boost
  if (reliabilityScore >= TRUST_CONFIG.discovery.reliability.max.threshold) {
    boost += TRUST_CONFIG.discovery.reliability.max.boost;
  } else if (reliabilityScore >= TRUST_CONFIG.discovery.reliability.high.threshold) {
    boost += TRUST_CONFIG.discovery.reliability.high.boost;
  } else if (reliabilityScore >= TRUST_CONFIG.discovery.reliability.medium.threshold) {
    boost += TRUST_CONFIG.discovery.reliability.medium.boost;
  }

  // Badge boost
  if (badgeCount >= TRUST_CONFIG.discovery.badges.gold.count) {
    boost += TRUST_CONFIG.discovery.badges.gold.boost;
  } else if (badgeCount >= TRUST_CONFIG.discovery.badges.bronze.count) {
    boost += TRUST_CONFIG.discovery.badges.bronze.boost;
  }

  return Math.min(boost, TRUST_CONFIG.discovery.maxTotal);
}

// Calculate reliability label from score
export function getReliabilityLabel(score: number): string {
  if (score >= 98) return 'Exceptional';
  if (score >= 90) return 'Trusted';
  if (score >= 75) return 'Reliable';
  return 'Building';
}
