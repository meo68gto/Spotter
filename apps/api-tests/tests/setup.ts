import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(__dirname, '../.env.test') });

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
