import { test, expect } from '@playwright/test';

/**
 * Matching Engine E2E Tests
 * 
 * Tests the matching algorithm and suggestions for Phase 1-2:
 * - Match score calculation
 * - Top matches retrieval
 * - Same-tier filtering
 * - Compatibility factors display
 * - Match acceptance/rejection
 * - Privacy controls (open_to_intros)
 */

interface MatchFactors {
  handicap: number;
  networkingIntent: number;
  location: number;
  groupSize: number;
}

test.describe('Matching Suggestions - Basic Functionality', () => {
  test('should display matching page with suggestions', async ({ page }) => {
    await page.goto('/matching');
    
    // Verify page loads
    await expect(page.getByTestId('matching-page')).toBeVisible();
    await expect(page.getByTestId('matching-suggestions')).toBeVisible();
  });

  test('should load top matches on page load', async ({ page }) => {
    await page.goto('/matching');
    
    // Wait for matches to load
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const count = await matches.count();
    
    // Should have matches (if test data exists)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display match score for each suggestion', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const count = await matches.count();
    
    for (let i = 0; i < count; i++) {
      const scoreElement = matches.nth(i).getByTestId('match-score');
      await expect(scoreElement).toBeVisible();
      
      // Score should be between 0 and 100
      const scoreText = await scoreElement.textContent();
      const score = parseInt(scoreText || '0', 10);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test('should display match tier (excellent/good/fair/poor)', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const firstMatch = matches.first();
    
    const tierElement = firstMatch.getByTestId('match-tier');
    await expect(tierElement).toBeVisible();
    
    const tierText = await tierElement.textContent();
    expect(['excellent', 'good', 'fair', 'poor']).toContain(tierText?.toLowerCase());
  });
});

test.describe('Matching Suggestions - Same-Tier Filtering', () => {
  test('should only show matches from same tier (FREE)', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const count = await matches.count();
    
    for (let i = 0; i < count; i++) {
      const tierBadge = matches.nth(i).getByTestId('match-tier-badge');
      const tierText = await tierBadge.textContent();
      expect(tierText?.toLowerCase()).toBe('free');
    }
  });

  test('should only show matches from same tier (SELECT)', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const count = await matches.count();
    
    for (let i = 0; i < count; i++) {
      const tierBadge = matches.nth(i).getByTestId('match-tier-badge');
      const tierText = await tierBadge.textContent();
      expect(tierText?.toLowerCase()).toBe('select');
    }
  });

  test('should only show matches from same tier (SUMMIT)', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const count = await matches.count();
    
    for (let i = 0; i < count; i++) {
      const tierBadge = matches.nth(i).getByTestId('match-tier-badge');
      const tierText = await tierBadge.textContent();
      expect(tierText?.toLowerCase()).toBe('summit');
    }
  });
});

test.describe('Matching Suggestions - Compatibility Factors', () => {
  test('should display handicap similarity factor', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    // Expand factors if needed
    const expandButton = firstMatch.getByTestId('expand-factors');
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }
    
    const handicapFactor = firstMatch.getByTestId('factor-handicap');
    await expect(handicapFactor).toBeVisible();
    
    // Should show score and description
    await expect(firstMatch.getByTestId('handicap-score')).toBeVisible();
    await expect(firstMatch.getByTestId('handicap-description')).toBeVisible();
  });

  test('should display networking intent factor', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const expandButton = firstMatch.getByTestId('expand-factors');
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }
    
    await expect(firstMatch.getByTestId('factor-intent')).toBeVisible();
    await expect(firstMatch.getByTestId('intent-score')).toBeVisible();
  });

  test('should display location proximity factor', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const expandButton = firstMatch.getByTestId('expand-factors');
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }
    
    await expect(firstMatch.getByTestId('factor-location')).toBeVisible();
    await expect(firstMatch.getByTestId('location-distance')).toBeVisible();
  });

  test('should display group size compatibility factor', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const expandButton = firstMatch.getByTestId('expand-factors');
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }
    
    await expect(firstMatch.getByTestId('factor-group-size')).toBeVisible();
    await expect(firstMatch.getByTestId('group-size-score')).toBeVisible();
  });

  test('should display match reasoning', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const reasoning = firstMatch.getByTestId('match-reasoning');
    await expect(reasoning).toBeVisible();
    
    const reasoningText = await reasoning.textContent();
    expect(reasoningText).toBeTruthy();
    expect(reasoningText?.length).toBeGreaterThan(10);
  });
});

test.describe('Matching Suggestions - Match Details', () => {
  test('should display user profile information', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    // Basic info
    await expect(firstMatch.getByTestId('match-name')).toBeVisible();
    await expect(firstMatch.getByTestId('match-avatar')).toBeVisible();
    await expect(firstMatch.getByTestId('match-location')).toBeVisible();
  });

  test('should display golf information', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    await expect(firstMatch.getByTestId('match-handicap')).toBeVisible();
    await expect(firstMatch.getByTestId('match-home-course')).toBeVisible();
  });

  test('should display professional information', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const company = firstMatch.getByTestId('match-company');
    if (await company.isVisible()) {
      const companyText = await company.textContent();
      expect(companyText).toBeTruthy();
    }
    
    const title = firstMatch.getByTestId('match-title');
    if (await title.isVisible()) {
      const titleText = await title.textContent();
      expect(titleText).toBeTruthy();
    }
  });

  test('should display networking preferences', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    await expect(firstMatch.getByTestId('match-intent')).toBeVisible();
    await expect(firstMatch.getByTestId('match-preferred-group-size')).toBeVisible();
  });

  test('should display mutual connections count', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const mutualConnections = firstMatch.getByTestId('match-mutual-connections');
    await expect(mutualConnections).toBeVisible();
    
    const countText = await mutualConnections.textContent();
    expect(countText).toMatch(/\d+/);
  });

  test('should display distance between users', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const distance = firstMatch.getByTestId('match-distance');
    await expect(distance).toBeVisible();
    
    const distanceText = await distance.textContent();
    expect(distanceText).toMatch(/\d+(\.\d+)?\s*(km|mi)/i);
  });
});

test.describe('Matching Suggestions - Actions', () => {
  test('should allow sending match request', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const connectButton = firstMatch.getByTestId('send-match-request');
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
    
    await connectButton.click();
    
    // Should show confirmation
    await expect(page.getByTestId('match-request-sent')).toBeVisible();
  });

  test('should allow dismissing match', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const dismissButton = firstMatch.getByTestId('dismiss-match');
    await expect(dismissButton).toBeVisible();
    
    await dismissButton.click();
    
    // Match should be removed from list
    await expect(firstMatch).toBeHidden();
  });

  test('should navigate to profile on view profile click', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const firstMatch = page.locator('[data-testid="match-card"]').first();
    
    const viewProfileButton = firstMatch.getByTestId('view-profile');
    await viewProfileButton.click();
    
    // Should navigate to profile
    await expect(page).toHaveURL(/\/profile\//);
  });
});

test.describe('Matching Suggestions - Calculate Specific Match', () => {
  test('should calculate match with specific user', async ({ page }) => {
    // Navigate to a specific user's profile
    await page.goto('/profile/test-user-id');
    
    // Look for match score calculation
    const calculateButton = page.getByTestId('calculate-match');
    if (await calculateButton.isVisible()) {
      await calculateButton.click();
      
      // Should show match score
      await expect(page.getByTestId('match-score-display')).toBeVisible();
      
      const scoreText = await page.getByTestId('match-score-display').textContent();
      const score = parseInt(scoreText || '0', 10);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test('should show compatibility breakdown for specific match', async ({ page }) => {
    await page.goto('/profile/test-user-id');
    
    const calculateButton = page.getByTestId('calculate-match');
    if (await calculateButton.isVisible()) {
      await calculateButton.click();
      
      await expect(page.getByTestId('compatibility-breakdown')).toBeVisible();
      
      // Should show all factors
      await expect(page.getByTestId('factor-handicap')).toBeVisible();
      await expect(page.getByTestId('factor-intent')).toBeVisible();
      await expect(page.getByTestId('factor-location')).toBeVisible();
      await expect(page.getByTestId('factor-group-size')).toBeVisible();
    }
  });
});

test.describe('Matching Suggestions - Privacy Controls', () => {
  test('should only show users with open_to_intros=true', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const count = await matches.count();
    
    // All visible matches should have open_to_intros
    for (let i = 0; i < count; i++) {
      const openToIntros = matches.nth(i).getByTestId('match-open-to-intros');
      if (await openToIntros.isVisible()) {
        const isOpen = await openToIntros.getAttribute('data-open');
        expect(isOpen).toBe('true');
      }
    }
  });

  test('should not show users who opted out of matching', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    // Check that no matches have opted out
    const optedOutMatches = page.locator('[data-testid="match-card"][data-opted-out="true"]');
    await expect(optedOutMatches).toHaveCount(0);
  });
});

test.describe('Matching Suggestions - Filtering and Sorting', () => {
  test('should support minimum score filter', async ({ page }) => {
    await page.goto('/matching');
    
    // Set minimum score filter
    await page.getByTestId('min-score-filter').fill('60');
    await page.getByTestId('apply-filters').click();
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const count = await matches.count();
    
    // All matches should have score >= 60
    for (let i = 0; i < count; i++) {
      const scoreText = await matches.nth(i).getByTestId('match-score').textContent();
      const score = parseInt(scoreText || '0', 10);
      expect(score).toBeGreaterThanOrEqual(60);
    }
  });

  test('should sort by match score descending', async ({ page }) => {
    await page.goto('/matching');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const count = await matches.count();
    
    if (count >= 2) {
      const firstScoreText = await matches.first().getByTestId('match-score').textContent();
      const secondScoreText = await matches.nth(1).getByTestId('match-score').textContent();
      
      const firstScore = parseInt(firstScoreText || '0', 10);
      const secondScore = parseInt(secondScoreText || '0', 10);
      
      expect(firstScore).toBeGreaterThanOrEqual(secondScore);
    }
  });

  test('should limit number of results', async ({ page }) => {
    await page.goto('/matching?limit=5');
    
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const matches = page.locator('[data-testid="match-card"]');
    const count = await matches.count();
    
    expect(count).toBeLessThanOrEqual(5);
  });
});

test.describe('Matching Suggestions - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Block the API request
    await page.route('**/matching/suggestions', route => route.abort('failed'));
    
    await page.goto('/matching');
    
    // Should show error message
    await expect(page.getByTestId('matching-error')).toBeVisible();
    await expect(page.getByText('Failed to load matches')).toBeVisible();
  });

  test('should handle empty results', async ({ page }) => {
    // Mock empty response
    await page.route('**/matching/suggestions', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ matches: [], totalMatches: 0 })
      });
    });
    
    await page.goto('/matching');
    
    // Should show empty state
    await expect(page.getByTestId('matching-empty-state')).toBeVisible();
    await expect(page.getByText('No matches found')).toBeVisible();
  });

  test('should require authentication', async ({ page }) => {
    // Clear auth state
    await page.context().clearCookies();
    
    await page.goto('/matching');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle cross-tier match calculation error', async ({ page }) => {
    await page.goto('/profile/different-tier-user');
    
    const calculateButton = page.getByTestId('calculate-match');
    if (await calculateButton.isVisible()) {
      await calculateButton.click();
      
      // Should show tier mismatch error
      await expect(page.getByTestId('tier-mismatch-error')).toBeVisible();
      await expect(page.getByText('same tier')).toBeVisible();
    }
  });
});

test.describe('Matching Suggestions - Performance', () => {
  test('should load matches within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/matching');
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });

  test('should show loading state', async ({ page }) => {
    await page.goto('/matching');
    
    // Should show loading initially
    await expect(page.getByTestId('matching-loading')).toBeVisible();
    
    // Loading should disappear when data loads
    await page.waitForSelector('[data-testid="match-card"]', { timeout: 10000 });
    await expect(page.getByTestId('matching-loading')).toBeHidden();
  });
});
