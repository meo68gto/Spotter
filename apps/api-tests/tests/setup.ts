import { config } from 'dotenv';
import path from 'path';
import { jest } from '@jest/globals';

// Load test environment variables
config({ path: path.resolve(__dirname, '../.env.test') });

// Enable mock mode for Edge Function calls — makes tests deterministic
// without requiring a live Supabase instance or Edge Function runtime.
process.env.MOCK_API_TESTS = 'true';

// ---------------------------------------------------------------------------
// Global fetch mock — returns 401 by default so "should require
// authentication" tests pass without hitting the network.
// Tests that need a different response override this in their beforeEach.
// ---------------------------------------------------------------------------

const defaultUnauthorizedResponse = {
  ok: false,
  status: 401,
  statusText: 'Unauthorized',
  json: async () => ({ error: 'Unauthorized' }),
  text: async () => '{"error":"Unauthorized"}',
  clone: function () { return this; },
  headers: new Headers({ 'content-type': 'application/json' }),
  body: null,
  bodyUsed: false,
  type: 'basic' as ResponseType,
  url: '',
  redirected: false,
} as unknown as Response;

beforeEach(() => {
  // Reset to 401 mock before each test; individual tests override as needed
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue(defaultUnauthorizedResponse) as unknown as typeof fetch;
});

// Global test setup
beforeAll(async () => {
  // Verify test environment is accessible
  const supabaseUrl = process.env.SUPABASE_TEST_URL;
  if (!supabaseUrl) {
    throw new Error('SUPABASE_TEST_URL not configured');
  }
  
  console.log(`Running API tests against: ${supabaseUrl}`);
});

// Global test teardown
afterAll(async () => {
  // Cleanup if needed
});

// Extend Jest matchers if needed
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidTier(): R;
      toHaveFeatureAccess(feature: string): R;
    }
  }
}
