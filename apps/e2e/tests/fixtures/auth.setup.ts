import { test as setup, expect } from '@playwright/test';
import { TierSlug } from '../../../packages/types/src/tier';
import { OrganizerTier } from '../../../packages/types/src/organizer';

const authFile = 'playwright/.auth/user.json';

/**
 * Authentication setup for E2E tests
 * Creates authenticated sessions for all test user types
 */

interface TestUser {
  email: string;
  password: string;
  tier: TierSlug | OrganizerTier;
  type: 'member' | 'organizer';
}

const testUsers: TestUser[] = [
  // Member tiers
  {
    email: process.env.TEST_USER_FREE_EMAIL || 'test-free@spotter.local',
    password: process.env.TEST_USER_FREE_PASSWORD || 'TestFree123!',
    tier: 'free',
    type: 'member',
  },
  {
    email: process.env.TEST_USER_SELECT_EMAIL || 'test-select@spotter.local',
    password: process.env.TEST_USER_SELECT_PASSWORD || 'TestSelect123!',
    tier: 'select',
    type: 'member',
  },
  {
    email: process.env.TEST_USER_SUMMIT_EMAIL || 'test-summit@spotter.local',
    password: process.env.TEST_USER_SUMMIT_PASSWORD || 'TestSummit123!',
    tier: 'summit',
    type: 'member',
  },
  // Organizer tiers
  {
    email: process.env.TEST_ORG_BRONZE_EMAIL || 'org-bronze@spotter.local',
    password: process.env.TEST_ORG_BRONZE_PASSWORD || 'OrgBronze123!',
    tier: 'bronze',
    type: 'organizer',
  },
  {
    email: process.env.TEST_ORG_SILVER_EMAIL || 'org-silver@spotter.local',
    password: process.env.TEST_ORG_SILVER_PASSWORD || 'OrgSilver123!',
    tier: 'silver',
    type: 'organizer',
  },
  {
    email: process.env.TEST_ORG_GOLD_EMAIL || 'org-gold@spotter.local',
    password: process.env.TEST_ORG_GOLD_PASSWORD || 'OrgGold123!',
    tier: 'gold',
    type: 'organizer',
  },
];

setup.describe('Authentication Setup', () => {
  for (const user of testUsers) {
    setup(`authenticate ${user.type} - ${user.tier}`, async ({ page }) => {
      // Navigate to login page
      await page.goto('/login');
      
      // Fill in credentials
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Password').fill(user.password);
      
      // Click login button
      await page.getByRole('button', { name: 'Sign In' }).click();
      
      // Wait for navigation to dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 });
      
      // Verify we're logged in by checking for user menu or dashboard element
      await expect(page.getByTestId('user-menu') || page.getByTestId('dashboard-header')).toBeVisible();
      
      // Save authentication state
      await page.context().storageState({ path: `playwright/.auth/${user.type}-${user.tier}.json` });
    });
  }
});

// Default auth file for general tests
setup('authenticate default user', async ({ page }) => {
  const defaultUser = testUsers[0]; // FREE tier user
  
  await page.goto('/login');
  await page.getByLabel('Email').fill(defaultUser.email);
  await page.getByLabel('Password').fill(defaultUser.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/dashboard', { timeout: 10000 });
  
  await page.context().storageState({ path: authFile });
});
