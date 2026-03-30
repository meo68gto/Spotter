import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * Playwright configuration for Spotter E2E tests
 * 
 * Test tiers:
 * - FREE: Basic access, limited features
 * - SELECT: Premium features, priority matching
 * - SUMMIT: Elite features, early access, group sessions
 * 
 * Organizer tiers:
 * - Bronze: 5 events/year, basic features
 * - Silver: 20 events/year, priority support
 * - Gold: Unlimited events, API access, white-label
 */

// PR-relevant tests run on every PR: auth, discovery, rounds, onboarding
// Full browser matrix + mobile only on merge to main

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60000,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
    ...(process.env.GITHUB_TOKEN ? [['github', { category: 'E2E', token: process.env.GITHUB_TOKEN }]] : []),
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Main test projects — Chromium only for PRs
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Full browser matrix only on merge to main
    ...(process.env.CI && process.env.BRANCH_NAME === 'main' ? [
      {
        name: 'firefox',
        use: { 
          ...devices['Desktop Firefox'],
          storageState: 'playwright/.auth/user.json',
        },
        dependencies: ['setup'],
      },
      {
        name: 'webkit',
        use: { 
          ...devices['Desktop Safari'],
          storageState: 'playwright/.auth/user.json',
        },
        dependencies: ['setup'],
      },
    ] : []),
    // Mobile Chrome — only on merge to main
    ...(process.env.CI && process.env.BRANCH_NAME === 'main' ? [
      {
        name: 'Mobile Chrome',
        use: { 
          ...devices['Pixel 5'],
          storageState: 'playwright/.auth/user.json',
        },
        dependencies: ['setup'],
      },
      {
        name: 'Mobile Safari',
        use: { 
          ...devices['iPhone 12'],
          storageState: 'playwright/.auth/user.json',
        },
        dependencies: ['setup'],
      },
    ] : []),
  ],
  webServer: {
    command: 'pnpm --filter=web dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
