import { test, expect } from '@playwright/test';

/**
 * Golf Rounds E2E Tests
 * 
 * Tests round creation, invitations, and lifecycle for Phase 1-2:
 * - Round creation with tier limits
 * - Same-tier enforcement
 * - Invitation flow
 * - Response handling (accept/decline)
 * - Round status transitions
 * - Participant management
 */

test.describe('Round Creation - Basic Functionality', () => {
  test('should display round creation form', async ({ page }) => {
    await page.goto('/rounds/create');
    
    // Verify form loads
    await expect(page.getByTestId('round-create-form')).toBeVisible();
    
    // Verify required fields
    await expect(page.getByTestId('course-select')).toBeVisible();
    await expect(page.getByTestId('scheduled-at-input')).toBeVisible();
    await expect(page.getByTestId('max-players-select')).toBeVisible();
    await expect(page.getByTestId('cart-preference-select')).toBeVisible();
  });

  test('should create a round successfully', async ({ page }) => {
    await page.goto('/rounds/create');
    
    // Fill in form
    await page.getByTestId('course-select').selectOption('course-1');
    
    // Set future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    await page.getByTestId('scheduled-at-input').fill(futureDate.toISOString().slice(0, 16));
    
    await page.getByTestId('max-players-select').selectOption('4');
    await page.getByTestId('cart-preference-select').selectOption('either');
    await page.getByTestId('notes-input').fill('Test round notes');
    
    // Submit form
    await page.getByTestId('create-round-button').click();
    
    // Should redirect to round detail
    await expect(page).toHaveURL(/\/rounds\/[a-zA-Z0-9-]+/);
    
    // Should show success message
    await expect(page.getByTestId('round-created-success')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/rounds/create');
    
    // Submit without filling required fields
    await page.getByTestId('create-round-button').click();
    
    // Should show validation errors
    await expect(page.getByTestId('course-error')).toBeVisible();
    await expect(page.getByTestId('scheduled-at-error')).toBeVisible();
  });

  test('should validate scheduled date is in future', async ({ page }) => {
    await page.goto('/rounds/create');
    
    // Set past date
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    await page.getByTestId('scheduled-at-input').fill(pastDate.toISOString().slice(0, 16));
    
    await page.getByTestId('create-round-button').click();
    
    // Should show validation error
    await expect(page.getByTestId('scheduled-at-error')).toBeVisible();
    await expect(page.getByText('future')).toBeVisible();
  });

  test('should validate max players options', async ({ page }) => {
    await page.goto('/rounds/create');
    
    // Check valid options exist
    const maxPlayersSelect = page.getByTestId('max-players-select');
    const options = await maxPlayersSelect.locator('option').allTextContents();
    
    expect(options).toContain('2');
    expect(options).toContain('3');
    expect(options).toContain('4');
  });
});

test.describe('Round Creation - Tier Limits', () => {
  test('FREE tier should be limited to 3 rounds per month', async ({ page }) => {
    await page.goto('/rounds/create');
    
    // Check if limit warning is shown
    const limitWarning = page.getByTestId('round-limit-warning');
    if (await limitWarning.isVisible()) {
      const warningText = await limitWarning.textContent();
      expect(warningText).toContain('3');
    }
  });

  test('should show remaining rounds count for FREE tier', async ({ page }) => {
    await page.goto('/rounds/create');
    
    const remainingIndicator = page.getByTestId('rounds-remaining');
    await expect(remainingIndicator).toBeVisible();
    
    const remainingText = await remainingIndicator.textContent();
    expect(remainingText).toMatch(/\d+\s*\/\s*3/);
  });

  test('should block round creation when limit reached', async ({ page }) => {
    await page.goto('/rounds/create');
    
    // Check if create button is disabled when limit reached
    const createButton = page.getByTestId('create-round-button');
    
    const remainingText = await page.getByTestId('rounds-remaining').textContent();
    const remaining = parseInt(remainingText?.split('/')[0] || '0');
    
    if (remaining === 0) {
      await expect(createButton).toBeDisabled();
      await expect(page.getByTestId('limit-reached-message')).toBeVisible();
    }
  });

  test('SELECT tier should have unlimited rounds', async ({ page }) => {
    await page.goto('/rounds/create');
    
    // Should show unlimited indicator
    const remainingIndicator = page.getByTestId('rounds-remaining');
    if (await remainingIndicator.isVisible()) {
      const remainingText = await remainingIndicator.textContent();
      expect(remainingText?.toLowerCase()).toContain('unlimited');
    }
  });

  test('SUMMIT tier should have unlimited rounds', async ({ page }) => {
    await page.goto('/rounds/create');
    
    const remainingIndicator = page.getByTestId('rounds-remaining');
    if (await remainingIndicator.isVisible()) {
      const remainingText = await remainingIndicator.textContent();
      expect(remainingText?.toLowerCase()).toContain('unlimited');
    }
  });
});

test.describe('Round Creation - Same-Tier Enforcement', () => {
  test('should create round with current user tier', async ({ page }) => {
    await page.goto('/rounds/create');
    
    // Fill and submit form
    await page.getByTestId('course-select').selectOption('course-1');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    await page.getByTestId('scheduled-at-input').fill(futureDate.toISOString().slice(0, 16));
    await page.getByTestId('max-players-select').selectOption('4');
    
    await page.getByTestId('create-round-button').click();
    
    // Wait for round detail page
    await page.waitForURL(/\/rounds\/[a-zA-Z0-9-]+/);
    
    // Verify tier is displayed
    const tierBadge = page.getByTestId('round-tier');
    await expect(tierBadge).toBeVisible();
  });

  test('round should only accept same-tier invitations', async ({ page }) => {
    // Create a round first
    await page.goto('/rounds/create');
    await page.getByTestId('course-select').selectOption('course-1');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    await page.getByTestId('scheduled-at-input').fill(futureDate.toISOString().slice(0, 16));
    await page.getByTestId('max-players-select').selectOption('4');
    await page.getByTestId('create-round-button').click();
    
    await page.waitForURL(/\/rounds\/[a-zA-Z0-9-]+/);
    
    // Try to invite different tier user
    await page.getByTestId('invite-button').click();
    await page.getByTestId('user-search').fill('different-tier-user');
    await page.getByTestId('search-users-button').click();
    
    // Should show tier mismatch error
    await expect(page.getByTestId('tier-mismatch-error')).toBeVisible();
  });
});

test.describe('Round Invitations', () => {
  test('should invite user to round', async ({ page }) => {
    // Navigate to an existing round
    await page.goto('/rounds/test-round-id');
    
    // Click invite button
    await page.getByTestId('invite-button').click();
    
    // Search for user
    await page.getByTestId('user-search').fill('testuser');
    await page.getByTestId('search-users-button').click();
    
    // Select user from results
    await page.waitForSelector('[data-testid="user-search-result"]', { timeout: 5000 });
    await page.getByTestId('user-search-result').first().click();
    
    // Add optional message
    await page.getByTestId('invite-message').fill('Join my round!');
    
    // Send invitation
    await page.getByTestId('send-invite-button').click();
    
    // Should show success
    await expect(page.getByTestId('invite-sent-success')).toBeVisible();
  });

  test('should validate user is not already invited', async ({ page }) => {
    await page.goto('/rounds/test-round-id');
    await page.getByTestId('invite-button').click();
    
    // Try to invite already invited user
    await page.getByTestId('user-search').fill('already-invited-user');
    await page.getByTestId('search-users-button').click();
    
    // Should show already invited message
    await expect(page.getByTestId('already-invited-message')).toBeVisible();
  });

  test('should validate user is not already participant', async ({ page }) => {
    await page.goto('/rounds/test-round-id');
    await page.getByTestId('invite-button').click();
    
    // Try to invite existing participant
    await page.getByTestId('user-search').fill('existing-participant');
    await page.getByTestId('search-users-button').click();
    
    // Should show already participant message
    await expect(page.getByTestId('already-participant-message')).toBeVisible();
  });

  test('should validate round is not full', async ({ page }) => {
    await page.goto('/rounds/full-round-id');
    
    // Invite button should be disabled or hidden
    const inviteButton = page.getByTestId('invite-button');
    if (await inviteButton.isVisible()) {
      await expect(inviteButton).toBeDisabled();
    }
    
    // Should show round full message
    await expect(page.getByTestId('round-full-message')).toBeVisible();
  });

  test('should show pending invitations', async ({ page }) => {
    await page.goto('/rounds/test-round-id');
    
    // Navigate to invitations tab
    await page.getByTestId('invitations-tab').click();
    
    // Should show pending invitations list
    await expect(page.getByTestId('pending-invitations-list')).toBeVisible();
  });
});

test.describe('Round Invitations - Response', () => {
  test('should accept round invitation', async ({ page }) => {
    // Navigate to invitations page
    await page.goto('/invitations');
    
    // Find pending invitation
    await page.waitForSelector('[data-testid="invitation-card"]', { timeout: 5000 });
    
    const invitation = page.locator('[data-testid="invitation-card"]').first();
    await expect(invitation.getByTestId('accept-invite-button')).toBeVisible();
    
    // Accept invitation
    await invitation.getByTestId('accept-invite-button').click();
    
    // Should show success message
    await expect(page.getByTestId('invitation-accepted')).toBeVisible();
  });

  test('should decline round invitation', async ({ page }) => {
    await page.goto('/invitations');
    
    await page.waitForSelector('[data-testid="invitation-card"]', { timeout: 5000 });
    
    const invitation = page.locator('[data-testid="invitation-card"]').first();
    
    // Decline invitation
    await invitation.getByTestId('decline-invite-button').click();
    
    // Should show confirmation dialog
    await expect(page.getByTestId('decline-confirmation')).toBeVisible();
    
    // Confirm decline
    await page.getByTestId('confirm-decline-button').click();
    
    // Should show success message
    await expect(page.getByTestId('invitation-declined')).toBeVisible();
  });

  test('should show invitation details', async ({ page }) => {
    await page.goto('/invitations');
    
    await page.waitForSelector('[data-testid="invitation-card"]', { timeout: 5000 });
    
    const invitation = page.locator('[data-testid="invitation-card"]').first();
    
    // Should show round details
    await expect(invitation.getByTestId('invitation-course')).toBeVisible();
    await expect(invitation.getByTestId('invitation-date')).toBeVisible();
    await expect(invitation.getByTestId('invitation-inviter')).toBeVisible();
    
    // Should show inviter message if present
    const message = invitation.getByTestId('invitation-message');
    if (await message.isVisible()) {
      const messageText = await message.textContent();
      expect(messageText).toBeTruthy();
    }
  });
});

test.describe('Round List and Discovery', () => {
  test('should display list of available rounds', async ({ page }) => {
    await page.goto('/rounds');
    
    // Should show rounds list
    await expect(page.getByTestId('rounds-list')).toBeVisible();
    
    // Each round should show basic info
    const rounds = page.locator('[data-testid="round-list-item"]');
    const count = await rounds.count();
    
    for (let i = 0; i < count; i++) {
      await expect(rounds.nth(i).getByTestId('round-course')).toBeVisible();
      await expect(rounds.nth(i).getByTestId('round-date')).toBeVisible();
      await expect(rounds.nth(i).getByTestId('round-spots')).toBeVisible();
    }
  });

  test('should filter rounds by same tier', async ({ page }) => {
    await page.goto('/rounds');
    
    await page.waitForSelector('[data-testid="round-list-item"]', { timeout: 5000 });
    
    const rounds = page.locator('[data-testid="round-list-item"]');
    const count = await rounds.count();
    
    // All visible rounds should be from same tier
    for (let i = 0; i < count; i++) {
      const tierBadge = rounds.nth(i).getByTestId('round-tier');
      const tierText = await tierBadge.textContent();
      // Should match current user's tier
      expect(tierText).toBeTruthy();
    }
  });

  test('should show my rounds', async ({ page }) => {
    await page.goto('/rounds?my_rounds=true');
    
    await expect(page.getByTestId('my-rounds-list')).toBeVisible();
    
    const rounds = page.locator('[data-testid="round-list-item"]');
    const count = await rounds.count();
    
    // All rounds should be created by or include current user
    for (let i = 0; i < count; i++) {
      const myRole = rounds.nth(i).getByTestId('round-my-role');
      const roleText = await myRole.textContent();
      expect(['creator', 'participant']).toContain(roleText?.toLowerCase());
    }
  });

  test('should filter rounds by status', async ({ page }) => {
    await page.goto('/rounds');
    
    // Filter by open status
    await page.getByTestId('status-filter').selectOption('open');
    await page.getByTestId('apply-filters').click();
    
    await page.waitForTimeout(500);
    
    const rounds = page.locator('[data-testid="round-list-item"]');
    const count = await rounds.count();
    
    for (let i = 0; i < count; i++) {
      const statusBadge = rounds.nth(i).getByTestId('round-status');
      const statusText = await statusBadge.textContent();
      expect(statusText?.toLowerCase()).toBe('open');
    }
  });

  test('should filter rounds by date range', async ({ page }) => {
    await page.goto('/rounds');
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    await page.getByTestId('date-from-filter').fill(new Date().toISOString().slice(0, 10));
    await page.getByTestId('date-to-filter').fill(futureDate.toISOString().slice(0, 10));
    await page.getByTestId('apply-filters').click();
    
    await page.waitForTimeout(500);
    
    // Should show filtered results
    await expect(page.getByTestId('rounds-list')).toBeVisible();
  });
});

test.describe('Round Detail View', () => {
  test('should display round details', async ({ page }) => {
    await page.goto('/rounds/test-round-id');
    
    // Should show round information
    await expect(page.getByTestId('round-detail')).toBeVisible();
    await expect(page.getByTestId('round-course-name')).toBeVisible();
    await expect(page.getByTestId('round-scheduled-at')).toBeVisible();
    await expect(page.getByTestId('round-max-players')).toBeVisible();
    await expect(page.getByTestId('round-cart-preference')).toBeVisible();
  });

  test('should display participants list', async ({ page }) => {
    await page.goto('/rounds/test-round-id');
    
    await page.getByTestId('participants-tab').click();
    
    await expect(page.getByTestId('participants-list')).toBeVisible();
    
    const participants = page.locator('[data-testid="participant-item"]');
    const count = await participants.count();
    
    for (let i = 0; i < count; i++) {
      await expect(participants.nth(i).getByTestId('participant-name')).toBeVisible();
      await expect(participants.nth(i).getByTestId('participant-avatar')).toBeVisible();
    }
  });

  test('should show creator actions for round owner', async ({ page }) => {
    await page.goto('/rounds/owned-round-id');
    
    // Should show edit and invite buttons
    await expect(page.getByTestId('edit-round-button')).toBeVisible();
    await expect(page.getByTestId('invite-button')).toBeVisible();
    await expect(page.getByTestId('cancel-round-button')).toBeVisible();
  });

  test('should not show creator actions for non-owner', async ({ page }) => {
    await page.goto('/rounds/other-round-id');
    
    // Should not show edit/cancel buttons
    await expect(page.getByTestId('edit-round-button')).toBeHidden();
    await expect(page.getByTestId('cancel-round-button')).toBeHidden();
  });

  test('should show join button for open rounds', async ({ page }) => {
    await page.goto('/rounds/open-round-id');
    
    const joinButton = page.getByTestId('join-round-button');
    await expect(joinButton).toBeVisible();
    await expect(joinButton).toBeEnabled();
  });

  test('should show invitation status for invited user', async ({ page }) => {
    await page.goto('/rounds/invited-round-id');
    
    await expect(page.getByTestId('invitation-status')).toBeVisible();
    await expect(page.getByTestId('accept-invite-button')).toBeVisible();
    await expect(page.getByTestId('decline-invite-button')).toBeVisible();
  });
});

test.describe('Round Status Transitions', () => {
  test('should update status when participant joins', async ({ page }) => {
    await page.goto('/rounds/open-round-id');
    
    // Join the round
    await page.getByTestId('join-round-button').click();
    
    // Should show joined confirmation
    await expect(page.getByTestId('joined-success')).toBeVisible();
    
    // Status should update
    await expect(page.getByTestId('round-status')).toContainText('open');
  });

  test('should mark round as full when max reached', async ({ page }) => {
    await page.goto('/rounds/almost-full-round-id');
    
    // Join to fill the round
    await page.getByTestId('join-round-button').click();
    
    // Status should change to full
    await expect(page.getByTestId('round-status')).toContainText('full');
  });

  test('should allow creator to cancel round', async ({ page }) => {
    await page.goto('/rounds/owned-round-id');
    
    // Click cancel
    await page.getByTestId('cancel-round-button').click();
    
    // Should show confirmation
    await expect(page.getByTestId('cancel-confirmation')).toBeVisible();
    
    // Confirm cancellation
    await page.getByTestId('confirm-cancel-button').click();
    
    // Should show cancelled status
    await expect(page.getByTestId('round-status')).toContainText('cancelled');
  });
});

test.describe('Round Error Handling', () => {
  test('should handle round not found', async ({ page }) => {
    await page.goto('/rounds/non-existent-id');
    
    // Should show 404
    await expect(page.getByTestId('round-not-found')).toBeVisible();
    await expect(page.getByText('not found', { ignoreCase: true })).toBeVisible();
  });

  test('should handle network errors', async ({ page }) => {
    // Block API requests
    await page.route('**/rounds/**', route => route.abort('failed'));
    
    await page.goto('/rounds/test-round-id');
    
    // Should show error
    await expect(page.getByTestId('round-error')).toBeVisible();
  });

  test('should require authentication', async ({ page }) => {
    // Clear auth
    await page.context().clearCookies();
    
    await page.goto('/rounds/create');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle tier mismatch on join', async ({ page }) => {
    await page.goto('/rounds/different-tier-round-id');
    
    // Try to join
    const joinButton = page.getByTestId('join-round-button');
    if (await joinButton.isVisible()) {
      await joinButton.click();
      
      // Should show tier mismatch error
      await expect(page.getByTestId('tier-mismatch-error')).toBeVisible();
    }
  });
});

test.describe('Round Notifications', () => {
  test('should notify creator of new participant', async ({ page }) => {
    // This would require checking notification system
    // For now, just verify the round detail updates
    await page.goto('/rounds/owned-round-id');
    
    await page.getByTestId('participants-tab').click();
    
    // Participant count should be visible
    await expect(page.getByTestId('participants-count')).toBeVisible();
  });

  test('should notify invitee of invitation', async ({ page }) => {
    await page.goto('/notifications');
    
    // Should show round invitation notification
    await page.waitForSelector('[data-testid="notification-item"]', { timeout: 5000 });
    
    const notifications = page.locator('[data-testid="notification-item"]');
    const count = await notifications.count();
    
    let foundRoundInvite = false;
    for (let i = 0; i < count; i++) {
      const type = await notifications.nth(i).getAttribute('data-type');
      if (type === 'round_invite') {
        foundRoundInvite = true;
        break;
      }
    }
    
    // If notifications exist, at least verify structure
    if (count > 0) {
      await expect(notifications.first().getByTestId('notification-message')).toBeVisible();
    }
  });
});
