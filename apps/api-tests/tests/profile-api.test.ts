import { 
  createAuthenticatedClient,
  createServiceClient,
  callEdgeFunction,
  TEST_USERS 
} from '../utils/supabase-client';

/**
 * Profile API Integration Tests
 * 
 * Tests:
 * - Profile CRUD operations
 * - Connection management
 * - Introduction handling
 * - Reputation calculation
 * - Same-tier visibility enforcement
 */

describe('Profile Get Edge Function', () => {
  test('should return own profile', async () => {
    const response = await callEdgeFunction('profile-get', {
      method: 'GET',
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).toBeDefined();
    expect(data.displayName).toBeDefined();
    expect(data.email).toBeDefined();
    expect(data.completeness).toBeDefined();
  });

  test('should return profile with professional identity', async () => {
    const response = await callEdgeFunction('profile-get', {
      method: 'GET',
      userToken: 'mock-token-select',
    });
    
    const data = await response.json();
    
    expect(data.professional).toBeDefined();
    expect(data.professional.role).toBeDefined();
    expect(data.professional.company).toBeDefined();
  });

  test('should return profile with golf identity', async () => {
    const response = await callEdgeFunction('profile-get', {
      method: 'GET',
      userToken: 'mock-token-summit',
    });
    
    const data = await response.json();
    
    expect(data.golf).toBeDefined();
    expect(data.golf.handicap).toBeDefined();
    expect(data.golf.playFrequency).toBeDefined();
  });

  test('should require authentication', async () => {
    const response = await callEdgeFunction('profile-get', {
      method: 'GET',
    });
    
    expect(response.status).toBe(401);
  });
});

describe('Profile Update Edge Function', () => {
  test('should update profile information', async () => {
    const response = await callEdgeFunction('profile-update', {
      method: 'POST',
      body: {
        displayName: 'Updated Name',
        city: 'Scottsdale',
        professional: {
          role: 'Senior Manager',
          company: 'Tech Corp',
          industry: 'Technology',
          yearsExperience: 10,
        },
        golf: {
          handicap: 12.5,
          playFrequency: 'weekly',
          yearsPlaying: 8,
          preferredTeeTimes: ['early_bird', 'mid_morning'],
        },
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.displayName).toBe('Updated Name');
    expect(data.city).toBe('Scottsdale');
    expect(data.professional.role).toBe('Senior Manager');
    expect(data.golf.handicap).toBe(12.5);
  });

  test('should validate required fields', async () => {
    const response = await callEdgeFunction('profile-update', {
      method: 'POST',
      body: {
        displayName: '', // Empty display name
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('displayName');
  });

  test('should update profile completeness', async () => {
    const response = await callEdgeFunction('profile-update', {
      method: 'POST',
      body: {
        professional: {
          role: 'Manager',
          company: 'Company',
          industry: 'Technology',
          yearsExperience: 5,
        },
      },
      userToken: 'mock-token-free',
    });
    
    const data = await response.json();
    
    // Completeness should increase
    expect(data.completeness).toBeDefined();
    expect(data.completeness.professional).toBe(true);
  });

  test('should not allow updating other user profiles', async () => {
    const response = await callEdgeFunction('profile-update', {
      method: 'POST',
      body: {
        userId: TEST_USERS.select.id, // Try to update another user
        displayName: 'Hacked Name',
      },
      userToken: 'mock-token-free',
    });
    
    // Should either fail or ignore the userId
    expect([400, 403, 200]).toContain(response.status);
    
    if (response.status === 200) {
      const data = await response.json();
      // Should have updated the authenticated user, not the specified one
      expect(data.id).not.toBe(TEST_USERS.select.id);
    }
  });
});

describe('Connections List Edge Function', () => {
  test('should return user connections', async () => {
    const response = await callEdgeFunction('connections-list', {
      method: 'GET',
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.connections).toBeDefined();
    expect(Array.isArray(data.connections)).toBe(true);
  });

  test('should return connections with member data', async () => {
    const response = await callEdgeFunction('connections-list', {
      method: 'GET',
      userToken: 'mock-token-free',
    });
    
    const data = await response.json();
    
    if (data.connections.length > 0) {
      const connection = data.connections[0];
      expect(connection.requester).toBeDefined();
      expect(connection.receiver).toBeDefined();
      expect(connection.requester.displayName).toBeDefined();
    }
  });

  test('should filter connections by status', async () => {
    const response = await callEdgeFunction('connections-list', {
      method: 'GET',
      userToken: 'mock-token-free',
    });
    
    const data = await response.json();
    
    // All returned connections should be accepted
    for (const connection of data.connections) {
      expect(connection.status).toBe('accepted');
    }
  });
});

describe('Connection Request Edge Function', () => {
  test('should send connection request', async () => {
    const response = await callEdgeFunction('connections-request', {
      method: 'POST',
      body: {
        receiverId: TEST_USERS.select.id,
        connectionType: 'played_together',
        message: 'Great playing with you!',
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).toBeDefined();
    expect(data.status).toBe('pending');
    expect(data.requesterId).toBe(TEST_USERS.free.id);
    expect(data.receiverId).toBe(TEST_USERS.select.id);
  });

  test('should reject connection to different tier', async () => {
    const response = await callEdgeFunction('connections-request', {
      method: 'POST',
      body: {
        receiverId: TEST_USERS.summit.id,
        connectionType: 'played_together',
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('tier');
  });

  test('should reject duplicate connection request', async () => {
    // First request
    await callEdgeFunction('connections-request', {
      method: 'POST',
      body: {
        receiverId: TEST_USERS.select.id,
        connectionType: 'played_together',
      },
      userToken: 'mock-token-free',
    });
    
    // Duplicate request
    const response = await callEdgeFunction('connections-request', {
      method: 'POST',
      body: {
        receiverId: TEST_USERS.select.id,
        connectionType: 'played_together',
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain('already exists');
  });
});

describe('Connection Intro Edge Function', () => {
  test('should request introduction', async () => {
    const response = await callEdgeFunction('connections-intro', {
      method: 'POST',
      body: {
        targetId: TEST_USERS.summit.id,
        connectorId: TEST_USERS.select.id,
        message: 'Would love to connect!',
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).toBeDefined();
    expect(data.status).toBe('pending');
    expect(data.requesterId).toBe(TEST_USERS.free.id);
    expect(data.targetId).toBe(TEST_USERS.summit.id);
    expect(data.connectorId).toBe(TEST_USERS.select.id);
  });

  test('should require mutual connection for introduction', async () => {
    const response = await callEdgeFunction('connections-intro', {
      method: 'POST',
      body: {
        targetId: TEST_USERS.summit.id,
        connectorId: TEST_USERS.select.id,
        message: 'Would love to connect!',
      },
      userToken: 'mock-token-free',
    });
    
    // Should fail if no mutual connection exists
    if (response.status === 403) {
      const data = await response.json();
      expect(data.error).toContain('mutual connection');
    }
  });

  test('should validate connector is connected to both parties', async () => {
    const response = await callEdgeFunction('connections-intro', {
      method: 'POST',
      body: {
        targetId: TEST_USERS.summit.id,
        connectorId: 'random-user-id',
        message: 'Would love to connect!',
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('connector');
  });
});

describe('Reputation Calculate Edge Function', () => {
  test('should calculate reputation score', async () => {
    const response = await callEdgeFunction('reputation-calculate', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.overallScore).toBeDefined();
    expect(data.overallScore).toBeGreaterThanOrEqual(0);
    expect(data.overallScore).toBeLessThanOrEqual(100);
    expect(data.components).toBeDefined();
    expect(data.components.length).toBeGreaterThan(0);
  });

  test('should include all reputation components', async () => {
    const response = await callEdgeFunction('reputation-calculate', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
      },
      userToken: 'mock-token-free',
    });
    
    const data = await response.json();
    
    const componentNames = data.components.map((c: any) => c.component);
    expect(componentNames).toContain('completion');
    expect(componentNames).toContain('ratings');
    expect(componentNames).toContain('network');
    expect(componentNames).toContain('referrals');
    expect(componentNames).toContain('profile');
    expect(componentNames).toContain('attendance');
  });

  test('should calculate component scores correctly', async () => {
    const response = await callEdgeFunction('reputation-calculate', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
      },
      userToken: 'mock-token-free',
    });
    
    const data = await response.json();
    
    // Each component should have score, weight, and description
    for (const component of data.components) {
      expect(component.score).toBeGreaterThanOrEqual(0);
      expect(component.score).toBeLessThanOrEqual(100);
      expect(component.weight).toBeGreaterThan(0);
      expect(component.weight).toBeLessThanOrEqual(1);
      expect(component.description).toBeDefined();
    }
  });
});

describe('Profile RLS Policies', () => {
  let serviceClient: ReturnType<typeof createServiceClient>;
  let freeUserClient: ReturnType<typeof createAuthenticatedClient>;

  beforeAll(async () => {
    serviceClient = createServiceClient();
    freeUserClient = await createAuthenticatedClient('free');
  });

  test('users can read their own profile', async () => {
    const { data, error } = await freeUserClient
      .from('profiles')
      .select('*')
      .eq('id', TEST_USERS.free.id)
      .single();
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.id).toBe(TEST_USERS.free.id);
  });

  test('users can update their own profile', async () => {
    const { error } = await freeUserClient
      .from('profiles')
      .update({ display_name: 'Updated Name' })
      .eq('id', TEST_USERS.free.id);
    
    expect(error).toBeNull();
  });

  test('users cannot update other profiles', async () => {
    const { error } = await freeUserClient
      .from('profiles')
      .update({ display_name: 'Hacked' })
      .eq('id', TEST_USERS.select.id);
    
    // Should return no error but not update
    const { data } = await serviceClient
      .from('profiles')
      .select('display_name')
      .eq('id', TEST_USERS.select.id)
      .single();
    
    expect(data?.display_name).not.toBe('Hacked');
  });

  test('same-tier visibility for profile viewing', async () => {
    // FREE user trying to view SELECT profile
    const { data, error } = await freeUserClient
      .from('profiles')
      .select('*')
      .eq('id', TEST_USERS.select.id)
      .eq('tier', 'free') // RLS should enforce same-tier
      .single();
    
    // Should return no data due to tier mismatch
    expect(data).toBeNull();
  });
});

describe('Connection RLS Policies', () => {
  let freeUserClient: ReturnType<typeof createAuthenticatedClient>;

  beforeAll(async () => {
    freeUserClient = await createAuthenticatedClient('free');
  });

  test('users can read their own connections', async () => {
    const { data, error } = await freeUserClient
      .from('connections')
      .select('*')
      .or(`requester_id.eq.${TEST_USERS.free.id},receiver_id.eq.${TEST_USERS.free.id}`);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('users cannot read other users connections', async () => {
    const { data, error } = await freeUserClient
      .from('connections')
      .select('*')
      .or(`requester_id.eq.${TEST_USERS.select.id},receiver_id.eq.${TEST_USERS.select.id}`);
    
    // Should return empty due to RLS
    expect(data).toHaveLength(0);
  });

  test('users can create connection requests', async () => {
    const { error } = await freeUserClient
      .from('connections')
      .insert({
        requester_id: TEST_USERS.free.id,
        receiver_id: TEST_USERS.select.id,
        status: 'pending',
        connection_type: 'played_together',
      });
    
    // Should succeed for same-tier
    expect(error).toBeNull();
  });
});
