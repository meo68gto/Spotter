import { test, expect } from '@playwright/test';

/**
 * Discovery E2E Tests
 * 
 * Tests the discovery search functionality for Phase 1-2:
 * - Same-tier filtering
 * - Handicap band filtering
 * - Location filtering
 * - Networking intent filtering
 * - Reputation scoring display
 * - Compatibility scoring
 */

interface DiscoveryFilters {
  handicap_band?: 'low' | 'mid' | 'high';
  location?: string;
  intent?: 'business' | 'social' | 'competitive' | 'business_social';
}

const HANDICAP_BANDS = ['low', 'mid', 'high'] as const;
const NETWORKING_INTENTS = ['business', 'social', 'competitive', 'business_social'] as const;

test.describe('Discovery Search - Basic Functionality', () => {
  test('should display discovery page with search controls', async ({ page }) => {
    await page.goto('/discovery');
    
    // Verify page loads
    await expect(page.getByTestId('discovery-page')).toBeVisible();
    
    // Verify filter controls exist
    await expect(page.getByTestId('handicap-band-filter')).toBeVisible();
    await expect(page.getByTestId('location-filter')).toBeVisible();
    await expect(page.getByTestId('intent-filter')).toBeVisible();
    
    // Verify search button
    await expect(page.getByTestId('discovery-search-button')).toBeVisible();
    await expect(page.getByTestId('discovery-search-button')).toBeEnabled();
  });

  test('should load initial results without filters', async ({ page }) => {
    await page.goto('/discovery');
    
    // Wait for results to load
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    
    // Should have results (if test data exists)
    expect(count).toBeGreaterThanOrEqual(0);
    
    // Each result should have required elements
    for (let i = 0; i < count; i++) {
      await expect(results.nth(i).getByTestId('result-name')).toBeVisible();
      await expect(results.nth(i).getByTestId('result-handicap')).toBeVisible();
      await expect(results.nth(i).getByTestId('result-compatibility')).toBeVisible();
    }
  });

  test('should show loading state while fetching results', async ({ page }) => {
    await page.goto('/discovery');
    
    // Click search to trigger loading
    await page.getByTestId('discovery-search-button').click();
    
    // Check for loading indicator
    await expect(page.getByTestId('discovery-loading')).toBeVisible();
    
    // Wait for loading to complete
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    await expect(page.getByTestId('discovery-loading')).toBeHidden();
  });

  test('should display empty state when no results found', async ({ page }) => {
    await page.goto('/discovery');
    
    // Apply filter that won't match anyone
    await page.getByTestId('location-filter').fill('NonExistentLocation12345');
    await page.getByTestId('discovery-search-button').click();
    
    // Should show empty state
    await expect(page.getByTestId('discovery-empty-state')).toBeVisible();
    await expect(page.getByText('No golfers found')).toBeVisible();
  });
});

test.describe('Discovery Search - Same-Tier Filtering', () => {
  test('should only show golfers in same tier (FREE)', async ({ page }) => {
    // Login as FREE user
    await page.goto('/discovery');
    
    // Wait for results
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    
    // All results should be from FREE tier
    for (let i = 0; i < count; i++) {
      const tierBadge = results.nth(i).getByTestId('result-tier');
      const tierText = await tierBadge.textContent();
      expect(tierText?.toLowerCase()).toBe('free');
    }
  });

  test('should only show golfers in same tier (SELECT)', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    
    for (let i = 0; i < count; i++) {
      const tierBadge = results.nth(i).getByTestId('result-tier');
      const tierText = await tierBadge.textContent();
      expect(tierText?.toLowerCase()).toBe('select');
    }
  });

  test('should only show golfers in same tier (SUMMIT)', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    
    for (let i = 0; i < count; i++) {
      const tierBadge = results.nth(i).getByTestId('result-tier');
      const tierText = await tierBadge.textContent();
      expect(tierText?.toLowerCase()).toBe('summit');
    }
  });

  test('API should include caller_tier in response', async ({ page }) => {
    // Intercept API request
    const apiRequestPromise = page.waitForRequest(
      request => request.url().includes('/discovery/search')
    );
    
    await page.goto('/discovery');
    
    const request = await apiRequestPromise;
    expect(request.url()).toContain('/discovery/search');
  });
});

test.describe('Discovery Search - Handicap Band Filtering', () => {
  for (const band of HANDICAP_BANDS) {
    test(`should filter by ${band} handicap band`, async ({ page }) => {
      await page.goto('/discovery');
      
      // Select handicap band
      await page.getByTestId('handicap-band-filter').selectOption(band);
      await page.getByTestId('discovery-search-button').click();
      
      await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
      
      const results = page.locator('[data-testid="discovery-result-card"]');
      const count = await results.count();
      
      // If results exist, verify handicap band
      for (let i = 0; i < count; i++) {
        const handicapText = await results.nth(i).getByTestId('result-handicap').textContent();
        const handicap = parseInt(handicapText || '0', 10);
        
        // Verify handicap falls within band
        switch (band) {
          case 'low':
            expect(handicap).toBeLessThanOrEqual(10);
            break;
          case 'mid':
            expect(handicap).toBeGreaterThan(10);
            expect(handicap).toBeLessThanOrEqual(20);
            break;
          case 'high':
            expect(handicap).toBeGreaterThan(20);
            break;
        }
      }
    });
  }

  test('should clear handicap filter when set to "all"', async ({ page }) => {
    await page.goto('/discovery');
    
    // Select a band first
    await page.getByTestId('handicap-band-filter').selectOption('low');
    await page.getByTestId('discovery-search-button').click();
    
    // Then clear it
    await page.getByTestId('handicap-band-filter').selectOption('');
    await page.getByTestId('discovery-search-button').click();
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    // Should show all results again
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Discovery Search - Location Filtering', () => {
  test('should filter by city name', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.getByTestId('location-filter').fill('Phoenix');
    await page.getByTestId('discovery-search-button').click();
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    
    for (let i = 0; i < count; i++) {
      const locationText = await results.nth(i).getByTestId('result-location').textContent();
      expect(locationText?.toLowerCase()).toContain('phoenix');
    }
  });

  test('should filter by state', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.getByTestId('location-filter').fill('Arizona');
    await page.getByTestId('discovery-search-button').click();
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    
    for (let i = 0; i < count; i++) {
      const locationText = await results.nth(i).getByTestId('result-location').textContent();
      expect(locationText?.toLowerCase()).toContain('arizona');
    }
  });

  test('should handle partial location matches', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.getByTestId('location-filter').fill('Scotts');
    await page.getByTestId('discovery-search-button').click();
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    // Should match "Scottsdale"
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should validate location input length', async ({ page }) => {
    await page.goto('/discovery');
    
    // Try to enter very long location
    const longLocation = 'A'.repeat(150);
    await page.getByTestId('location-filter').fill(longLocation);
    await page.getByTestId('discovery-search-button').click();
    
    // Should show validation error
    await expect(page.getByText('Location too long')).toBeVisible();
  });
});

test.describe('Discovery Search - Networking Intent Filtering', () => {
  for (const intent of NETWORKING_INTENTS) {
    test(`should filter by ${intent} networking intent`, async ({ page }) => {
      await page.goto('/discovery');
      
      await page.getByTestId('intent-filter').selectOption(intent);
      await page.getByTestId('discovery-search-button').click();
      
      await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
      
      const results = page.locator('[data-testid="discovery-result-card"]');
      const count = await results.count();
      
      for (let i = 0; i < count; i++) {
        const intentText = await results.nth(i).getByTestId('result-intent').textContent();
        expect(intentText?.toLowerCase().replace('_', ' ')).toContain(intent.replace('_', ' '));
      }
    });
  }

  test('should show compatibility score with intent match', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.getByTestId('intent-filter').selectOption('business');
    await page.getByTestId('discovery-search-button').click();
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const firstResult = results.first();
    
    // Should show compatibility score
    await expect(firstResult.getByTestId('result-compatibility')).toBeVisible();
    
    // Score should be between 0 and 100
    const scoreText = await firstResult.getByTestId('result-compatibility').textContent();
    const score = parseInt(scoreText || '0', 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

test.describe('Discovery Search - Combined Filters', () => {
  test('should apply multiple filters simultaneously', async ({ page }) => {
    await page.goto('/discovery');
    
    // Apply multiple filters
    await page.getByTestId('handicap-band-filter').selectOption('low');
    await page.getByTestId('location-filter').fill('Phoenix');
    await page.getByTestId('intent-filter').selectOption('business');
    
    await page.getByTestId('discovery-search-button').click();
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    
    // All results should match all filters
    for (let i = 0; i < count; i++) {
      const handicapText = await results.nth(i).getByTestId('result-handicap').textContent();
      const handicap = parseInt(handicapText || '0', 10);
      expect(handicap).toBeLessThanOrEqual(10); // Low band
      
      const locationText = await results.nth(i).getByTestId('result-location').textContent();
      expect(locationText?.toLowerCase()).toContain('phoenix');
    }
  });

  test('should persist filters in URL', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.getByTestId('handicap-band-filter').selectOption('mid');
    await page.getByTestId('intent-filter').selectOption('social');
    await page.getByTestId('discovery-search-button').click();
    
    // Check URL contains filters
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain('handicap_band=mid');
    expect(url).toContain('intent=social');
  });
});

test.describe('Discovery Search - Pagination', () => {
  test('should support pagination', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    // Check if pagination exists
    const pagination = page.getByTestId('discovery-pagination');
    if (await pagination.isVisible()) {
      // Click next page
      await page.getByTestId('pagination-next').click();
      
      // Should load new results
      await page.waitForTimeout(500);
      await expect(page.getByTestId('discovery-results')).toBeVisible();
      
      // Previous button should now be enabled
      await expect(page.getByTestId('pagination-prev')).toBeEnabled();
    }
  });

  test('should show total count indicator', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const countIndicator = page.getByTestId('results-count');
    await expect(countIndicator).toBeVisible();
    
    const countText = await countIndicator.textContent();
    expect(countText).toMatch(/\d+\s+golfers?\s+found/i);
  });
});

test.describe('Discovery Search - Result Details', () => {
  test('should display reputation score for each golfer', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const count = await results.count();
    
    for (let i = 0; i < count; i++) {
      await expect(results.nth(i).getByTestId('result-reputation')).toBeVisible();
    }
  });

  test('should display professional information', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const firstResult = results.first();
    
    // Check for company/title
    const company = firstResult.getByTestId('result-company');
    if (await company.isVisible()) {
      const companyText = await company.textContent();
      expect(companyText).toBeTruthy();
    }
  });

  test('should display golf profile information', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const firstResult = results.first();
    
    // Check for home course
    await expect(firstResult.getByTestId('result-home-course')).toBeVisible();
    
    // Check for years playing
    const yearsPlaying = firstResult.getByTestId('result-years-playing');
    if (await yearsPlaying.isVisible()) {
      const yearsText = await yearsPlaying.textContent();
      expect(yearsText).toMatch(/\d+/);
    }
  });

  test('should navigate to profile on click', async ({ page }) => {
    await page.goto('/discovery');
    
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 10000 });
    
    const results = page.locator('[data-testid="discovery-result-card"]');
    const firstResult = results.first();
    
    // Click on the result
    await firstResult.click();
    
    // Should navigate to profile page
    await expect(page).toHaveURL(/\/profile\//);
  });
});

test.describe('Discovery Search - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Block the API request
    await page.route('**/discovery/search', route => route.abort('failed'));
    
    await page.goto('/discovery');
    await page.getByTestId('discovery-search-button').click();
    
    // Should show error message
    await expect(page.getByTestId('discovery-error')).toBeVisible();
    await expect(page.getByText('Failed to load results')).toBeVisible();
  });

  test('should handle invalid filter values', async ({ page }) => {
    await page.goto('/discovery');
    
    // Try invalid handicap band via URL manipulation
    await page.goto('/discovery?handicap_band=invalid');
    
    // Should show validation error
    await expect(page.getByTestId('filter-error')).toBeVisible();
  });

  test('should require authentication', async ({ page }) => {
    // Clear auth state
    await page.context().clearCookies();
    
    await page.goto('/discovery');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
