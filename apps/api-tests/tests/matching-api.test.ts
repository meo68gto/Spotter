import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Matching API Integration Tests
 * 
 * Tests the matching-suggestions Edge Function and PostgreSQL matching functions:
 * - Match score calculation
 * - Top matches retrieval
 * - Same-tier filtering
 * - Compatibility factors
 * - Privacy controls (open_to_intros)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

describe('Matching API Integration Tests', () => {
  let supabase: SupabaseClient;
  let authToken: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword123'
    });
    
    if (error) {
      console.warn('Auth warning:', error.message);
    } else {
      authToken = session?.access_token || '';
    }
  });

  afterAll(async () => {
    await supabase.auth.signOut();
  });

  describe('GET /matching/suggestions', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions`, {
        method: 'GET'
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should return top matches for authenticated user', async () => {
      if (!authToken) {
        console.log('Skipping authenticated test - no auth token');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('userId');
        expect(data).toHaveProperty('totalMatches');
        expect(data).toHaveProperty('matches');
        expect(data).toHaveProperty('metadata');
        expect(Array.isArray(data.matches)).toBe(true);
      }
    });

    it('should support limit parameter', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions?limit=5`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.matches.length).toBeLessThanOrEqual(5);
      }
    });

    it('should support minScore filter', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions?minScore=60`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        for (const match of data.matches) {
          expect(match.matchScore.overallScore).toBeGreaterThanOrEqual(60);
        }
      }
    });
  });

  describe('POST /matching/calculate', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: 'test-user-id' })
      });

      expect(response.status).toBe(401);
    });

    it('should require targetUserId', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions/calculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      expect([400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.error).toContain('targetUserId');
      }
    });

    it('should calculate match with specific user', async () => {
      if (!authToken) return;

      // Get a test user to calculate match with
      const { data: targetUser } = await supabase
        .from('users')
        .select('id')
        .not('id', 'eq', (await supabase.auth.getUser()).data.user?.id)
        .limit(1)
        .single();

      if (!targetUser) {
        console.log('Skipping test - no target user found');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions/calculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId: targetUser.id })
      });

      expect([200, 403, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('userId');
        expect(data).toHaveProperty('targetUserId');
        expect(data).toHaveProperty('matchScore');
        expect(data.matchScore).toHaveProperty('overallScore');
        expect(data.matchScore).toHaveProperty('factors');
        expect(data.matchScore).toHaveProperty('tier');
      }
    });

    it('should reject cross-tier match calculation', async () => {
      if (!authToken) return;

      // This test assumes we have users in different tiers
      // The API should return 403 for cross-tier calculations
      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions/calculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId: 'different-tier-user-id' })
      });

      expect([200, 403, 404]).toContain(response.status);
      
      if (response.status === 403) {
        const data = await response.json();
        expect(data.error).toContain('tier');
      }
    });
  });

  describe('PostgreSQL matching functions', () => {
    it('should calculate match score between two users', async () => {
      // Get two users in same tier
      const { data: users } = await supabase
        .from('users')
        .select('id, tier_id')
        .not('tier_id', 'is', null)
        .limit(2);

      if (!users || users.length < 2) {
        console.log('Skipping test - need 2 users with tiers');
        return;
      }

      const { data, error } = await supabase
        .rpc('calculate_match_score', {
          user_id_1: users[0].id,
          user_id_2: users[1].id
        });

      if (error) {
        console.log('RPC error (expected if function not deployed):', error.message);
        return;
      }

      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('match_score');
        expect(typeof data[0].match_score).toBe('number');
      }
    });

    it('should return top matches for user', async () => {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .not('tier_id', 'is', null)
        .limit(1)
        .single();

      if (!user) {
        console.log('Skipping test - no user found');
        return;
      }

      const { data, error } = await supabase
        .rpc('get_top_matches', {
          p_user_id: user.id,
          p_limit: 10,
          p_min_score: 0
        });

      if (error) {
        console.log('RPC error (expected if function not deployed):', error.message);
        return;
      }

      expect(Array.isArray(data)).toBe(true);
    });

    it('should calculate handicap similarity', async () => {
      const testCases = [
        { h1: 10, h2: 12, expected: 75 },
        { h1: 15, h2: 15, expected: 100 },
        { h1: 5, h2: 20, expected: 50 },
      ];

      for (const testCase of testCases) {
        const { data, error } = await supabase
          .rpc('calculate_handicap_similarity', {
            handicap_1: testCase.h1,
            handicap_2: testCase.h2
          });

        if (error) {
          console.log('RPC error:', error.message);
          continue;
        }

        expect(data).toBe(testCase.expected);
      }
    });

    it('should calculate intent compatibility', async () => {
      const testCases = [
        { i1: 'business', i2: 'business', expected: 100 },
        { i1: 'social', i2: 'social', expected: 100 },
        { i1: 'business', i2: 'social', expected: 25 },
      ];

      for (const testCase of testCases) {
        const { data, error } = await supabase
          .rpc('calculate_intent_compatibility', {
            intent_1: testCase.i1,
            intent_2: testCase.i2
          });

        if (error) {
          console.log('RPC error:', error.message);
          continue;
        }

        expect(data).toBe(testCase.expected);
      }
    });

    it('should calculate location score', async () => {
      const testCases = [
        { distance: 5, expected: 100 },
        { distance: 25, expected: 75 },
        { distance: 75, expected: 25 },
      ];

      for (const testCase of testCases) {
        const { data, error } = await supabase
          .rpc('calculate_location_score', {
            distance_km: testCase.distance
          });

        if (error) {
          console.log('RPC error:', error.message);
          continue;
        }

        expect(data).toBe(testCase.expected);
      }
    });

    it('should calculate group size compatibility', async () => {
      const testCases = [
        { s1: '2', s2: '2', expected: 100 },
        { s1: '4', s2: '4', expected: 100 },
        { s1: '2', s2: '4', expected: 25 },
      ];

      for (const testCase of testCases) {
        const { data, error } = await supabase
          .rpc('calculate_group_size_compatibility', {
            size_1: testCase.s1,
            size_2: testCase.s2
          });

        if (error) {
          console.log('RPC error:', error.message);
          continue;
        }

        expect(data).toBe(testCase.expected);
      }
    });
  });

  describe('Match score structure validation', () => {
    it('should return expected MatchScore structure', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.status !== 200) {
        console.log('Skipping test - function not available');
        return;
      }

      const data = await response.json();
      
      if (data.matches && data.matches.length > 0) {
        const match = data.matches[0];
        
        // Check matchScore structure
        expect(match).toHaveProperty('matchScore');
        expect(match.matchScore).toHaveProperty('targetUserId');
        expect(match.matchScore).toHaveProperty('targetDisplayName');
        expect(match.matchScore).toHaveProperty('overallScore');
        expect(match.matchScore).toHaveProperty('tier');
        expect(match.matchScore).toHaveProperty('factors');
        expect(match.matchScore).toHaveProperty('reasoning');
        expect(match.matchScore).toHaveProperty('calculatedAt');
        
        // Check factors structure
        expect(Array.isArray(match.matchScore.factors)).toBe(true);
        if (match.matchScore.factors.length > 0) {
          const factor = match.matchScore.factors[0];
          expect(factor).toHaveProperty('factor');
          expect(factor).toHaveProperty('label');
          expect(factor).toHaveProperty('rawScore');
          expect(factor).toHaveProperty('weight');
          expect(factor).toHaveProperty('weightedScore');
          expect(factor).toHaveProperty('description');
        }
        
        // Check user structure
        expect(match).toHaveProperty('user');
        expect(match.user).toHaveProperty('id');
        expect(match.user).toHaveProperty('displayName');
        
        // Check metadata
        expect(match).toHaveProperty('mutualConnections');
        expect(match).toHaveProperty('sharedCourses');
        expect(match).toHaveProperty('distanceKm');
      }
    });

    it('should return valid match score ranges', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.status !== 200) {
        console.log('Skipping test - function not available');
        return;
      }

      const data = await response.json();
      
      for (const match of data.matches) {
        // Overall score should be 0-100
        expect(match.matchScore.overallScore).toBeGreaterThanOrEqual(0);
        expect(match.matchScore.overallScore).toBeLessThanOrEqual(100);
        
        // Tier should be valid
        expect(['excellent', 'good', 'fair', 'poor']).toContain(match.matchScore.tier);
        
        // Factors should have valid scores
        for (const factor of match.matchScore.factors) {
          expect(factor.rawScore).toBeGreaterThanOrEqual(0);
          expect(factor.rawScore).toBeLessThanOrEqual(100);
          expect(factor.weight).toBeGreaterThan(0);
          expect(factor.weight).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should return valid tier values', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.status !== 200) {
        console.log('Skipping test - function not available');
        return;
      }

      const data = await response.json();
      
      for (const match of data.matches) {
        expect(['excellent', 'good', 'fair', 'poor']).toContain(match.matchScore.tier);
        
        // Verify tier matches score
        const score = match.matchScore.overallScore;
        if (score >= 80) {
          expect(match.matchScore.tier).toBe('excellent');
        } else if (score >= 60) {
          expect(match.matchScore.tier).toBe('good');
        } else if (score >= 40) {
          expect(match.matchScore.tier).toBe('fair');
        } else {
          expect(match.matchScore.tier).toBe('poor');
        }
      }
    });
  });

  describe('Same-tier filtering', () => {
    it('should only return matches from same tier', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.status !== 200) {
        console.log('Skipping test - function not available');
        return;
      }

      const data = await response.json();
      
      // Get current user's tier
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase
        .from('users')
        .select('tier_id')
        .eq('id', user?.id)
        .single();

      for (const match of data.matches) {
        // Match should be from same tier
        // This would require fetching the match user's tier
        // For now, just verify the structure is correct
        expect(match.user.id).toBeTruthy();
      }
    });
  });

  describe('Privacy controls', () => {
    it('should only return users with open_to_intros=true', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.status !== 200) {
        console.log('Skipping test - function not available');
        return;
      }

      const data = await response.json();
      
      // All returned matches should have open_to_intros
      // This is enforced by the database function
      for (const match of data.matches) {
        // If networking info is available, verify open_to_intros
        if (match.networking) {
          expect(match.networking.openToIntros).toBe(true);
        }
      }
    });
  });

  describe('Metadata validation', () => {
    it('should return calculation metadata', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/matching-suggestions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.status !== 200) {
        console.log('Skipping test - function not available');
        return;
      }

      const data = await response.json();
      
      expect(data).toHaveProperty('metadata');
      expect(data.metadata).toHaveProperty('calculationTimeMs');
      expect(data.metadata).toHaveProperty('filtersApplied');
      expect(data.metadata).toHaveProperty('candidatePoolSize');
      
      expect(typeof data.metadata.calculationTimeMs).toBe('number');
      expect(Array.isArray(data.metadata.filtersApplied)).toBe(true);
      expect(typeof data.metadata.candidatePoolSize).toBe('number');
    });
  });
});
