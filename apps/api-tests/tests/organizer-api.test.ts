import { 
  createOrganizerClient,
  createServiceClient,
  callEdgeFunction,
  TEST_ORGANIZERS 
} from '../utils/supabase-client';
import { ORGANIZER_TIERS } from '../../../packages/types/src/organizer';

/**
 * Organizer API Integration Tests
 * 
 * Tests:
 * - Organizer authentication
 * - Event CRUD operations
 * - Registration management
 * - Quota enforcement
 * - API key management (Gold only)
 * - Analytics access
 */

describe('Organizer Auth Edge Function', () => {
  test('should authenticate organizer with Bronze tier', async () => {
    const response = await callEdgeFunction('organizer-auth', {
      method: 'POST',
      body: {
        email: TEST_ORGANIZERS.bronze.email,
        password: 'OrgBronze123!',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.token).toBeDefined();
    expect(data.organizer).toBeDefined();
    expect(data.organizer.tier).toBe('bronze');
  });

  test('should return organizer tier and permissions', async () => {
    const response = await callEdgeFunction('organizer-auth', {
      method: 'POST',
      body: {
        email: TEST_ORGANIZERS.gold.email,
        password: 'OrgGold123!',
      },
    });
    
    const data = await response.json();
    
    expect(data.organizer.tier).toBe('gold');
    expect(data.permissions).toBeDefined();
    expect(data.permissions.createEvents).toBe(true);
    expect(data.permissions.manageApiKeys).toBe(true);
  });

  test('should reject invalid credentials', async () => {
    const response = await callEdgeFunction('organizer-auth', {
      method: 'POST',
      body: {
        email: TEST_ORGANIZERS.bronze.email,
        password: 'wrongpassword',
      },
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Invalid credentials');
  });
});

describe('Organizer Events Edge Function', () => {
  test('should create event for Bronze tier', async () => {
    const response = await callEdgeFunction('organizer-events', {
      method: 'POST',
      body: {
        action: 'create',
        organizerId: TEST_ORGANIZERS.bronze.id,
        event: {
          title: 'Test Tournament',
          type: 'tournament',
          courseId: 'course-123',
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 172800000).toISOString(),
          maxParticipants: 50,
          isPublic: true,
        },
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).toBeDefined();
    expect(data.title).toBe('Test Tournament');
    expect(data.status).toBe('draft');
  });

  test('should enforce Bronze event limit (5/year)', async () => {
    const response = await callEdgeFunction('organizer-events', {
      method: 'POST',
      body: {
        action: 'create',
        organizerId: TEST_ORGANIZERS.bronze.id,
        event: {
          title: '6th Event',
          type: 'tournament',
          courseId: 'course-123',
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 172800000).toISOString(),
          maxParticipants: 50,
        },
        testQuotaExceeded: true,
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('event limit');
    expect(data.limit).toBe(5);
    expect(data.used).toBe(5);
  });

  test('should allow unlimited events for Gold tier', async () => {
    const response = await callEdgeFunction('organizer-events', {
      method: 'POST',
      body: {
        action: 'create',
        organizerId: TEST_ORGANIZERS.gold.id,
        event: {
          title: 'Gold Event',
          type: 'tournament',
          courseId: 'course-123',
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 172800000).toISOString(),
          maxParticipants: 100,
        },
        testQuotaExceeded: true, // Should still succeed
      },
      userToken: 'mock-token-org-gold',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBeDefined();
  });

  test('should list organizer events', async () => {
    const response = await callEdgeFunction('organizer-events', {
      method: 'GET',
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.events).toBeDefined();
    expect(Array.isArray(data.events)).toBe(true);
  });

  test('should update event', async () => {
    const response = await callEdgeFunction('organizer-events', {
      method: 'POST',
      body: {
        action: 'update',
        eventId: 'event-123',
        updates: {
          title: 'Updated Tournament Name',
          maxParticipants: 75,
        },
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.title).toBe('Updated Tournament Name');
    expect(data.maxParticipants).toBe(75);
  });

  test('should delete event', async () => {
    const response = await callEdgeFunction('organizer-events', {
      method: 'POST',
      body: {
        action: 'delete',
        eventId: 'event-123',
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

describe('Organizer Registrations Edge Function', () => {
  test('should list event registrations', async () => {
    const response = await callEdgeFunction('organizer-registrations', {
      method: 'GET',
      body: {
        eventId: 'event-123',
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.registrations).toBeDefined();
    expect(Array.isArray(data.registrations)).toBe(true);
  });

  test('should enforce Bronze registration limit (500)', async () => {
    const response = await callEdgeFunction('organizer-registrations', {
      method: 'POST',
      body: {
        action: 'create',
        eventId: 'event-123',
        registration: {
          userId: 'new-user-id',
          status: 'registered',
        },
        testQuotaExceeded: true,
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('registration limit');
    expect(data.limit).toBe(500);
  });

  test('should allow unlimited registrations for Gold tier', async () => {
    const response = await callEdgeFunction('organizer-registrations', {
      method: 'POST',
      body: {
        action: 'create',
        eventId: 'event-123',
        registration: {
          userId: 'new-user-id',
          status: 'registered',
        },
        testQuotaExceeded: true,
      },
      userToken: 'mock-token-org-gold',
    });
    
    expect(response.status).toBe(200);
  });

  test('should update registration status', async () => {
    const response = await callEdgeFunction('organizer-registrations', {
      method: 'POST',
      body: {
        action: 'update',
        registrationId: 'reg-123',
        updates: {
          status: 'confirmed',
        },
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('confirmed');
  });

  test('should check in attendee', async () => {
    const response = await callEdgeFunction('organizer-registrations', {
      method: 'POST',
      body: {
        action: 'checkin',
        registrationId: 'reg-123',
        checkedInAt: new Date().toISOString(),
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('checked_in');
  });
});

describe('Organizer Invites Edge Function', () => {
  test('should send event invite', async () => {
    const response = await callEdgeFunction('organizer-invites', {
      method: 'POST',
      body: {
        action: 'send',
        eventId: 'event-123',
        recipientEmail: 'invited@example.com',
        recipientName: 'Invited User',
        message: 'Join our tournament!',
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).toBeDefined();
    expect(data.inviteCode).toBeDefined();
    expect(data.status).toBe('pending');
  });

  test('should track invite quota', async () => {
    const response = await callEdgeFunction('organizer-invites', {
      method: 'GET',
      body: {
        organizerId: TEST_ORGANIZERS.bronze.id,
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.invitesSent).toBeDefined();
    expect(data.invitesAccepted).toBeDefined();
    expect(data.acceptanceRate).toBeDefined();
  });
});

describe('Organizer Analytics Edge Function', () => {
  test('should return basic analytics for Bronze tier', async () => {
    const response = await callEdgeFunction('organizer-analytics', {
      method: 'GET',
      body: {
        organizerId: TEST_ORGANIZERS.bronze.id,
        period: 'last_30_days',
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.registrationMetrics).toBeDefined();
    expect(data.attendanceMetrics).toBeDefined();
    
    // Bronze should not have advanced analytics
    expect(data.revenueMetrics).toBeUndefined();
  });

  test('should return advanced analytics for Silver tier', async () => {
    const response = await callEdgeFunction('organizer-analytics', {
      method: 'GET',
      body: {
        organizerId: TEST_ORGANIZERS.silver.id,
        period: 'last_30_days',
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.registrationMetrics).toBeDefined();
    expect(data.attendanceMetrics).toBeDefined();
    expect(data.revenueMetrics).toBeDefined();
    expect(data.engagementMetrics).toBeDefined();
  });

  test('should return full analytics for Gold tier', async () => {
    const response = await callEdgeFunction('organizer-analytics', {
      method: 'GET',
      body: {
        organizerId: TEST_ORGANIZERS.gold.id,
        period: 'last_30_days',
      },
      userToken: 'mock-token-org-gold',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.registrationMetrics).toBeDefined();
    expect(data.revenueMetrics).toBeDefined();
    expect(data.engagementMetrics).toBeDefined();
    
    // Gold-specific analytics
    expect(data.apiUsage).toBeDefined();
    expect(data.customReports).toBeDefined();
  });

  test('should export analytics data', async () => {
    const response = await callEdgeFunction('organizer-analytics', {
      method: 'POST',
      body: {
        action: 'export',
        organizerId: TEST_ORGANIZERS.silver.id,
        format: 'csv',
        metrics: ['registration', 'attendance'],
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.downloadUrl).toBeDefined();
    expect(data.expiresAt).toBeDefined();
  });

  test('should deny export for Bronze tier', async () => {
    const response = await callEdgeFunction('organizer-analytics', {
      method: 'POST',
      body: {
        action: 'export',
        organizerId: TEST_ORGANIZERS.bronze.id,
        format: 'csv',
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Silver tier required');
  });
});

describe('Organizer API Keys (Gold Only)', () => {
  test('Gold tier should create API key', async () => {
    const response = await callEdgeFunction('organizer-api', {
      method: 'POST',
      body: {
        action: 'create_key',
        organizerId: TEST_ORGANIZERS.gold.id,
        keyData: {
          name: 'Integration Key',
          permissions: {
            readEvents: true,
            readRegistrations: true,
          },
          rateLimitPerMinute: 100,
        },
      },
      userToken: 'mock-token-org-gold',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.id).toBeDefined();
    expect(data.keyPrefix).toBeDefined();
    expect(data.apiKey).toBeDefined(); // Full key shown once
    expect(data.permissions).toBeDefined();
  });

  test('Gold tier should list API keys', async () => {
    const response = await callEdgeFunction('organizer-api', {
      method: 'GET',
      body: {
        organizerId: TEST_ORGANIZERS.gold.id,
      },
      userToken: 'mock-token-org-gold',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.keys).toBeDefined();
    expect(Array.isArray(data.keys)).toBe(true);
  });

  test('Gold tier should revoke API key', async () => {
    const response = await callEdgeFunction('organizer-api', {
      method: 'POST',
      body: {
        action: 'revoke_key',
        organizerId: TEST_ORGANIZERS.gold.id,
        keyId: 'api-key-123',
      },
      userToken: 'mock-token-org-gold',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('Bronze tier should not access API keys', async () => {
    const response = await callEdgeFunction('organizer-api', {
      method: 'GET',
      body: {
        organizerId: TEST_ORGANIZERS.bronze.id,
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Gold tier required');
  });

  test('Silver tier should not access API keys', async () => {
    const response = await callEdgeFunction('organizer-api', {
      method: 'GET',
      body: {
        organizerId: TEST_ORGANIZERS.silver.id,
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Gold tier required');
  });
});

describe('Organizer Members Edge Function', () => {
  test('should list team members', async () => {
    const response = await callEdgeFunction('organizer-members', {
      method: 'GET',
      body: {
        organizerId: TEST_ORGANIZERS.bronze.id,
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.members).toBeDefined();
    expect(Array.isArray(data.members)).toBe(true);
  });

  test('should invite team member', async () => {
    const response = await callEdgeFunction('organizer-members', {
      method: 'POST',
      body: {
        action: 'invite',
        organizerId: TEST_ORGANIZERS.bronze.id,
        email: 'newmember@example.com',
        role: 'manager',
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.inviteId).toBeDefined();
    expect(data.status).toBe('pending');
  });

  test('should update member role', async () => {
    const response = await callEdgeFunction('organizer-members', {
      method: 'POST',
      body: {
        action: 'update_role',
        organizerId: TEST_ORGANIZERS.bronze.id,
        memberId: 'member-123',
        role: 'admin',
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.role).toBe('admin');
  });

  test('should remove team member', async () => {
    const response = await callEdgeFunction('organizer-members', {
      method: 'POST',
      body: {
        action: 'remove',
        organizerId: TEST_ORGANIZERS.bronze.id,
        memberId: 'member-123',
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

describe('Organizer Tier Definitions', () => {
  test('Bronze tier has correct limits', () => {
    const bronzeTier = ORGANIZER_TIERS.find(t => t.value === 'bronze');
    
    expect(bronzeTier).toBeDefined();
    expect(bronzeTier!.priceMonthlyCents).toBe(0);
    expect(bronzeTier!.eventsPerYear).toBe(5);
    expect(bronzeTier!.registrationsPerYear).toBe(500);
    expect(bronzeTier!.features).toContain('Up to 5 tournaments per year');
  });

  test('Silver tier has correct limits', () => {
    const silverTier = ORGANIZER_TIERS.find(t => t.value === 'silver');
    
    expect(silverTier).toBeDefined();
    expect(silverTier!.priceMonthlyCents).toBe(2999); // $29.99
    expect(silverTier!.eventsPerYear).toBe(20);
    expect(silverTier!.registrationsPerYear).toBe(2500);
    expect(silverTier!.features).toContain('Priority support');
  });

  test('Gold tier has unlimited limits', () => {
    const goldTier = ORGANIZER_TIERS.find(t => t.value === 'gold');
    
    expect(goldTier).toBeDefined();
    expect(goldTier!.priceMonthlyCents).toBe(9999); // $99.99
    expect(goldTier!.eventsPerYear).toBeNull(); // Unlimited
    expect(goldTier!.registrationsPerYear).toBeNull(); // Unlimited
    expect(goldTier!.features).toContain('API access');
    expect(goldTier!.features).toContain('White-label options');
  });
});

describe('Organizer RLS Policies', () => {
  let bronzeOrgClient: ReturnType<typeof createOrganizerClient>;
  let serviceClient: ReturnType<typeof createServiceClient>;

  beforeAll(async () => {
    bronzeOrgClient = await createOrganizerClient('bronze');
    serviceClient = createServiceClient();
  });

  test('organizers can read their own account', async () => {
    const { data, error } = await bronzeOrgClient
      .from('organizer_accounts')
      .select('*')
      .eq('id', TEST_ORGANIZERS.bronze.id)
      .single();
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.id).toBe(TEST_ORGANIZERS.bronze.id);
  });

  test('organizers can read their own events', async () => {
    const { data, error } = await bronzeOrgClient
      .from('organizer_events')
      .select('*')
      .eq('organizer_id', TEST_ORGANIZERS.bronze.id);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('organizers cannot read other organizer events', async () => {
    const { data, error } = await bronzeOrgClient
      .from('organizer_events')
      .select('*')
      .eq('organizer_id', TEST_ORGANIZERS.silver.id);
    
    // Should return empty due to RLS
    expect(data).toHaveLength(0);
  });

  test('organizers can create events within quota', async () => {
    const { error } = await bronzeOrgClient
      .from('organizer_events')
      .insert({
        organizer_id: TEST_ORGANIZERS.bronze.id,
        title: 'New Event',
        type: 'tournament',
        course_id: 'course-123',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        max_participants: 50,
        status: 'draft',
      });
    
    // Should succeed if under quota
    expect(error).toBeNull();
  });
});
