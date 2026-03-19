import { test, expect } from '@playwright/test';

/**
 * Profile & Networking E2E Tests
 * 
 * Validates:
 * - Profile creation and editing
 * - Connection requests and management
 * - Introductions through mutual connections
 * - Reputation scoring and display
 */

test.describe('Profile Management', () => {
  test('should display profile with all sections', async ({ page }) => {
    await page.goto('/profile');
    
    // Basic info
    await expect(page.getByTestId('profile-name')).toBeVisible();
    await expect(page.getByTestId('profile-avatar')).toBeVisible();
    await expect(page.getByTestId('profile-location')).toBeVisible();
    
    // Professional identity
    await expect(page.getByTestId('professional-section')).toBeVisible();
    await expect(page.getByTestId('profile-role')).toBeVisible();
    await expect(page.getByTestId('profile-company')).toBeVisible();
    
    // Golf identity
    await expect(page.getByTestId('golf-section')).toBeVisible();
    await expect(page.getByTestId('profile-handicap')).toBeVisible();
    await expect(page.getByTestId('profile-home-course')).toBeVisible();
  });

  test('should edit profile information', async ({ page }) => {
    await page.goto('/profile/edit');
    
    // Update basic info
    await page.getByLabel('Display Name').fill('John Updated');
    await page.getByLabel('City').fill('Scottsdale');
    
    // Update professional info
    await page.getByLabel('Role').fill('Senior Manager');
    await page.getByLabel('Company').fill('Tech Corp');
    await page.getByLabel('Industry').selectOption('Technology');
    
    // Update golf info
    await page.getByLabel('Handicap').fill('12.5');
    await page.getByLabel('Years Playing').fill('8');
    
    await page.getByTestId('save-profile-button').click();
    
    // Should show success and redirect
    await expect(page.getByTestId('profile-saved-success')).toBeVisible();
    await expect(page).toHaveURL('/profile');
    
    // Verify updates
    await expect(page.getByTestId('profile-name')).toContainText('John Updated');
    await expect(page.getByTestId('profile-role')).toContainText('Senior Manager');
  });

  test('should upload profile avatar', async ({ page }) => {
    await page.goto('/profile/edit');
    
    // Upload avatar
    const fileInput = page.locator('input[type="file"][data-testid="avatar-upload"]');
    await fileInput.setInputFiles({
      name: 'avatar.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });
    
    // Should show preview
    await expect(page.getByTestId('avatar-preview')).toBeVisible();
    
    await page.getByTestId('save-profile-button').click();
    
    // Verify avatar updated
    await expect(page.getByTestId('profile-avatar')).toHaveAttribute('src', /.*avatar.*/);
  });

  test('should show profile completeness progress', async ({ page }) => {
    await page.goto('/profile');
    
    await expect(page.getByTestId('profile-completeness')).toBeVisible();
    await expect(page.getByTestId('completeness-percentage')).toMatchText(/\d+%/);
    
    // Incomplete sections should be highlighted
    const incompleteSections = page.locator('[data-testid="incomplete-section"]');
    if (await incompleteSections.count() > 0) {
      await expect(incompleteSections.first()).toContainText('Complete');
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/profile/edit');
    
    // Clear required field
    await page.getByLabel('Display Name').fill('');
    await page.getByTestId('save-profile-button').click();
    
    // Should show validation error
    await expect(page.getByTestId('validation-error')).toBeVisible();
    await expect(page.getByTestId('validation-error')).toContainText('Display name is required');
  });
});

test.describe('Connections', () => {
  test('should send connection request', async ({ page }) => {
    await page.goto('/members/user-456');
    
    await page.getByTestId('send-connection-button').click();
    
    // Connection type selection
    await expect(page.getByTestId('connection-type-dialog')).toBeVisible();
    await page.getByTestId('connection-type-played-together').click();
    
    // Optional message
    await page.getByTestId('connection-message-input').fill('Great playing with you!');
    
    await page.getByTestId('send-request-button').click();
    
    await expect(page.getByTestId('request-sent-success')).toBeVisible();
    await expect(page.getByTestId('send-connection-button')).toBeDisabled();
  });

  test('should accept incoming connection request', async ({ page }) => {
    await page.goto('/connections/requests');
    
    // Find pending request
    const pendingRequest = page.locator('[data-testid="pending-request"]').first();
    await expect(pendingRequest).toBeVisible();
    
    await pendingRequest.locator('[data-testid="accept-button"]').click();
    
    await expect(page.getByTestId('connection-accepted')).toBeVisible();
    
    // Request should be removed from pending
    await expect(pendingRequest).toHaveCount(0);
  });

  test('should decline connection request', async ({ page }) => {
    await page.goto('/connections/requests');
    
    const pendingRequest = page.locator('[data-testid="pending-request"]').first();
    await pendingRequest.locator('[data-testid="decline-button"]').click();
    
    // Confirm decline
    await page.getByTestId('confirm-decline-button').click();
    
    await expect(page.getByTestId('request-declined')).toBeVisible();
  });

  test('should view connections list', async ({ page }) => {
    await page.goto('/connections');
    
    await expect(page.getByTestId('connections-list')).toBeVisible();
    
    const connections = page.locator('[data-testid="connection-item"]');
    await expect(connections).toHaveCountGreaterThan(0);
    
    // Each connection should show name and info
    const firstConnection = connections.first();
    await expect(firstConnection.locator('[data-testid="connection-name"]')).toBeVisible();
    await expect(firstConnection.locator('[data-testid="connection-company"]')).toBeVisible();
  });

  test('should remove connection', async ({ page }) => {
    await page.goto('/connections');
    
    const connection = page.locator('[data-testid="connection-item"]').first();
    await connection.locator('[data-testid="more-options"]').click();
    await connection.locator('[data-testid="remove-connection"]').click();
    
    // Confirm removal
    await page.getByTestId('confirm-remove-button').click();
    
    await expect(page.getByTestId('connection-removed')).toBeVisible();
  });

  test('should block user', async ({ page }) => {
    await page.goto('/members/user-456');
    
    await page.getByTestId('more-options-button').click();
    await page.getByTestId('block-user-option').click();
    
    // Confirm block
    await page.getByTestId('confirm-block-button').click();
    
    await expect(page.getByTestId('user-blocked')).toBeVisible();
    await expect(page.getByTestId('send-connection-button')).toBeHidden();
  });
});

test.describe('Introductions', () => {
  test('should request introduction through mutual connection', async ({ page }) => {
    await page.goto('/members/user-789');
    
    // Check for mutual connections
    await expect(page.getByTestId('mutual-connections')).toBeVisible();
    const mutualCount = await page.getByTestId('mutual-count').textContent();
    expect(parseInt(mutualCount || '0')).toBeGreaterThan(0);
    
    await page.getByTestId('request-intro-button').click();
    
    // Select connector
    await expect(page.getByTestId('select-connector-dialog')).toBeVisible();
    await page.locator('[data-testid="connector-option"]').first().click();
    
    // Add message
    await page.getByTestId('intro-message-input').fill('Would love to connect!');
    
    await page.getByTestId('send-intro-request-button').click();
    
    await expect(page.getByTestId('intro-request-sent')).toBeVisible();
  });

  test('should facilitate introduction as connector', async ({ page }) => {
    await page.goto('/introductions/pending');
    
    // Find pending intro request
    const introRequest = page.locator('[data-testid="intro-request"]').first();
    await expect(introRequest).toBeVisible();
    
    await introRequest.locator('[data-testid="facilitate-button"]').click();
    
    // Add connector message
    await page.getByTestId('connector-message-input').fill('Happy to introduce you two!');
    
    await page.getByTestId('send-introduction-button').click();
    
    await expect(page.getByTestId('introduction-sent')).toBeVisible();
  });

  test('should accept introduction', async ({ page }) => {
    await page.goto('/introductions');
    
    const pendingIntro = page.locator('[data-testid="pending-introduction"]').first();
    await pendingIntro.locator('[data-testid="accept-intro-button"]').click();
    
    await expect(page.getByTestId('introduction-accepted')).toBeVisible();
    
    // Should now be connected
    await page.goto('/connections');
    await expect(page.getByText('New Connection')).toBeVisible();
  });

  test('should decline introduction', async ({ page }) => {
    await page.goto('/introductions');
    
    const pendingIntro = page.locator('[data-testid="pending-introduction"]').first();
    await pendingIntro.locator('[data-testid="decline-intro-button"]').click();
    
    await page.getByTestId('confirm-decline-button').click();
    
    await expect(page.getByTestId('introduction-declined')).toBeVisible();
  });

  test('should show introduction history', async ({ page }) => {
    await page.goto('/introductions/history');
    
    await expect(page.getByTestId('introductions-list')).toBeVisible();
    
    // Show both made and received introductions
    await expect(page.getByTestId('made-introductions-tab')).toBeVisible();
    await expect(page.getByTestId('received-introductions-tab')).toBeVisible();
  });
});

test.describe('Reputation Score', () => {
  test('should display reputation score on profile', async ({ page }) => {
    await page.goto('/profile');
    
    await expect(page.getByTestId('reputation-score')).toBeVisible();
    await expect(page.getByTestId('reputation-score-value')).toMatchText(/\d+/);
  });

  test('should show reputation breakdown', async ({ page }) => {
    await page.goto('/profile/reputation');
    
    await expect(page.getByTestId('reputation-breakdown')).toBeVisible();
    
    // Component scores
    await expect(page.getByTestId('component-completion')).toBeVisible();
    await expect(page.getByTestId('component-ratings')).toBeVisible();
    await expect(page.getByTestId('component-network')).toBeVisible();
    await expect(page.getByTestId('component-referrals')).toBeVisible();
    await expect(page.getByTestId('component-profile')).toBeVisible();
    await expect(page.getByTestId('component-attendance')).toBeVisible();
  });

  test('should show reputation history', async ({ page }) => {
    await page.goto('/profile/reputation');
    
    await expect(page.getByTestId('reputation-history-chart')).toBeVisible();
    await expect(page.getByTestId('reputation-events')).toBeVisible();
    
    // Recent events
    const events = page.locator('[data-testid="reputation-event"]');
    await expect(events).toHaveCountGreaterThan(0);
  });

  test('should update reputation after positive activity', async ({ page }) => {
    // Complete profile section
    await page.goto('/profile/edit');
    await page.getByLabel('LinkedIn URL').fill('https://linkedin.com/in/test');
    await page.getByTestId('save-profile-button').click();
    
    // Check reputation increased
    await page.goto('/profile/reputation');
    
    const event = page.locator('[data-testid="reputation-event"]').filter({ hasText: 'Profile completed' });
    await expect(event).toBeVisible();
  });

  test('should show reputation badge on public profile', async ({ page }) => {
    await page.goto('/members/user-123');
    
    await expect(page.getByTestId('reputation-badge')).toBeVisible();
    
    // Badge should show tier (bronze, silver, gold, platinum)
    const badgeText = await page.getByTestId('reputation-badge').textContent();
    expect(['Bronze', 'Silver', 'Gold', 'Platinum']).toContain(badgeText);
  });
});

test.describe('Network Analytics', () => {
  test('should show network statistics', async ({ page }) => {
    await page.goto('/network');
    
    await expect(page.getByTestId('network-stats')).toBeVisible();
    await expect(page.getByTestId('connections-count')).toMatchText(/\d+/);
    await expect(page.getByTestId('introductions-made')).toMatchText(/\d+/);
    await expect(page.getByTestId('network-reach')).toMatchText(/\d+/);
  });

  test('should show network graph', async ({ page }) => {
    await page.goto('/network/graph');
    
    await expect(page.getByTestId('network-graph')).toBeVisible();
    await expect(page.locator('svg.network-visualization')).toBeVisible();
  });

  test('should show suggested connections', async ({ page }) => {
    await page.goto('/network/suggestions');
    
    await expect(page.getByTestId('suggested-connections')).toBeVisible();
    
    const suggestions = page.locator('[data-testid="suggestion-item"]');
    await expect(suggestions).toHaveCountGreaterThan(0);
    
    // Each suggestion should show reason
    const firstSuggestion = suggestions.first();
    await expect(firstSuggestion.locator('[data-testid="suggestion-reason"]')).toBeVisible();
  });
});

test.describe('Privacy Settings', () => {
  test('should update profile visibility', async ({ page }) => {
    await page.goto('/settings/privacy');
    
    // Toggle visibility
    await page.getByTestId('profile-visibility-toggle').click();
    await page.getByTestId('visibility-same-tier').check();
    
    await page.getByTestId('save-privacy-settings').click();
    
    await expect(page.getByTestId('settings-saved')).toBeVisible();
  });

  test('should manage connection preferences', async ({ page }) => {
    await page.goto('/settings/privacy');
    
    await page.getByTestId('allow-connections-toggle').click();
    await page.getByTestId('connection-preference-mutual').check();
    
    await page.getByTestId('save-privacy-settings').click();
    
    await expect(page.getByTestId('settings-saved')).toBeVisible();
  });

  test('should control data sharing settings', async ({ page }) => {
    await page.goto('/settings/privacy');
    
    await page.getByTestId('share-analytics-toggle').click();
    await page.getByTestId('share-profile-with-organizers').check();
    
    await page.getByTestId('save-privacy-settings').click();
    
    await expect(page.getByTestId('settings-saved')).toBeVisible();
  });
});
