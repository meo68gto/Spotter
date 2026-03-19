import { test, expect } from '@playwright/test';

/**
 * Phase 1 Onboarding E2E Tests
 * 
 * Tests the new user onboarding flow:
 * - Tier selection
 * - Golf identity setup
 * - Professional identity setup
 * - Networking preferences
 * - Location and timezone
 * - Completion and profile creation
 */

test.describe('Onboarding - Welcome and Tier Selection', () => {
  test('should display welcome screen for new users', async ({ page }) => {
    await page.goto('/onboarding');
    
    // Verify welcome content
    await expect(page.getByTestId('onboarding-welcome')).toBeVisible();
    await expect(page.getByText('Welcome to Spotter')).toBeVisible();
    await expect(page.getByTestId('start-onboarding-button')).toBeVisible();
  });

  test('should navigate to tier selection', async ({ page }) => {
    await page.goto('/onboarding');
    
    await page.getByTestId('start-onboarding-button').click();
    
    // Should show tier selection
    await expect(page).toHaveURL(/\/onboarding\/tier/);
    await expect(page.getByTestId('tier-selection')).toBeVisible();
  });

  test('should display all tier options', async ({ page }) => {
    await page.goto('/onboarding/tier');
    
    // Verify all tiers are shown
    await expect(page.getByTestId('tier-free')).toBeVisible();
    await expect(page.getByTestId('tier-select')).toBeVisible();
    await expect(page.getByTestId('tier-summit')).toBeVisible();
  });

  test('should show tier features comparison', async ({ page }) => {
    await page.goto('/onboarding/tier');
    
    // Each tier should show features
    const freeTier = page.getByTestId('tier-free');
    await expect(freeTier.getByTestId('tier-features')).toBeVisible();
    
    const selectTier = page.getByTestId('tier-select');
    await expect(selectTier.getByTestId('tier-features')).toBeVisible();
    
    const summitTier = page.getByTestId('tier-summit');
    await expect(summitTier.getByTestId('tier-features')).toBeVisible();
  });

  test('should select FREE tier', async ({ page }) => {
    await page.goto('/onboarding/tier');
    
    await page.getByTestId('select-tier-free').click();
    
    // Should advance to next step
    await expect(page).toHaveURL(/\/onboarding\/golf/);
  });

  test('should select SELECT tier', async ({ page }) => {
    await page.goto('/onboarding/tier');
    
    await page.getByTestId('select-tier-select').click();
    
    await expect(page).toHaveURL(/\/onboarding\/golf/);
  });

  test('should select SUMMIT tier', async ({ page }) => {
    await page.goto('/onboarding/tier');
    
    await page.getByTestId('select-tier-summit').click();
    
    await expect(page).toHaveURL(/\/onboarding\/golf/);
  });

  test('should show tier pricing for paid tiers', async ({ page }) => {
    await page.goto('/onboarding/tier');
    
    const selectTier = page.getByTestId('tier-select');
    const priceText = await selectTier.getByTestId('tier-price').textContent();
    expect(priceText).toMatch(/\$\d+/);
    
    const summitTier = page.getByTestId('tier-summit');
    const summitPrice = await summitTier.getByTestId('tier-price').textContent();
    expect(summitPrice).toMatch(/\$\d+/);
  });
});

test.describe('Onboarding - Golf Identity', () => {
  test('should display golf identity form', async ({ page }) => {
    await page.goto('/onboarding/golf');
    
    // Verify form elements
    await expect(page.getByTestId('golf-identity-form')).toBeVisible();
    await expect(page.getByTestId('handicap-band-select')).toBeVisible();
    await expect(page.getByTestId('typical-score-input')).toBeVisible();
  });

  test('should require handicap band', async ({ page }) => {
    await page.goto('/onboarding/golf');
    
    // Try to continue without selecting handicap band
    await page.getByTestId('continue-button').click();
    
    // Should show validation error
    await expect(page.getByTestId('handicap-band-error')).toBeVisible();
    await expect(page.getByText('handicap band is required', { ignoreCase: true })).toBeVisible();
  });

  test('should have valid handicap band options', async ({ page }) => {
    await page.goto('/onboarding/golf');
    
    const handicapSelect = page.getByTestId('handicap-band-select');
    const options = await handicapSelect.locator('option').allTextContents();
    
    expect(options).toContain('Low (0-10)');
    expect(options).toContain('Mid (11-20)');
    expect(options).toContain('High (21+)');
  });

  test('should complete golf identity with valid data', async ({ page }) => {
    await page.goto('/onboarding/golf');
    
    // Fill in form
    await page.getByTestId('handicap-band-select').selectOption('low');
    await page.getByTestId('typical-score-input').fill('85');
    await page.getByTestId('home-course-input').fill('Test Golf Club');
    await page.getByTestId('play-frequency-select').selectOption('weekly');
    await page.getByTestId('years-playing-input').fill('5');
    
    await page.getByTestId('continue-button').click();
    
    // Should advance to next step
    await expect(page).toHaveURL(/\/onboarding\/professional/);
  });

  test('should validate typical score is positive', async ({ page }) => {
    await page.goto('/onboarding/golf');
    
    await page.getByTestId('handicap-band-select').selectOption('low');
    await page.getByTestId('typical-score-input').fill('-1');
    await page.getByTestId('continue-button').click();
    
    // Should show validation error
    await expect(page.getByTestId('typical-score-error')).toBeVisible();
  });

  test('should allow skipping optional fields', async ({ page }) => {
    await page.goto('/onboarding/golf');
    
    // Only fill required field
    await page.getByTestId('handicap-band-select').selectOption('mid');
    
    await page.getByTestId('continue-button').click();
    
    // Should still advance
    await expect(page).toHaveURL(/\/onboarding\/professional/);
  });
});

test.describe('Onboarding - Professional Identity', () => {
  test('should display professional identity form', async ({ page }) => {
    await page.goto('/onboarding/professional');
    
    await expect(page.getByTestId('professional-identity-form')).toBeVisible();
    await expect(page.getByTestId('company-input')).toBeVisible();
    await expect(page.getByTestId('role-input')).toBeVisible();
  });

  test('should allow skipping professional identity', async ({ page }) => {
    await page.goto('/onboarding/professional');
    
    // Click skip
    await page.getByTestId('skip-step-button').click();
    
    // Should advance to networking preferences
    await expect(page).toHaveURL(/\/onboarding\/networking/);
  });

  test('should complete professional identity', async ({ page }) => {
    await page.goto('/onboarding/professional');
    
    // Fill in form
    await page.getByTestId('company-input').fill('Acme Corp');
    await page.getByTestId('role-input').fill('Software Engineer');
    await page.getByTestId('industry-select').selectOption('Technology');
    await page.getByTestId('linkedin-input').fill('https://linkedin.com/in/testuser');
    
    await page.getByTestId('continue-button').click();
    
    // Should advance
    await expect(page).toHaveURL(/\/onboarding\/networking/);
  });

  test('should validate LinkedIn URL format', async ({ page }) => {
    await page.goto('/onboarding/professional');
    
    await page.getByTestId('linkedin-input').fill('not-a-valid-url');
    await page.getByTestId('continue-button').click();
    
    // Should show validation error
    await expect(page.getByTestId('linkedin-error')).toBeVisible();
  });

  test('should make company and role optional together', async ({ page }) => {
    await page.goto('/onboarding/professional');
    
    // Fill only role
    await page.getByTestId('role-input').fill('Manager');
    await page.getByTestId('continue-button').click();
    
    // Should require company if role is provided
    await expect(page.getByTestId('company-error')).toBeVisible();
  });
});

test.describe('Onboarding - Networking Preferences', () => {
  test('should display networking preferences form', async ({ page }) => {
    await page.goto('/onboarding/networking');
    
    await expect(page.getByTestId('networking-preferences-form')).toBeVisible();
    await expect(page.getByTestId('networking-intent-select')).toBeVisible();
    await expect(page.getByTestId('preferred-group-size-select')).toBeVisible();
    await expect(page.getByTestId('cart-preference-select')).toBeVisible();
  });

  test('should require networking intent', async ({ page }) => {
    await page.goto('/onboarding/networking');
    
    await page.getByTestId('continue-button').click();
    
    // Should show validation error
    await expect(page.getByTestId('networking-intent-error')).toBeVisible();
  });

  test('should have valid networking intent options', async ({ page }) => {
    await page.goto('/onboarding/networking');
    
    const intentSelect = page.getByTestId('networking-intent-select');
    const options = await intentSelect.locator('option').allTextContents();
    
    expect(options).toContain('Business');
    expect(options).toContain('Social');
    expect(options).toContain('Competitive');
    expect(options).toContain('Business + Social');
  });

  test('should have valid group size options', async ({ page }) => {
    await page.goto('/onboarding/networking');
    
    const groupSizeSelect = page.getByTestId('preferred-group-size-select');
    const options = await groupSizeSelect.locator('option').allTextContents();
    
    expect(options).toContain('2');
    expect(options).toContain('3');
    expect(options).toContain('4');
    expect(options).toContain('Any');
  });

  test('should complete networking preferences', async ({ page }) => {
    await page.goto('/onboarding/networking');
    
    // Fill in form
    await page.getByTestId('networking-intent-select').selectOption('business');
    await page.getByTestId('open-to-intros-checkbox').check();
    await page.getByTestId('open-to-sending-intros-checkbox').check();
    await page.getByTestId('open-to-recurring-checkbox').check();
    await page.getByTestId('preferred-group-size-select').selectOption('4');
    await page.getByTestId('cart-preference-select').selectOption('cart');
    await page.getByTestId('preferred-area-input').fill('Scottsdale');
    
    await page.getByTestId('continue-button').click();
    
    // Should advance to location
    await expect(page).toHaveURL(/\/onboarding\/location/);
  });

  test('should allow toggling intro preferences', async ({ page }) => {
    await page.goto('/onboarding/networking');
    
    // Check and uncheck
    const checkbox = page.getByTestId('open-to-intros-checkbox');
    await checkbox.check();
    expect(await checkbox.isChecked()).toBe(true);
    
    await checkbox.uncheck();
    expect(await checkbox.isChecked()).toBe(false);
  });
});

test.describe('Onboarding - Location and Timezone', () => {
  test('should display location form', async ({ page }) => {
    await page.goto('/onboarding/location');
    
    await expect(page.getByTestId('location-form')).toBeVisible();
    await expect(page.getByTestId('city-input')).toBeVisible();
    await expect(page.getByTestId('timezone-select')).toBeVisible();
  });

  test('should require city', async ({ page }) => {
    await page.goto('/onboarding/location');
    
    await page.getByTestId('complete-onboarding-button').click();
    
    // Should show validation error
    await expect(page.getByTestId('city-error')).toBeVisible();
  });

  test('should auto-detect timezone', async ({ page }) => {
    await page.goto('/onboarding/location');
    
    // Check if timezone is pre-filled
    const timezoneSelect = page.getByTestId('timezone-select');
    const value = await timezoneSelect.inputValue();
    
    // Should have a timezone selected
    expect(value).toBeTruthy();
  });

  test('should have valid timezone options', async ({ page }) => {
    await page.goto('/onboarding/location');
    
    const timezoneSelect = page.getByTestId('timezone-select');
    const options = await timezoneSelect.locator('option').allTextContents();
    
    // Should have major timezones
    expect(options.some(o => o.includes('Pacific'))).toBe(true);
    expect(options.some(o => o.includes('Mountain'))).toBe(true);
    expect(options.some(o => o.includes('Central'))).toBe(true);
    expect(options.some(o => o.includes('Eastern'))).toBe(true);
  });

  test('should complete onboarding with location', async ({ page }) => {
    await page.goto('/onboarding/location');
    
    await page.getByTestId('city-input').fill('Phoenix');
    await page.getByTestId('timezone-select').selectOption('America/Phoenix');
    
    await page.getByTestId('complete-onboarding-button').click();
    
    // Should show completion screen
    await expect(page.getByTestId('onboarding-complete')).toBeVisible();
  });
});

test.describe('Onboarding - Completion', () => {
  test('should display completion screen', async ({ page }) => {
    await page.goto('/onboarding/complete');
    
    await expect(page.getByTestId('onboarding-complete')).toBeVisible();
    await expect(page.getByText('Welcome to Spotter')).toBeVisible();
    await expect(page.getByTestId('go-to-dashboard-button')).toBeVisible();
  });

  test('should redirect to dashboard on completion', async ({ page }) => {
    await page.goto('/onboarding/complete');
    
    await page.getByTestId('go-to-dashboard-button').click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show tier badge after onboarding', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should show tier badge
    await expect(page.getByTestId('tier-badge')).toBeVisible();
  });

  test('should create reputation record on completion', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Reputation should be visible
    await expect(page.getByTestId('reputation-score')).toBeVisible();
    
    const scoreText = await page.getByTestId('reputation-score').textContent();
    const score = parseInt(scoreText || '0', 10);
    
    // Starting score should be around 50
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThanOrEqual(75);
  });
});

test.describe('Onboarding - Navigation and Progress', () => {
  test('should show progress indicator', async ({ page }) => {
    await page.goto('/onboarding/tier');
    
    await expect(page.getByTestId('progress-indicator')).toBeVisible();
    
    const progressText = await page.getByTestId('progress-indicator').textContent();
    expect(progressText).toMatch(/Step \d+ of \d+/);
  });

  test('should allow going back to previous step', async ({ page }) => {
    await page.goto('/onboarding/golf');
    
    await page.getByTestId('back-button').click();
    
    // Should go back to tier selection
    await expect(page).toHaveURL(/\/onboarding\/tier/);
  });

  test('should save progress on each step', async ({ page }) => {
    await page.goto('/onboarding/tier');
    
    // Select tier
    await page.getByTestId('select-tier-select').click();
    
    // Fill golf info
    await page.getByTestId('handicap-band-select').selectOption('low');
    await page.getByTestId('continue-button').click();
    
    // Navigate away and back
    await page.goto('/');
    await page.goto('/onboarding/golf');
    
    // Previous selection should be preserved
    const handicapSelect = page.getByTestId('handicap-band-select');
    const value = await handicapSelect.inputValue();
    expect(value).toBe('low');
  });

  test('should skip completed steps on revisit', async ({ page }) => {
    // Complete onboarding once
    await page.goto('/onboarding/complete');
    
    // Try to go back to tier selection
    await page.goto('/onboarding/tier');
    
    // Should redirect to dashboard or complete page
    await expect(page).not.toHaveURL(/\/onboarding\/tier/);
  });
});

test.describe('Onboarding - Error Handling', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    // Block API requests
    await page.route('**/onboarding-phase1', route => route.abort('failed'));
    
    await page.goto('/onboarding/location');
    await page.getByTestId('city-input').fill('Phoenix');
    await page.getByTestId('complete-onboarding-button').click();
    
    // Should show error message
    await expect(page.getByTestId('onboarding-error')).toBeVisible();
    await expect(page.getByText('Failed to complete onboarding')).toBeVisible();
  });

  test('should validate all fields before submission', async ({ page }) => {
    await page.goto('/onboarding/location');
    
    // Submit without filling anything
    await page.getByTestId('complete-onboarding-button').click();
    
    // Should stay on same page with error
    await expect(page).toHaveURL(/\/onboarding\/location/);
    await expect(page.getByTestId('city-error')).toBeVisible();
  });

  test('should handle invalid tier selection', async ({ page }) => {
    await page.goto('/onboarding/tier');
    
    // Try to continue without selecting tier
    await page.goto('/onboarding/golf');
    
    // Should redirect back to tier selection
    await expect(page).toHaveURL(/\/onboarding\/tier/);
  });

  test('should require authentication', async ({ page }) => {
    // Clear auth
    await page.context().clearCookies();
    
    await page.goto('/onboarding');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Onboarding - Edge Cases', () => {
  test('should handle long city names', async ({ page }) => {
    await page.goto('/onboarding/location');
    
    const longCity = 'A'.repeat(100);
    await page.getByTestId('city-input').fill(longCity);
    await page.getByTestId('complete-onboarding-button').click();
    
    // Should either accept or show validation error
    const error = page.getByTestId('city-error');
    if (await error.isVisible()) {
      const errorText = await error.textContent();
      expect(errorText?.toLowerCase()).toContain('too long');
    }
  });

  test('should handle special characters in inputs', async ({ page }) => {
    await page.goto('/onboarding/professional');
    
    await page.getByTestId('company-input').fill('Company & Co. (Test)');
    await page.getByTestId('role-input').fill('CEO / Founder');
    await page.getByTestId('continue-button').click();
    
    // Should advance successfully
    await expect(page).toHaveURL(/\/onboarding\/networking/);
  });

  test('should handle browser back button', async ({ page }) => {
    await page.goto('/onboarding/golf');
    
    await page.goBack();
    
    // Should handle gracefully
    await expect(page.getByTestId('onboarding-welcome').or(page.getByTestId('tier-selection'))).toBeVisible();
  });

  test('should handle page refresh during onboarding', async ({ page }) => {
    await page.goto('/onboarding/golf');
    await page.getByTestId('handicap-band-select').selectOption('low');
    
    // Refresh page
    await page.reload();
    
    // Should preserve progress or show appropriate state
    await expect(page.getByTestId('golf-identity-form').or(page.getByTestId('onboarding-welcome'))).toBeVisible();
  });
});
