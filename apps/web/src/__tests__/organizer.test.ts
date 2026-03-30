/**
 * Organizer quota enforcement tests.
 * Tests that organizer tier limits are correctly enforced.
 */
import { describe, it, expect } from 'vitest';
import { ORGANIZER_TIERS, type OrganizerTier } from '@spotter/types';

// Simulate quota check logic (mirrors how the operator portal checks quotas)
interface QuotaCheck {
  eventsUsed: number;
  eventsLimit: number | null;
  registrationsUsed: number;
  registrationsLimit: number | null;
}

const canCreateEvent = (tier: OrganizerTier, quota: QuotaCheck): boolean => {
  const tierDef = ORGANIZER_TIERS.find(t => t.value === tier);
  if (!tierDef) return false;
  if (tierDef.eventsPerYear === null) return true; // unlimited
  return quota.eventsUsed < tierDef.eventsPerYear;
};

const canAcceptRegistration = (tier: OrganizerTier, quota: QuotaCheck): boolean => {
  const tierDef = ORGANIZER_TIERS.find(t => t.value === tier);
  if (!tierDef) return false;
  if (tierDef.registrationsPerYear === null) return true; // unlimited
  return quota.registrationsUsed < tierDef.registrationsPerYear;
};

describe('Bronze tier quotas', () => {
  const tier: OrganizerTier = 'bronze';

  it('bronze allows event creation when under limit', () => {
    expect(canCreateEvent(tier, { eventsUsed: 4, eventsLimit: 5, registrationsUsed: 0, registrationsLimit: 500 })).toBe(true);
  });

  it('bronze blocks event creation when at limit', () => {
    expect(canCreateEvent(tier, { eventsUsed: 5, eventsLimit: 5, registrationsUsed: 0, registrationsLimit: 500 })).toBe(false);
  });

  it('bronze blocks event creation when over limit', () => {
    expect(canCreateEvent(tier, { eventsUsed: 6, eventsLimit: 5, registrationsUsed: 0, registrationsLimit: 500 })).toBe(false);
  });

  it('bronze allows registration when under limit', () => {
    expect(canAcceptRegistration(tier, { eventsUsed: 0, eventsLimit: 5, registrationsUsed: 499, registrationsLimit: 500 })).toBe(true);
  });

  it('bronze blocks registration when at limit', () => {
    expect(canAcceptRegistration(tier, { eventsUsed: 0, eventsLimit: 5, registrationsUsed: 500, registrationsLimit: 500 })).toBe(false);
  });
});

describe('Silver tier quotas', () => {
  const tier: OrganizerTier = 'silver';

  it('silver allows event creation when under 20 limit', () => {
    expect(canCreateEvent(tier, { eventsUsed: 19, eventsLimit: 20, registrationsUsed: 0, registrationsLimit: 2500 })).toBe(true);
  });

  it('silver blocks event creation when at 20 limit', () => {
    expect(canCreateEvent(tier, { eventsUsed: 20, eventsLimit: 20, registrationsUsed: 0, registrationsLimit: 2500 })).toBe(false);
  });

  it('silver allows registration when under 2500 limit', () => {
    expect(canAcceptRegistration(tier, { eventsUsed: 0, eventsLimit: 20, registrationsUsed: 2499, registrationsLimit: 2500 })).toBe(true);
  });
});

describe('Gold tier quotas', () => {
  const tier: OrganizerTier = 'gold';

  it('gold allows unlimited event creation', () => {
    expect(canCreateEvent(tier, { eventsUsed: 1000, eventsLimit: null, registrationsUsed: 0, registrationsLimit: null })).toBe(true);
  });

  it('gold allows unlimited registrations', () => {
    expect(canAcceptRegistration(tier, { eventsUsed: 0, eventsLimit: null, registrationsUsed: 999999, registrationsLimit: null })).toBe(true);
  });
});

describe('ORGANIZER_TIERS constants', () => {
  it('bronze has 5 events per year', () => {
    const bronze = ORGANIZER_TIERS.find(t => t.value === 'bronze');
    expect(bronze?.eventsPerYear).toBe(5);
  });

  it('bronze has 500 registrations per year', () => {
    const bronze = ORGANIZER_TIERS.find(t => t.value === 'bronze');
    expect(bronze?.registrationsPerYear).toBe(500);
  });

  it('silver has 20 events per year', () => {
    const silver = ORGANIZER_TIERS.find(t => t.value === 'silver');
    expect(silver?.eventsPerYear).toBe(20);
  });

  it('silver has 2500 registrations per year', () => {
    const silver = ORGANIZER_TIERS.find(t => t.value === 'silver');
    expect(silver?.registrationsPerYear).toBe(2500);
  });

  it('gold has unlimited events', () => {
    const gold = ORGANIZER_TIERS.find(t => t.value === 'gold');
    expect(gold?.eventsPerYear).toBeNull();
  });

  it('gold has unlimited registrations', () => {
    const gold = ORGANIZER_TIERS.find(t => t.value === 'gold');
    expect(gold?.registrationsPerYear).toBeNull();
  });

  it('all tiers have a label and description', () => {
    for (const tier of ORGANIZER_TIERS) {
      expect(tier.label).toBeTruthy();
      expect(tier.description).toBeTruthy();
      expect(tier.features).toBeDefined();
    }
  });
});
