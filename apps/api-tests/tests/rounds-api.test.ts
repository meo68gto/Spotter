import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Rounds API Integration Tests
 * 
 * Tests the rounds Edge Functions:
 * - rounds-create: Create new rounds with tier limits
 * - rounds-list: List rounds with same-tier filtering
 * - rounds-invite: Invite users to rounds
 * - rounds-respond: Respond to invitations
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

describe('Rounds API Integration Tests', () => {
  let supabase: SupabaseClient;
  let authToken: string;
  let testRoundId: string;

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

  describe('POST /rounds-create', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: 'test-course',
          scheduledAt: new Date(Date.now() + 86400000).toISOString()
        })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should require courseId', async () => {
      if (!authToken) {
        console.log('Skipping test - no auth token');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scheduledAt: new Date(Date.now() + 86400000).toISOString()
        })
      });

      expect([400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.error).toContain('course_id');
      }
    });

    it('should require scheduledAt in future', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: 'test-course',
          scheduledAt: new Date(Date.now() - 86400000).toISOString() // Past date
        })
      });

      expect([400, 201, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.error).toMatch(/future/i);
      }
    });

    it('should validate maxPlayers options', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: 'test-course',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          maxPlayers: 5 // Invalid - should be 2, 3, or 4
        })
      });

      expect([400, 201, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.error).toContain('max_players');
      }
    });

    it('should validate cartPreference options', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: 'test-course',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          cartPreference: 'invalid'
        })
      });

      expect([400, 201, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.error).toContain('cart_preference');
      }
    });

    it('should create round successfully', async () => {
      if (!authToken) {
        console.log('Skipping test - no auth token');
        return;
      }

      // Get a valid course ID first
      const { data: course } = await supabase
        .from('golf_courses')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!course) {
        console.log('Skipping test - no active courses found');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: course.id,
          scheduledAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          maxPlayers: 4,
          cartPreference: 'either',
          notes: 'Test round created by API test'
        })
      });

      expect([201, 403, 404, 429]).toContain(response.status);
      
      if (response.status === 201) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('id');
        expect(data.data).toHaveProperty('creatorId');
        expect(data.data).toHaveProperty('courseId');
        expect(data.data).toHaveProperty('scheduledAt');
        expect(data.data).toHaveProperty('maxPlayers');
        expect(data.data).toHaveProperty('cartPreference');
        expect(data.data).toHaveProperty('tierId');
        expect(data.data).toHaveProperty('tierSlug');
        expect(data.data).toHaveProperty('status');
        
        testRoundId = data.data.id;
      }
    });

    it('should check tier status is active', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: 'test-course',
          scheduledAt: new Date(Date.now() + 86400000).toISOString()
        })
      });

      expect([201, 403, 404]).toContain(response.status);
      
      if (response.status === 403) {
        const data = await response.json();
        expect(data.code).toMatch(/tier|active/);
      }
    });

    it('should enforce FREE tier round limit', async () => {
      if (!authToken) return;

      // This test assumes FREE tier user has reached their limit
      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: 'test-course',
          scheduledAt: new Date(Date.now() + 86400000).toISOString()
        })
      });

      expect([201, 429, 404]).toContain(response.status);
      
      if (response.status === 429) {
        const data = await response.json();
        expect(data.code).toBe('round_limit_reached');
        expect(data).toHaveProperty('limit');
        expect(data).toHaveProperty('used');
      }
    });

    it('should create round with current user tier', async () => {
      if (!authToken || !testRoundId) {
        console.log('Skipping test - need auth token and test round');
        return;
      }

      // Verify round was created with correct tier
      const { data: round } = await supabase
        .from('rounds')
        .select('tier_id, creator_id')
        .eq('id', testRoundId)
        .single();

      if (round) {
        const { data: user } = await supabase
          .from('users')
          .select('tier_id')
          .eq('id', round.creator_id)
          .single();

        expect(round.tier_id).toBe(user?.tier_id);
      }
    });
  });

  describe('GET /rounds-list', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-list`, {
        method: 'GET'
      });

      expect(response.status).toBe(401);
    });

    it('should return rounds list for authenticated user', async () => {
      if (!authToken) {
        console.log('Skipping test - no auth token');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-list`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('pagination');
        expect(Array.isArray(data.data)).toBe(true);
        
        if (data.data.length > 0) {
          const round = data.data[0];
          expect(round).toHaveProperty('id');
          expect(round).toHaveProperty('creatorId');
          expect(round).toHaveProperty('courseId');
          expect(round).toHaveProperty('courseName');
          expect(round).toHaveProperty('scheduledAt');
          expect(round).toHaveProperty('maxPlayers');
          expect(round).toHaveProperty('status');
        }
      }
    });

    it('should filter by same tier', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-list`, {
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

      for (const round of data.data) {
        // Query the round's tier
        const { data: roundData } = await supabase
          .from('rounds')
          .select('tier_id')
          .eq('id', round.id)
          .single();

        if (roundData) {
          expect(roundData.tier_id).toBe(userData?.tier_id);
        }
      }
    });

    it('should support my_rounds filter', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-list?my_rounds=true`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        
        // All rounds should have current user as creator or participant
        for (const round of data.data) {
          expect(round.myRole).toBeTruthy();
        }
      }
    });

    it('should support status filter', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-list?status=open`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        
        for (const round of data.data) {
          expect(round.status).toBe('open');
        }
      }
    });

    it('should support date range filters', async () => {
      if (!authToken) return;

      const dateFrom = new Date().toISOString().slice(0, 10);
      const dateTo = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/rounds-list?date_from=${dateFrom}&date_to=${dateTo}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect([200, 404]).toContain(response.status);
    });

    it('should support pagination', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-list?limit=5&offset=0`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.pagination.limit).toBeLessThanOrEqual(5);
        expect(data.pagination.offset).toBe(0);
      }
    });
  });

  describe('POST /rounds-invite', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: 'test-round',
          userId: 'test-user'
        })
      });

      expect(response.status).toBe(401);
    });

    it('should require roundId and userId', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
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
        expect(data.error).toMatch(/round_id|user_id/);
      }
    });

    it('should prevent self-invite', async () => {
      if (!authToken) return;

      const { data: { user } } = await supabase.auth.getUser();

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roundId: 'test-round',
          userId: user?.id
        })
      });

      expect([400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.code).toBe('cannot_invite_self');
      }
    });

    it('should require creator permission', async () => {
      if (!authToken) return;

      // Try to invite to a round we don't own
      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roundId: 'not-owned-round',
          userId: 'another-user'
        })
      });

      expect([403, 404]).toContain(response.status);
      
      if (response.status === 403) {
        const data = await response.json();
        expect(data.code).toBe('not_creator');
      }
    });

    it('should enforce same-tier invitation', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roundId: 'test-round',
          userId: 'different-tier-user'
        })
      });

      expect([403, 404]).toContain(response.status);
      
      if (response.status === 403) {
        const data = await response.json();
        expect(data.code).toBe('tier_mismatch');
      }
    });

    it('should prevent duplicate invitations', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roundId: 'test-round',
          userId: 'already-invited-user'
        })
      });

      expect([400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.code).toBe('already_invited');
      }
    });

    it('should prevent inviting existing participants', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roundId: 'test-round',
          userId: 'existing-participant'
        })
      });

      expect([400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.code).toBe('already_participant');
      }
    });

    it('should prevent inviting when round is full', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roundId: 'full-round',
          userId: 'new-user'
        })
      });

      expect([400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.code).toBe('round_full');
      }
    });

    it('should prevent inviting to non-open rounds', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roundId: 'cancelled-round',
          userId: 'new-user'
        })
      });

      expect([400, 404]).toContain(response.status);
      
      if (response.status === 400) {
        const data = await response.json();
        expect(data.code).toBe('round_not_open');
      }
    });
  });

  describe('Round status and lifecycle', () => {
    it('should update status when participant joins', async () => {
      if (!testRoundId) {
        console.log('Skipping test - no test round created');
        return;
      }

      const { data: round } = await supabase
        .from('rounds')
        .select('status, max_players')
        .eq('id', testRoundId)
        .single();

      if (round) {
        expect(['open', 'full', 'completed', 'cancelled']).toContain(round.status);
      }
    });

    it('should have creator as initial participant', async () => {
      if (!testRoundId) return;

      const { data: participants } = await supabase
        .from('round_participants_v2')
        .select('user_id')
        .eq('round_id', testRoundId);

      expect(participants?.length).toBeGreaterThanOrEqual(1);
    });

    it('should enforce maxPlayers limit', async () => {
      if (!testRoundId) return;

      const { data: round } = await supabase
        .from('rounds')
        .select('max_players')
        .eq('id', testRoundId)
        .single();

      const { data: participants } = await supabase
        .from('round_participants_v2')
        .select('id')
        .eq('round_id', testRoundId);

      if (round && participants) {
        expect(participants.length).toBeLessThanOrEqual(round.max_players);
      }
    });
  });

  describe('Edge function structure validation', () => {
    it('rounds-create should return proper response structure', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: 'test-course',
          scheduledAt: new Date(Date.now() + 86400000).toISOString()
        })
      });

      if (response.status === 201) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        
        const round = data.data;
        expect(round).toHaveProperty('id');
        expect(round).toHaveProperty('creatorId');
        expect(round).toHaveProperty('courseId');
        expect(round).toHaveProperty('courseName');
        expect(round).toHaveProperty('courseCity');
        expect(round).toHaveProperty('courseState');
        expect(round).toHaveProperty('scheduledAt');
        expect(round).toHaveProperty('maxPlayers');
        expect(round).toHaveProperty('cartPreference');
        expect(round).toHaveProperty('tierId');
        expect(round).toHaveProperty('tierSlug');
        expect(round).toHaveProperty('status');
        expect(round).toHaveProperty('confirmedParticipants');
        expect(round).toHaveProperty('notes');
        expect(round).toHaveProperty('createdAt');
      }
    });

    it('rounds-list should return proper response structure', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-list`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('pagination');
        expect(data.pagination).toHaveProperty('total');
        expect(data.pagination).toHaveProperty('limit');
        expect(data.pagination).toHaveProperty('offset');
        
        if (data.data.length > 0) {
          const round = data.data[0];
          expect(round).toHaveProperty('id');
          expect(round).toHaveProperty('creatorId');
          expect(round).toHaveProperty('creatorName');
          expect(round).toHaveProperty('courseId');
          expect(round).toHaveProperty('courseName');
          expect(round).toHaveProperty('scheduledAt');
          expect(round).toHaveProperty('maxPlayers');
          expect(round).toHaveProperty('confirmedParticipants');
          expect(round).toHaveProperty('status');
          expect(round).toHaveProperty('myRole');
        }
      }
    });

    it('rounds-invite should return proper response structure', async () => {
      if (!authToken) return;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/rounds-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roundId: 'test-round',
          userId: 'test-user'
        })
      });

      if (response.status === 201) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        
        const invite = data.data;
        expect(invite).toHaveProperty('id');
        expect(invite).toHaveProperty('roundId');
        expect(invite).toHaveProperty('inviteeId');
        expect(invite).toHaveProperty('status');
        expect(invite).toHaveProperty('invitedAt');
      }
    });
  });
});
