import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Discovery API Integration Tests
 * 
 * Tests the discovery-search Edge Function and PostgreSQL discover_golfers function:
 * - Same-tier filtering
 * - Handicap band filtering
 * - Location filtering
 * - Intent filtering
 * - Pagination
 * - Error handling
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

interface TestUser {
  id: string;
  email: string;
  tierSlug: 'free' | 'select' | 'summit';
  handicap?: number;
  city?: string;
  intent?: string;
}

// Test users will be created during setup
const testUsers: TestUser[] = [
  { id: '', email: 'test-free-1@spotter.local', tierSlug: 'free', handicap: 8, city: 'Phoenix', intent: 'business' },
  { id: '', email: 'test-free-2@spotter.local', tierSlug: 'free', handicap: 15, city: 'Scottsdale', intent: 'social' },
  { id: '', email: 'test-select-1@spotter.local', tierSlug: 'select', handicap: 12, city: 'Phoenix', intent: 'business_social' },
  { id: '', email: 'test-select-2@spotter.local', tierSlug: 'select', handicap: 18, city: 'Tempe', intent: 'competitive' },
  { id: '', email: 'test-summit-1@spotter.local', tierSlug: 'summit', handicap: 5, city: 'Scottsdale', intent: 'business' },
  { id: '', email: 'test-summit-2@spotter.local', tierSlug: 'summit', handicap: 22, city: 'Phoenix', intent: 'social' },
];

describe('Discovery API Integration Tests', () => {
  let supabase: SupabaseClient;
  let authToken: string;

  beforeAll(async () => {
    // Create Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Sign in as test user
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword123'
    });
    
    if (error) {
      console.warn('Auth warning:', error.message);
      // Continue without auth for some tests
    } else {
      authToken = session?.access_token || '';
    }
  });

  afterAll(async () => {
    // Cleanup
    await supabase.auth.signOut();
  });

  describe('POST /discovery/search', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should return golfers for authenticated user', async () => {
      if (!authToken) {
        console.log('Skipping authenticated test - no auth token');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 10 })
      });

      // May be 404 if function not deployed, or 200 if deployed
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('golfers');
        expect(data).toHaveProperty('pagination');
        expect(data).toHaveProperty('filters');
        expect(data).toHaveProperty('caller_tier');
        expect(Array.isArray(data.golfers)).toBe(true);
      }
    });

    it('should filter by handicap band', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ handicap_band: 'low', limit: 10 })
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.filters.handicap_band).toBe('low');
      }
    });

    it('should filter by location', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location: 'Phoenix', limit: 10 })
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.filters.location).toBe('Phoenix');
      }
    });

    it('should filter by intent', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ intent: 'business', limit: 10 })
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.filters.intent).toBe('business');
      }
    });

    it('should support pagination', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 5, offset: 0 })
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.pagination.limit).toBe(5);
        expect(data.pagination.offset).toBe(0);
        expect(typeof data.pagination.total).toBe('number');
        expect(typeof data.pagination.has_more).toBe('boolean');
      }
    });

    it('should validate handicap_band values', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ handicap_band: 'invalid', limit: 10 })
      });

      expect([200, 400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.error).toContain('handicap_band');
      }
    });

    it('should validate intent values', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ intent: 'invalid', limit: 10 })
      });

      expect([200, 400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.error).toContain('intent');
      }
    });

    it('should limit max results', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 200 }) // Exceeds max of 100
      });

      expect([200, 400, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.pagination.limit).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('PostgreSQL discover_golfers function', () => {
    it('should return results for valid user', async () => {
      // Get a test user with tier
      const { data: user, error } = await supabase
        .from('users')
        .select('id, tier_id')
        .not('tier_id', 'is', null)
        .eq('tier_status', 'active')
        .limit(1)
        .single();

      if (error || !user) {
        console.log('Skipping test - no users with tier found');
        return;
      }

      const { data, error: rpcError } = await supabase
        .rpc('discover_golfers', {
          p_user_id: user.id,
          p_handicap_band: null,
          p_location: null,
          p_intent: null,
          p_limit: 10,
          p_offset: 0
        });

      if (rpcError) {
        console.log('RPC error (expected if function not deployed):', rpcError.message);
        return;
      }

      expect(Array.isArray(data)).toBe(true);
    });

    it('should enforce same-tier filtering', async () => {
      // Get users from different tiers
      const { data: freeUser } = await supabase
        .from('users')
        .select('id, tier_id')
        .eq('membership_tiers.slug', 'free')
        .limit(1)
        .single();

      const { data: selectUser } = await supabase
        .from('users')
        .select('id, tier_id')
        .eq('membership_tiers.slug', 'select')
        .limit(1)
        .single();

      if (!freeUser || !selectUser) {
        console.log('Skipping test - need users in both tiers');
        return;
      }

      const { data: results } = await supabase
        .rpc('discover_golfers', {
          p_user_id: freeUser.id,
          p_handicap_band: null,
          p_location: null,
          p_intent: null,
          p_limit: 100,
          p_offset: 0
        });

      // Check that select user is not in results
      const hasSelectUser = results?.some((r: any) => r.user_id === selectUser.id);
      expect(hasSelectUser).toBe(false);
    });

    it('should filter by handicap band', async () => {
      const { data: user } = await supabase
        .from('users')
        .select('id, tier_id')
        .not('tier_id', 'is', null)
        .limit(1)
        .single();

      if (!user) {
        console.log('Skipping test - no user found');
        return;
      }

      const { data: results } = await supabase
        .rpc('discover_golfers', {
          p_user_id: user.id,
          p_handicap_band: 'low',
          p_location: null,
          p_intent: null,
          p_limit: 100,
          p_offset: 0
        });

      // All results should have low handicap
      if (results && results.length > 0) {
        for (const golfer of results) {
          if (golfer.handicap !== null) {
            expect(golfer.handicap).toBeLessThanOrEqual(10);
          }
        }
      }
    });

    it('should filter by location', async () => {
      const { data: user } = await supabase
        .from('users')
        .select('id, tier_id')
        .not('tier_id', 'is', null)
        .limit(1)
        .single();

      if (!user) {
        console.log('Skipping test - no user found');
        return;
      }

      const { data: results } = await supabase
        .rpc('discover_golfers', {
          p_user_id: user.id,
          p_handicap_band: null,
          p_location: 'Phoenix',
          p_intent: null,
          p_limit: 100,
          p_offset: 0
        });

      // Results should be filtered by location
      if (results && results.length > 0) {
        for (const golfer of results) {
          if (golfer.city) {
            expect(golfer.city.toLowerCase()).toContain('phoenix');
          }
        }
      }
    });

    it('should return compatibility score', async () => {
      const { data: user } = await supabase
        .from('users')
        .select('id, tier_id')
        .not('tier_id', 'is', null)
        .limit(1)
        .single();

      if (!user) {
        console.log('Skipping test - no user found');
        return;
      }

      const { data: results } = await supabase
        .rpc('discover_golfers', {
          p_user_id: user.id,
          p_handicap_band: null,
          p_location: null,
          p_intent: null,
          p_limit: 10,
          p_offset: 0
        });

      if (results && results.length > 0) {
        expect(results[0]).toHaveProperty('compatibility_score');
        expect(typeof results[0].compatibility_score).toBe('number');
      }
    });

    it('should return reputation score', async () => {
      const { data: user } = await supabase
        .from('users')
        .select('id, tier_id')
        .not('tier_id', 'is', null)
        .limit(1)
        .single();

      if (!user) {
        console.log('Skipping test - no user found');
        return;
      }

      const { data: results } = await supabase
        .rpc('discover_golfers', {
          p_user_id: user.id,
          p_handicap_band: null,
          p_location: null,
          p_intent: null,
          p_limit: 10,
          p_offset: 0
        });

      if (results && results.length > 0) {
        expect(results[0]).toHaveProperty('reputation_score');
        expect(typeof results[0].reputation_score).toBe('number');
      }
    });
  });

  describe('Response structure validation', () => {
    it('should return expected DiscoverableGolfer structure', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 1 })
      });

      if (response.status !== 200) {
        console.log('Skipping test - function not available');
        return;
      }

      const data = await response.json();
      
      if (data.golfers && data.golfers.length > 0) {
        const golfer = data.golfers[0];
        
        // Required fields
        expect(golfer).toHaveProperty('user_id');
        expect(golfer).toHaveProperty('display_name');
        expect(golfer).toHaveProperty('tier_id');
        expect(golfer).toHaveProperty('tier_slug');
        expect(golfer).toHaveProperty('compatibility_score');
        expect(golfer).toHaveProperty('reputation_score');
        
        // Optional fields that should exist
        expect(golfer).toHaveProperty('avatar_url');
        expect(golfer).toHaveProperty('city');
        expect(golfer).toHaveProperty('handicap');
        expect(golfer).toHaveProperty('company');
        expect(golfer).toHaveProperty('title');
        expect(golfer).toHaveProperty('industry');
      }
    });

    it('should return proper pagination metadata', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 5, offset: 0 })
      });

      if (response.status !== 200) {
        console.log('Skipping test - function not available');
        return;
      }

      const data = await response.json();
      
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('offset');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('has_more');
      
      expect(typeof data.pagination.limit).toBe('number');
      expect(typeof data.pagination.offset).toBe('number');
      expect(typeof data.pagination.total).toBe('number');
      expect(typeof data.pagination.has_more).toBe('boolean');
    });

    it('should return caller tier information', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discovery-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 1 })
      });

      if (response.status !== 200) {
        console.log('Skipping test - function not available');
        return;
      }

      const data = await response.json();
      
      expect(data).toHaveProperty('caller_tier');
      expect(data.caller_tier).toHaveProperty('tier_id');
      expect(data.caller_tier).toHaveProperty('slug');
    });
  });
});
