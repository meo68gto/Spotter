import { test, expect } from '@playwright/test';
import { TierSlug } from '../../packages/types/src/tier';

/**
 * Same-Tier Visibility E2E Tests
 * 
 * Validates that users can only see content from members in their same tier:
 * - FREE users see only FREE tier members
 * - SELECT users see only SELECT tier members
 * - SUMMIT users see only SUMMIT tier members
 * 
 * This applies to:
 * - Member directory/search
 * - Matching candidates
 * - Event participants
 * - Leaderboards
 * - Activity feeds
 */

interface TestUser {
  id: string;
  name: string;
  tier: TierSlug;
  visibleTo: TierSlug[];
}

// Test data representing users across different tiers
const testUsers: TestUser[] = [
  { id: 'user-free-1', name: 'Alice (Free)', tier: 'free', visibleTo: ['free'] },
  { id: 'user-free-2', name: 'Bob (Free)', tier: 'free', visibleTo: ['free'] },
  { id: 'user-select-1', name: 'Carol (Select)', tier: 'select', visibleTo: ['select'] },
  { id: 'user-select-2', name: 'Dave (Select)', tier: 'select', visibleTo: ['select'] },
  { id: 'user-summit-1', name: 'Eve (Summit)', tier: 'summit', visibleTo: ['summit'] },
  { id: 'user-summit-2', name: 'Frank (Summit)', tier: 'summit', visibleTo: ['summit'] },
];

test.describe('Member Directory Same-Tier Visibility', () => {
  test('FREE tier user should only see FREE tier members in directory', async ({ page }) => {
    await page.goto('/members');
    
    // Wait for directory to load
    await page.waitForSelector('[data-testid="member-directory-list"]');
    
    // Get all visible member cards
    const memberCards = page.locator('[data-testid="member-card"]');
    const count = await memberCards.count();
    
    // Verify all visible members are FREE tier
    for (let i = 0; i < count; i++) {
      const tierBadge = memberCards.nth(i).locator('[data-testid="member-tier-badge"]');
      await expect(tierBadge).toHaveText('Free');
    }
    
    // Verify SELECT and SUMMIT members are not visible
    await expect(page.getByText('Carol (Select)')).toBeHidden();
    await expect(page.getByText('Eve (Summit)')).toBeHidden();
  });

  test('SELECT tier user should only see SELECT tier members in directory', async ({ page }) => {
    await page.goto('/members');
    
    await page.waitForSelector('[data-testid="member-directory-list"]');
    
    const memberCards = page.locator('[data-testid="member-card"]');
    const count = await memberCards.count();
    
    for (let i = 0; i < count; i++) {
      const tierBadge = memberCards.nth(i).locator('[data-testid="member-tier-badge"]');
      await expect(tierBadge).toHaveText('Select');
    }
    
    // Verify FREE and SUMMIT members are not visible
    await expect(page.getByText('Alice (Free)')).toBeHidden();
    await expect(page.getByText('Eve (Summit)')).toBeHidden();
  });

  test('SUMMIT tier user should only see SUMMIT tier members in directory', async ({ page }) => {
    await page.goto('/members');
    
    await page.waitForSelector('[data-testid="member-directory-list"]');
    
    const memberCards = page.locator('[data-testid="member-card"]');
    const count = await memberCards.count();
    
    for (let i = 0; i < count; i++) {
      const tierBadge = memberCards.nth(i).locator('[data-testid="member-tier-badge"]');
      await expect(tierBadge).toHaveText('Summit');
    }
    
    // Verify FREE and SELECT members are not visible
    await expect(page.getByText('Alice (Free)')).toBeHidden();
    await expect(page.getByText('Carol (Select)')).toBeHidden();
  });
});

test.describe('Matching Candidates Same-Tier Visibility', () => {
  test('FREE tier user should only be matched with FREE tier candidates', async ({ page }) => {
    await page.goto('/matching');
    
    // Wait for candidates to load
    await page.waitForSelector('[data-testid="matching-candidate-card"]');
    
    const candidateCards = page.locator('[data-testid="matching-candidate-card"]');
    const count = await candidateCards.count();
    expect(count).toBeGreaterThan(0);
    
    // Verify all candidates are FREE tier
    for (let i = 0; i < count; i++) {
      const tierBadge = candidateCards.nth(i).locator('[data-testid="candidate-tier-badge"]');
      await expect(tierBadge).toHaveText('Free');
    }
  });

  test('SELECT tier user should only be matched with SELECT tier candidates', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="matching-candidate-card"]');
    
    const candidateCards = page.locator('[data-testid="matching-candidate-card"]');
    const count = await candidateCards.count();
    
    for (let i = 0; i < count; i++) {
      const tierBadge = candidateCards.nth(i).locator('[data-testid="candidate-tier-badge"]');
      await expect(tierBadge).toHaveText('Select');
    }
  });

  test('SUMMIT tier user should only be matched with SUMMIT tier candidates', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="matching-candidate-card"]');
    
    const candidateCards = page.locator('[data-testid="matching-candidate-card"]');
    const count = await candidateCards.count();
    
    for (let i = 0; i < count; i++) {
      const tierBadge = candidateCards.nth(i).locator('[data-testid="candidate-tier-badge"]');
      await expect(tierBadge).toHaveText('Summit');
    }
  });

  test('matching algorithm should filter by tier', async ({ page }) => {
    await page.goto('/matching');
    
    // Check that the API request includes tier filter
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/matching-candidates') && response.status() === 200
    );
    
    await page.getByTestId('refresh-candidates-button').click();
    
    const response = await responsePromise;
    const data = await response.json();
    
    // Verify all returned candidates have the same tier as the current user
    const currentUserTier = await page.evaluate(() => {
      return (window as any).__USER_TIER__;
    });
    
    for (const candidate of data.candidates) {
      expect(candidate.tier).toBe(currentUserTier);
    }
  });
});

test.describe('Event Participants Same-Tier Visibility', () => {
  test('event should only show participants from same tier', async ({ page }) => {
    await page.goto('/events/event-123');
    
    // Navigate to participants tab
    await page.getByTestId('participants-tab').click();
    
    await page.waitForSelector('[data-testid="participant-list"]');
    
    const participants = page.locator('[data-testid="participant-item"]');
    const count = await participants.count();
    
    // Get current user tier
    const currentTier = await page.evaluate(() => (window as any).__USER_TIER__);
    
    for (let i = 0; i < count; i++) {
      const tierBadge = participants.nth(i).locator('[data-testid="participant-tier-badge"]');
      const tierText = await tierBadge.textContent();
      expect(tierText?.toLowerCase()).toBe(currentTier);
    }
  });

  test('event registration should validate tier compatibility', async ({ page }) => {
    // Try to register for an event with different tier targeting
    await page.goto('/events/select-tier-event');
    
    const registerButton = page.getByTestId('register-button');
    await expect(registerButton).toBeDisabled();
    
    const tierWarning = page.getByTestId('tier-mismatch-warning');
    await expect(tierWarning).toBeVisible();
    await expect(tierWarning).toContainText('This event is for Select members');
  });
});

test.describe('Leaderboard Same-Tier Visibility', () => {
  test('leaderboard should only show same-tier members', async ({ page }) => {
    await page.goto('/leaderboard');
    
    await page.waitForSelector('[data-testid="leaderboard-list"]');
    
    const leaderboardEntries = page.locator('[data-testid="leaderboard-entry"]');
    const count = await leaderboardEntries.count();
    
    const currentTier = await page.evaluate(() => (window as any).__USER_TIER__);
    
    for (let i = 0; i < count; i++) {
      const tierBadge = leaderboardEntries.nth(i).locator('[data-testid="entry-tier-badge"]');
      const tierText = await tierBadge.textContent();
      expect(tierText?.toLowerCase()).toBe(currentTier);
    }
  });

  test('tier filter should be applied to leaderboard API', async ({ page }) => {
    // Monitor API requests
    const apiRequestPromise = page.waitForRequest(
      request => request.url().includes('/leaderboard') && request.method() === 'GET'
    );
    
    await page.goto('/leaderboard');
    
    const request = await apiRequestPromise;
    const url = new URL(request.url());
    
    // Verify tier filter is in query params
    expect(url.searchParams.get('tier')).toBeTruthy();
  });
});

test.describe('Activity Feed Same-Tier Visibility', () => {
  test('activity feed should only show same-tier activities', async ({ page }) => {
    await page.goto('/feed');
    
    await page.waitForSelector('[data-testid="activity-feed"]');
    
    const activities = page.locator('[data-testid="activity-item"]');
    const count = await activities.count();
    
    const currentTier = await page.evaluate(() => (window as any).__USER_TIER__);
    
    for (let i = 0; i < count; i++) {
      const tierIndicator = activities.nth(i).locator('[data-testid="activity-tier"]');
      if (await tierIndicator.isVisible()) {
        const tierText = await tierIndicator.textContent();
        expect(tierText?.toLowerCase()).toBe(currentTier);
      }
    }
  });

  test('cross-tier activities should be filtered out', async ({ page }) => {
    await page.goto('/feed');
    
    // Activities from other tiers should not appear
    await expect(page.locator('[data-testid="activity-item"][data-tier="free"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="activity-item"][data-tier="select"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="activity-item"][data-tier="summit"]')).toHaveCount(0);
    
    // Only current tier activities should be visible
    const currentTier = await page.evaluate(() => (window as any).__USER_TIER__);
    const visibleActivities = page.locator(`[data-testid="activity-item"][data-tier="${currentTier}"]`);
    await expect(visibleActivities).toHaveCountGreaterThan(0);
  });
});

test.describe('Search Same-Tier Visibility', () => {
  test('search results should only include same-tier members', async ({ page }) => {
    await page.goto('/search');
    
    // Perform a search
    await page.getByTestId('search-input').fill('golf');
    await page.getByTestId('search-button').click();
    
    await page.waitForSelector('[data-testid="search-results"]');
    
    const results = page.locator('[data-testid="search-result-item"]');
    const count = await results.count();
    
    const currentTier = await page.evaluate(() => (window as any).__USER_TIER__);
    
    for (let i = 0; i < count; i++) {
      const result = results.nth(i);
      const type = await result.getAttribute('data-result-type');
      
      if (type === 'member') {
        const tierBadge = result.locator('[data-testid="result-tier-badge"]');
        const tierText = await tierBadge.textContent();
        expect(tierText?.toLowerCase()).toBe(currentTier);
      }
    }
  });

  test('search API should include tier filter', async ({ page }) => {
    const apiRequestPromise = page.waitForRequest(
      request => request.url().includes('/search') && request.method() === 'GET'
    );
    
    await page.goto('/search');
    await page.getByTestId('search-input').fill('test');
    await page.getByTestId('search-button').click();
    
    const request = await apiRequestPromise;
    const url = new URL(request.url());
    
    // Verify tier filter is applied
    expect(url.searchParams.get('tier')).toBeTruthy();
  });
});

test.describe('Profile View Same-Tier Visibility', () => {
  test('should not be able to view profiles of different tier members', async ({ page }) => {
    // Try to navigate to a SELECT tier profile as FREE user
    await page.goto('/profile/user-select-1');
    
    // Should see access denied or be redirected
    await expect(page.getByTestId('access-denied')).toBeVisible();
    await expect(page.getByTestId('profile-content')).toBeHidden();
  });

  test('should be able to view profiles of same tier members', async ({ page }) => {
    // Navigate to a same-tier profile
    await page.goto('/profile/user-free-2');
    
    await expect(page.getByTestId('profile-content')).toBeVisible();
    await expect(page.getByTestId('access-denied')).toBeHidden();
  });

  test('profile API should enforce tier visibility', async ({ page }) => {
    // Attempt to fetch a different tier profile via API
    const response = await page.request.get('/api/profile/user-select-1');
    
    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('tier');
  });
});

test.describe('Connection Requests Same-Tier Visibility', () => {
  test('should only be able to send connections to same-tier members', async ({ page }) => {
    await page.goto('/members/user-select-1');
    
    // Connect button should be disabled or hidden for different tier
    const connectButton = page.getByTestId('send-connection-button');
    await expect(connectButton).toBeHidden();
    
    // Should see tier mismatch message
    const tierMessage = page.getByTestId('tier-mismatch-message');
    await expect(tierMessage).toBeVisible();
    await expect(tierMessage).toContainText('can only connect with Select members');
  });

  test('should be able to send connections to same-tier members', async ({ page }) => {
    await page.goto('/members/user-free-2');
    
    const connectButton = page.getByTestId('send-connection-button');
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });
});

test.describe('Tier Visibility Edge Cases', () => {
  test('should handle tier changes gracefully', async ({ page }) => {
    // Simulate tier upgrade
    await page.evaluate(() => {
      (window as any).__USER_TIER__ = 'select';
    });
    
    // Refresh the page
    await page.reload();
    
    // Should now see SELECT tier content
    await page.goto('/members');
    const memberCards = page.locator('[data-testid="member-card"]');
    const tierBadge = memberCards.first().locator('[data-testid="member-tier-badge"]');
    await expect(tierBadge).toHaveText('Select');
  });

  test('should handle expired tier subscriptions', async ({ page }) => {
    // Simulate expired subscription (downgrade to FREE)
    await page.evaluate(() => {
      (window as any).__USER_TIER__ = 'free';
      (window as any).__TIER_STATUS__ = 'expired';
    });
    
    await page.reload();
    
    // Should see FREE tier content only
    await page.goto('/members');
    await expect(page.getByText('Carol (Select)')).toBeHidden();
  });

  test('should show appropriate messaging for tier restrictions', async ({ page }) => {
    await page.goto('/members/user-select-1');
    
    const restrictionMessage = page.getByTestId('tier-restriction-message');
    await expect(restrictionMessage).toBeVisible();
    await expect(restrictionMessage).toContainText('Upgrade to Select');
  });
});
