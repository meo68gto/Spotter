import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client factory for API tests
 * Creates authenticated clients for different test users
 */

const supabaseUrl = process.env.SUPABASE_TEST_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.SUPABASE_TEST_ANON_KEY || 'test-key';
const supabaseServiceKey = process.env.SUPABASE_TEST_SERVICE_KEY || 'test-service-key';

// Test user configurations
export const TEST_USERS = {
  free: {
    id: process.env.TEST_USER_FREE_ID || '00000000-0000-0000-0000-000000000001',
    email: 'test-free@spotter.local',
    tier: 'free' as const,
  },
  select: {
    id: process.env.TEST_USER_SELECT_ID || '00000000-0000-0000-0000-000000000002',
    email: 'test-select@spotter.local',
    tier: 'select' as const,
  },
  summit: {
    id: process.env.TEST_USER_SUMMIT_ID || '00000000-0000-0000-0000-000000000003',
    email: 'test-summit@spotter.local',
    tier: 'summit' as const,
  },
};

// Test organizer configurations
export const TEST_ORGANIZERS = {
  bronze: {
    id: process.env.TEST_ORG_BRONZE_ID || '00000000-0000-0000-0000-000000000010',
    email: 'org-bronze@spotter.local',
    tier: 'bronze' as const,
  },
  silver: {
    id: process.env.TEST_ORG_SILVER_ID || '00000000-0000-0000-0000-000000000011',
    email: 'org-silver@spotter.local',
    tier: 'silver' as const,
  },
  gold: {
    id: process.env.TEST_ORG_GOLD_ID || '00000000-0000-0000-0000-000000000012',
    email: 'org-gold@spotter.local',
    tier: 'gold' as const,
  },
};

/**
 * Create an anonymous Supabase client
 */
export function createAnonymousClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a service role Supabase client (bypasses RLS)
 */
export function createServiceClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create an authenticated client for a specific test user
 * In real tests, this would authenticate with actual JWT
 */
export async function createAuthenticatedClient(
  userType: 'free' | 'select' | 'summit'
): Promise<SupabaseClient> {
  const client = createAnonymousClient();
  
  // Mock authentication for testing
  // In production, this would use actual sign-in
  const user = TEST_USERS[userType];
  
  // Set auth token with user claims
  await client.auth.setSession({
    access_token: `mock-token-${userType}`,
    refresh_token: 'mock-refresh',
  });
  
  return client;
}

/**
 * Create an authenticated client for an organizer
 */
export async function createOrganizerClient(
  tier: 'bronze' | 'silver' | 'gold'
): Promise<SupabaseClient> {
  const client = createAnonymousClient();
  const organizer = TEST_ORGANIZERS[tier];
  
  await client.auth.setSession({
    access_token: `mock-token-org-${tier}`,
    refresh_token: 'mock-refresh',
  });
  
  return client;
}

/**
 * Edge function caller
 */
export async function callEdgeFunction(
  functionName: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    userToken?: string;
  } = {}
): Promise<Response> {
  const baseUrl = process.env.EDGE_FUNCTION_BASE_URL || 'http://localhost:54321/functions/v1';
  const { method = 'POST', body, headers = {}, userToken } = options;
  
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  if (userToken) {
    requestHeaders['Authorization'] = `Bearer ${userToken}`;
  }
  
  return fetch(`${baseUrl}/${functionName}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Wait for database operation to complete
 */
export async function waitForDbOperation(
  operation: () => Promise<unknown>,
  timeout = 5000
): Promise<unknown> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await operation();
      if (result !== null && result !== undefined) {
        return result;
      }
    } catch (error) {
      // Continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  throw new Error('Database operation timed out');
}
