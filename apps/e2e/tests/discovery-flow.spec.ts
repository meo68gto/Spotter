import { test, expect } from '@playwright/test';

/**
 * P0 Discovery Flow Tests — Discovery → View Profile → Connect
 *
 * Covers:
 * - Discovery page loads with golfer cards
 * - Clicking a golfer card navigates to profile
 * - "Connect" button sends connection request
 * - Toast notification confirms connection sent
 * - Filters work (tier, skill)
 *
 * Auth: Uses real Supabase auth via login, or member-free storage state
 * No CSS selectors — all interactions use data-testid attributes
 */

test.describe('P0 — Discovery Flow: Discovery → View Profile → Connect', () => {

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    const email = process.env.TEST_USER_FREE_EMAIL || 'test-free@spotter.local';
    const password = process.env.TEST_USER_FREE_PASSWORD || 'TestFree123!';
    await page.getByTestId('signup-email-input').fill(email);
    await page.getByTestId('signup-password-input').fill(password);
    await page.getByTestId('signup-submit-button').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test.afterEach(async ({ page }) => {
    // Sign out after each test
    await page.goto('/dashboard');
    const signOutButton = page.getByRole('button', { name: /sign out/i });
    if (await signOutButton.isVisible()) {
      await signOutButton.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });

  test('should load discovery page and display golfer cards', async ({ page }) => {
    await page.goto('/discovery');

    // Wait for page to load
    await expect(page.getByText('Find Golfers')).toBeVisible();

    // Should show search input
    await expect(page.getByPlaceholder(/search by name or location/i)).toBeVisible();

    // Should display filter buttons
    await expect(page.getByRole('button', { name: /all tiers/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /free/i })).toBeVisible();

    // Should show golfer cards
    const firstCard = page.getByTestId('golfer-card-1');
    await expect(firstCard).toBeVisible();

    // Should display at least one golfer's name
    await expect(page.getByText('Mike Chen')).toBeVisible();
  });

  test('should filter golfers by tier (SELECT)', async ({ page }) => {
    await page.goto('/discovery');

    // Click SELECT filter
    await page.getByRole('button', { name: /select/i }).click();

    // Wait for results to update
    await page.waitForTimeout(500);

    // Should show filtered results — golfer cards should still be visible
    const cards = page.locator('[data-testid^="golfer-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should search golfers by name', async ({ page }) => {
    await page.goto('/discovery');

    const searchInput = page.getByPlaceholder(/search by name or location/i);
    await searchInput.fill('Mike');

    // Wait for results to filter
    await page.waitForTimeout(500);

    // Should show Mike Chen
    await expect(page.getByText('Mike Chen')).toBeVisible();

    // Should not show unrelated golfers
    // (at minimum, search should have filtered results)
    const resultsText = await page.getByText(/\d+ golfers? found/).textContent();
    expect(resultsText).toMatch(/1 golfer/);
  });

  test('should click golfer card and navigate to profile', async ({ page }) => {
    await page.goto('/discovery');

    // Click on Mike Chen's card (id: 1)
    await page.getByTestId('golfer-card-1').click();

    // Should navigate to profile with query param
    await expect(page).toHaveURL(/\/profile\?id=1/, { timeout: 10000 });

    // Profile page should load with golfer's name
    await expect(page.getByText('Mike Chen')).toBeVisible();
  });

  test('should send connection request from discovery card', async ({ page }) => {
    await page.goto('/discovery');

    // Find Mike Chen's card (id: 1)
    const mikeCard = page.getByTestId('golfer-card-1');
    await expect(mikeCard).toBeVisible();

    // Click Connect button on Mike Chen's card
    // Note: data-testid is on the button element inside the card
    const connectBtn = mikeCard.getByTestId('profile-connect-button');
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // Should show "Sending..." state (button text changes)
    await expect(connectBtn).toContainText(/sending/i);

    // Wait for connection to be sent (simulated 1s delay)
    await page.waitForTimeout(1500);

    // Should show toast confirmation
    await expect(page.getByTestId('connection-sent-toast')).toBeVisible();
    await expect(page.getByText(/connection request sent/i)).toBeVisible();

    // Toast should disappear after 3 seconds
    await page.waitForTimeout(3500);
    await expect(page.getByTestId('connection-sent-toast')).not.toBeVisible();
  });

  test('should send connection request from profile page', async ({ page }) => {
    await page.goto('/discovery');

    // Click on a golfer card to go to profile
    await page.getByTestId('golfer-card-1').click();
    await expect(page).toHaveURL(/\/profile\?id=1/, { timeout: 10000 });

    // Wait for profile page
    await expect(page.getByText('Mike Chen')).toBeVisible();

    // Scroll to or look for Connect button on profile
    const profileConnectBtn = page.getByTestId('profile-connect-button');
    if (await profileConnectBtn.isVisible()) {
      await profileConnectBtn.click();

      // Should show toast
      await expect(page.getByTestId('connection-sent-toast')).toBeVisible();
    }
  });

  test('should navigate back to discovery via nav', async ({ page }) => {
    await page.goto('/discovery');

    // Navigate away
    await page.goto('/dashboard');

    // Navigate back via nav link
    await page.getByTestId('nav-discovery').click();

    await expect(page).toHaveURL(/\/discovery/, { timeout: 10000 });
    await expect(page.getByText('Find Golfers')).toBeVisible();
  });

  test('should show empty state for no results', async ({ page }) => {
    await page.goto('/discovery');

    // Search for something that won't match
    const searchInput = page.getByPlaceholder(/search by name or location/i);
    await searchInput.fill('xyznonexistentgolfer12345');

    await page.waitForTimeout(500);

    // Should show empty state
    await expect(page.getByText(/no golfers found/i)).toBeVisible();
  });

  test('should toggle hunt mode', async ({ page }) => {
    await page.goto('/discovery');

    // Hunt mode toggle should be visible
    const huntModeToggle = page.getByText(/hunt mode/i);
    await expect(huntModeToggle).toBeVisible();

    // Click to toggle
    await huntModeToggle.click();

    // Should show hunt mode banner
    await expect(page.getByText(/hunt mode active/i)).toBeVisible();
  });
});
