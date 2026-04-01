import { 
  createAnonymousClient, 
  createServiceClient, 
  createAuthenticatedClient,
  callEdgeFunction,
  TEST_USERS 
} from './utils/supabase-client';
import { TierSlug, TIER_DEFINITIONS } from '../../../packages/types/src/tier';

/**
 * Tier API Integration Tests
 * 
 * Tests:
 * - Edge function tier assignment
 * - RLS policies for tier-based access
 * - Tier feature validation
 * - User tier state retrieval
 */

describe('Tier Assignment Edge Function', () => {
  test('should assign FREE tier to new user', async () => {
    const response = await callEdgeFunction('tier-assignment', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
        action: 'assign_initial',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.tier).toBe('free');
    expect(data.status).toBe('active');
    expect(data.features).toBeDefined();
    expect(data.features.matchmaking).toBe(true);
    expect(data.features.videoAnalysis).toBe(false);
  });

  test('should upgrade user to SELECT tier', async () => {
    const response = await callEdgeFunction('tier-assignment', {
      method: 'POST',
      body: {
        userId: TEST_USERS.select.id,
        action: 'upgrade',
        targetTier: 'select',
        paymentIntentId: 'pi_test_123',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.tier).toBe('select');
    expect(data.status).toBe('active');
    expect(data.features.videoAnalysis).toBe(true);
    expect(data.features.priorityMatching).toBe(true);
  });

  test('should upgrade user to SUMMIT tier', async () => {
    const response = await callEdgeFunction('tier-assignment', {
      method: 'POST',
      body: {
        userId: TEST_USERS.summit.id,
        action: 'upgrade',
        targetTier: 'summit',
        paymentIntentId: 'pi_test_456',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.tier).toBe('summit');
    expect(data.features.earlyAccess).toBe(true);
    expect(data.features.groupSessions).toBe(true);
    expect(data.features.boostedVisibility).toBe(true);
  });

  test('should reject invalid tier upgrade', async () => {
    const response = await callEdgeFunction('tier-assignment', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
        action: 'upgrade',
        targetTier: 'invalid-tier',
      },
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid tier');
  });

  test('should handle downgrade with period end', async () => {
    const response = await callEdgeFunction('tier-assignment', {
      method: 'POST',
      body: {
        userId: TEST_USERS.summit.id,
        action: 'downgrade',
        targetTier: 'select',
        effectiveAt: 'period_end',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.tier).toBe('summit'); // Still summit until period end
    expect(data.pendingTier).toBe('select');
    expect(data.effectiveDate).toBeDefined();
  });
});

describe('User with Tier Edge Function', () => {
  test('should return user with tier information', async () => {
    const response = await callEdgeFunction('user-with-tier', {
      method: 'GET',
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).toBeDefined();
    expect(data.tier).toBeDefined();
    expect(data.tier.slug).toBeDefined();
    expect(data.tier.features).toBeDefined();
    expect(data.tier.isPaid).toBeDefined();
  });

  test('should return correct tier for FREE user', async () => {
    const response = await callEdgeFunction('user-with-tier', {
      method: 'GET',
      userToken: 'mock-token-free',
    });
    
    const data = await response.json();
    
    expect(data.tier.slug).toBe('free');
    expect(data.tier.isPaid).toBe(false);
    expect(data.tier.features.matchmaking).toBe(true);
    expect(data.tier.features.videoAnalysis).toBe(false);
  });

  test('should return correct tier for SELECT user', async () => {
    const response = await callEdgeFunction('user-with-tier', {
      method: 'GET',
      userToken: 'mock-token-select',
    });
    
    const data = await response.json();
    
    expect(data.tier.slug).toBe('select');
    expect(data.tier.isPaid).toBe(true);
    expect(data.tier.features.videoAnalysis).toBe(true);
    expect(data.tier.features.priorityMatching).toBe(true);
  });

  test('should return correct tier for SUMMIT user', async () => {
    const response = await callEdgeFunction('user-with-tier', {
      method: 'GET',
      userToken: 'mock-token-summit',
    });
    
    const data = await response.json();
    
    expect(data.tier.slug).toBe('summit');
    expect(data.tier.features.earlyAccess).toBe(true);
    expect(data.tier.features.groupSessions).toBe(true);
  });

  test('should require authentication', async () => {
    const response = await callEdgeFunction('user-with-tier', {
      method: 'GET',
    });
    
    expect(response.status).toBe(401);
  });
});

describe('Tier RLS Policies', () => {
  let serviceClient: ReturnType<typeof createServiceClient>;
  let freeUserClient: ReturnType<typeof createAuthenticatedClient>;
  let selectUserClient: ReturnType<typeof createAuthenticatedClient>;

  beforeAll(async () => {
    serviceClient = createServiceClient();
    freeUserClient = await createAuthenticatedClient('free');
    selectUserClient = await createAuthenticatedClient('select');
  });

  test('users can read their own tier state', async () => {
    const { data, error } = await freeUserClient
      .from('user_tier_states')
      .select('*')
      .eq('user_id', TEST_USERS.free.id)
      .single();
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.user_id).toBe(TEST_USERS.free.id);
  });

  test('users cannot read other users tier state', async () => {
    const { data, error } = await freeUserClient
      .from('user_tier_states')
      .select('*')
      .eq('user_id', TEST_USERS.select.id)
      .single();
    
    // Should return no data due to RLS
    expect(data).toBeNull();
  });

  test('users cannot modify their tier directly', async () => {
    const { error } = await freeUserClient
      .from('user_tier_states')
      .update({ tier_id: 'summit-tier-id' })
      .eq('user_id', TEST_USERS.free.id);
    
    // Should fail due to RLS policy
    expect(error).toBeDefined();
  });

  test('service role can read all tier states', async () => {
    const { data, error } = await serviceClient
      .from('user_tier_states')
      .select('*')
      .limit(10);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBeGreaterThan(0);
  });

  test('tier definitions are publicly readable', async () => {
    const { data, error } = await freeUserClient
      .from('membership_tiers')
      .select('*');
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBeGreaterThanOrEqual(3); // free, select, summit
  });
});

describe('Tier Feature Validation', () => {
  test('FREE tier has correct feature flags', () => {
    const freeTier = TIER_DEFINITIONS.free;
    
    expect(freeTier.features.matchmaking).toBe(true);
    expect(freeTier.features.unlimitedSessions).toBe(false);
    expect(freeTier.features.videoAnalysis).toBe(false);
    expect(freeTier.features.priorityMatching).toBe(false);
    expect(freeTier.features.advancedAnalytics).toBe(false);
    expect(freeTier.features.earlyAccess).toBe(false);
    expect(freeTier.features.groupSessions).toBe(false);
    
    expect(freeTier.matchLimitMonthly).toBe(3);
    expect(freeTier.sessionLimitMonthly).toBe(5);
    expect(freeTier.videoSubmissionLimitMonthly).toBe(0);
  });

  test('SELECT tier has correct feature flags', () => {
    const selectTier = TIER_DEFINITIONS.select;
    
    expect(selectTier.features.matchmaking).toBe(true);
    expect(selectTier.features.unlimitedSessions).toBe(true);
    expect(selectTier.features.videoAnalysis).toBe(true);
    expect(selectTier.features.priorityMatching).toBe(true);
    expect(selectTier.features.advancedAnalytics).toBe(true);
    expect(selectTier.features.earlyAccess).toBe(false);
    expect(selectTier.features.groupSessions).toBe(false);
    
    expect(selectTier.matchLimitMonthly).toBeNull();
    expect(selectTier.sessionLimitMonthly).toBeNull();
    expect(selectTier.videoSubmissionLimitMonthly).toBe(10);
  });

  test('SUMMIT tier has all features enabled', () => {
    const summitTier = TIER_DEFINITIONS.summit;
    
    expect(summitTier.features.matchmaking).toBe(true);
    expect(summitTier.features.unlimitedSessions).toBe(true);
    expect(summitTier.features.videoAnalysis).toBe(true);
    expect(summitTier.features.priorityMatching).toBe(true);
    expect(summitTier.features.advancedAnalytics).toBe(true);
    expect(summitTier.features.earlyAccess).toBe(true);
    expect(summitTier.features.groupSessions).toBe(true);
    expect(summitTier.features.boostedVisibility).toBe(true);
    
    expect(summitTier.matchLimitMonthly).toBeNull();
    expect(summitTier.sessionLimitMonthly).toBeNull();
    expect(summitTier.videoSubmissionLimitMonthly).toBeNull();
  });

  test('tier prices are correct', () => {
    expect(TIER_DEFINITIONS.free.priceCentsMonthly).toBe(0);
    expect(TIER_DEFINITIONS.free.priceCentsYearly).toBe(0);
    
    expect(TIER_DEFINITIONS.select.priceCentsMonthly).toBe(999); // $9.99
    expect(TIER_DEFINITIONS.select.priceCentsYearly).toBe(9990); // $99.90
    
    expect(TIER_DEFINITIONS.summit.priceCentsMonthly).toBe(2999); // $29.99
    expect(TIER_DEFINITIONS.summit.priceCentsYearly).toBe(29990); // $299.90
  });
});

describe('Tier Quota Enforcement', () => {
  test('should enforce match limits for FREE tier', async () => {
    const response = await callEdgeFunction('matching-request', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
        testQuotaExceeded: true,
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('quota');
    expect(data.limit).toBe(3);
    expect(data.used).toBe(3);
  });

  test('should enforce session limits for FREE tier', async () => {
    const response = await callEdgeFunction('sessions-propose', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
        testQuotaExceeded: true,
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('session limit');
  });

  test('should allow unlimited matches for SELECT tier', async () => {
    const response = await callEdgeFunction('matching-request', {
      method: 'POST',
      body: {
        userId: TEST_USERS.select.id,
        testQuotaExceeded: true,
      },
      userToken: 'mock-token-select',
    });
    
    // Should succeed despite high usage
    expect(response.status).toBe(200);
  });

  test('should enforce video submission limits for SELECT tier', async () => {
    const response = await callEdgeFunction('videos-presign', {
      method: 'POST',
      body: {
        userId: TEST_USERS.select.id,
        testQuotaExceeded: true,
      },
      userToken: 'mock-token-select',
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('video submission limit');
    expect(data.limit).toBe(10);
  });
});
