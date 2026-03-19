import { test, expect } from '@playwright/test';
import { OrganizerTier } from '../../packages/types/src/organizer';

/**
 * Organizer Portal E2E Tests
 * 
 * Validates organizer tier-based feature access:
 * - Bronze: 5 events/year, 500 registrations, basic features
 * - Silver: 20 events/year, 2500 registrations, priority support, analytics
 * - Gold: Unlimited events/registrations, API keys, white-label, exports
 */

const organizerTiers: OrganizerTier[] = ['bronze', 'silver', 'gold'];

test.describe('Organizer Dashboard Access', () => {
  for (const tier of organizerTiers) {
    test(`${tier} tier organizer should access dashboard`, async ({ page }) => {
      await page.goto('/organizer/dashboard');
      
      await expect(page.getByTestId('organizer-dashboard')).toBeVisible();
      await expect(page.getByTestId('tier-badge')).toContainText(tier, { ignoreCase: true });
    });
  }
});

test.describe('Event Creation Limits', () => {
  test('Bronze tier should see event creation limit (5/year)', async ({ page }) => {
    await page.goto('/organizer/events');
    
    const quotaDisplay = page.getByTestId('events-quota');
    await expect(quotaDisplay).toBeVisible();
    await expect(quotaDisplay).toContainText('5');
    await expect(quotaDisplay).toContainText('per year');
    
    // Check current usage
    const usageText = await quotaDisplay.textContent();
    const match = usageText?.match(/(\d+)\s*\/\s*5/);
    if (match) {
      const used = parseInt(match[1], 10);
      
      if (used >= 5) {
        // Should see limit reached message
        await expect(page.getByTestId('limit-reached-banner')).toBeVisible();
        await expect(page.getByTestId('create-event-button')).toBeDisabled();
      }
    }
  });

  test('Silver tier should see event creation limit (20/year)', async ({ page }) => {
    await page.goto('/organizer/events');
    
    const quotaDisplay = page.getByTestId('events-quota');
    await expect(quotaDisplay).toBeVisible();
    await expect(quotaDisplay).toContainText('20');
    await expect(quotaDisplay).toContainText('per year');
  });

  test('Gold tier should see unlimited events', async ({ page }) => {
    await page.goto('/organizer/events');
    
    const quotaDisplay = page.getByTestId('events-quota');
    await expect(quotaDisplay).toContainText('Unlimited');
    await expect(quotaDisplay).not.toContainText('per year');
  });

  test('Bronze tier should be blocked from creating 6th event', async ({ page }) => {
    // Navigate to event creation with limit exceeded
    await page.goto('/organizer/events/new?test_quota_exceeded=true');
    
    const upgradePrompt = page.getByTestId('quota-upgrade-prompt');
    await expect(upgradePrompt).toBeVisible();
    await expect(upgradePrompt).toContainText('Upgrade to Silver');
    
    const createButton = page.getByTestId('create-event-submit');
    await expect(createButton).toBeDisabled();
  });
});

test.describe('Registration Limits', () => {
  test('Bronze tier should have 500 registration limit', async ({ page }) => {
    await page.goto('/organizer/events/event-123/registrations');
    
    const quotaDisplay = page.getByTestId('registrations-quota');
    await expect(quotaDisplay).toBeVisible();
    await expect(quotaDisplay).toContainText('500');
  });

  test('Silver tier should have 2500 registration limit', async ({ page }) => {
    await page.goto('/organizer/events/event-123/registrations');
    
    const quotaDisplay = page.getByTestId('registrations-quota');
    await expect(quotaDisplay).toBeVisible();
    await expect(quotaDisplay).toContainText('2,500');
  });

  test('Gold tier should have unlimited registrations', async ({ page }) => {
    await page.goto('/organizer/events/event-123/registrations');
    
    const quotaDisplay = page.getByTestId('registrations-quota');
    await expect(quotaDisplay).toContainText('Unlimited');
  });

  test('should show warning when approaching registration limit', async ({ page }) => {
    // Simulate 90% quota usage
    await page.goto('/organizer/events/event-123/registrations?test_quota_percent=90');
    
    const warningBanner = page.getByTestId('quota-warning-banner');
    await expect(warningBanner).toBeVisible();
    await expect(warningBanner).toContainText('90%');
    await expect(warningBanner).toContainText('approaching limit');
  });
});

test.describe('Analytics Access', () => {
  test('Bronze tier should have basic analytics only', async ({ page }) => {
    await page.goto('/organizer/analytics');
    
    // Basic metrics visible
    await expect(page.getByTestId('metric-total-registrations')).toBeVisible();
    await expect(page.getByTestId('metric-check-in-rate')).toBeVisible();
    
    // Advanced metrics hidden
    await expect(page.getByTestId('metric-revenue-trend')).toBeHidden();
    await expect(page.getByTestId('metric-attendee-demographics')).toBeHidden();
    await expect(page.getByTestId('metric-engagement-score')).toBeHidden();
    
    // Upgrade prompt for advanced analytics
    const upgradePrompt = page.getByTestId('analytics-upgrade-prompt');
    await expect(upgradePrompt).toBeVisible();
  });

  test('Silver tier should have advanced analytics', async ({ page }) => {
    await page.goto('/organizer/analytics');
    
    // All metrics visible
    await expect(page.getByTestId('metric-total-registrations')).toBeVisible();
    await expect(page.getByTestId('metric-check-in-rate')).toBeVisible();
    await expect(page.getByTestId('metric-revenue-trend')).toBeVisible();
    await expect(page.getByTestId('metric-attendee-demographics')).toBeVisible();
    await expect(page.getByTestId('metric-engagement-score')).toBeVisible();
    
    // No upgrade prompt
    await expect(page.getByTestId('analytics-upgrade-prompt')).toBeHidden();
  });

  test('Gold tier should have full analytics with custom reports', async ({ page }) => {
    await page.goto('/organizer/analytics');
    
    // All Silver features
    await expect(page.getByTestId('metric-total-registrations')).toBeVisible();
    await expect(page.getByTestId('metric-revenue-trend')).toBeVisible();
    
    // Gold-only features
    await expect(page.getByTestId('custom-report-builder')).toBeVisible();
    await expect(page.getByTestId('api-analytics')).toBeVisible();
    await expect(page.getByTestId('white-label-branding')).toBeVisible();
  });

  test('analytics export should be tier-gated', async ({ page }) => {
    await page.goto('/organizer/analytics');
    
    const exportButton = page.getByTestId('export-analytics-button');
    
    // Bronze: Export disabled
    await expect(exportButton).toBeDisabled();
    await expect(page.getByTestId('export-upgrade-tooltip')).toBeVisible();
    
    // Silver+: Export enabled (tested in other tiers)
  });
});

test.describe('API Keys (Gold Only)', () => {
  test('Bronze tier should NOT see API keys section', async ({ page }) => {
    await page.goto('/organizer/settings');
    
    const apiKeysSection = page.getByTestId('api-keys-section');
    await expect(apiKeysSection).toBeHidden();
    
    // Direct navigation should redirect or show upgrade
    await page.goto('/organizer/settings/api-keys');
    await expect(page.getByTestId('upgrade-required-page')).toBeVisible();
    await expect(page.getByText('Gold tier required')).toBeVisible();
  });

  test('Silver tier should NOT see API keys section', async ({ page }) => {
    await page.goto('/organizer/settings');
    
    const apiKeysSection = page.getByTestId('api-keys-section');
    await expect(apiKeysSection).toBeHidden();
    
    await page.goto('/organizer/settings/api-keys');
    await expect(page.getByTestId('upgrade-required-page')).toBeVisible();
  });

  test('Gold tier should see API keys management', async ({ page }) => {
    await page.goto('/organizer/settings/api-keys');
    
    await expect(page.getByTestId('api-keys-management')).toBeVisible();
    
    // Create new key button
    const createButton = page.getByTestId('create-api-key-button');
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    
    // Existing keys list
    await expect(page.getByTestId('api-keys-list')).toBeVisible();
  });

  test('Gold tier should be able to create API key', async ({ page }) => {
    await page.goto('/organizer/settings/api-keys');
    
    await page.getByTestId('create-api-key-button').click();
    
    // Fill in key details
    await page.getByLabel('Key Name').fill('Test Integration Key');
    await page.getByLabel('Rate Limit (requests/minute)').fill('100');
    
    // Select permissions
    await page.getByTestId('permission-read-events').check();
    await page.getByTestId('permission-read-registrations').check();
    
    await page.getByTestId('create-key-submit').click();
    
    // Should show the new key (one-time display)
    await expect(page.getByTestId('api-key-display')).toBeVisible();
    await expect(page.getByTestId('api-key-value')).toContainText('sk_live_');
    
    // Copy button
    await expect(page.getByTestId('copy-api-key-button')).toBeVisible();
  });

  test('Gold tier should be able to revoke API key', async ({ page }) => {
    await page.goto('/organizer/settings/api-keys');
    
    // Find existing key and revoke
    const revokeButton = page.locator('[data-testid="revoke-api-key"]').first();
    await revokeButton.click();
    
    // Confirm dialog
    await page.getByTestId('confirm-revoke-button').click();
    
    // Key should be marked as revoked
    await expect(page.getByTestId('key-revoked-badge').first()).toBeVisible();
  });
});

test.describe('White-Label Options (Gold Only)', () => {
  test('Bronze tier should NOT see white-label settings', async ({ page }) => {
    await page.goto('/organizer/settings/branding');
    
    await expect(page.getByTestId('upgrade-required-page')).toBeVisible();
    await expect(page.getByText('Gold tier required for white-label')).toBeVisible();
  });

  test('Silver tier should NOT see white-label settings', async ({ page }) => {
    await page.goto('/organizer/settings/branding');
    
    await expect(page.getByTestId('upgrade-required-page')).toBeVisible();
  });

  test('Gold tier should see white-label branding options', async ({ page }) => {
    await page.goto('/organizer/settings/branding');
    
    await expect(page.getByTestId('white-label-settings')).toBeVisible();
    
    // Custom domain
    await expect(page.getByTestId('custom-domain-input')).toBeVisible();
    
    // Logo upload
    await expect(page.getByTestId('logo-upload')).toBeVisible();
    
    // Color customization
    await expect(page.getByTestId('primary-color-picker')).toBeVisible();
    await expect(page.getByTestId('secondary-color-picker')).toBeVisible();
    
    // Custom CSS
    await expect(page.getByTestId('custom-css-editor')).toBeVisible();
  });

  test('Gold tier should be able to configure custom domain', async ({ page }) => {
    await page.goto('/organizer/settings/branding');
    
    await page.getByTestId('custom-domain-input').fill('events.mygolfclub.com');
    await page.getByTestId('verify-domain-button').click();
    
    // Should show DNS instructions
    await expect(page.getByTestId('dns-instructions')).toBeVisible();
    await expect(page.getByTestId('dns-instructions')).toContainText('CNAME');
  });
});

test.describe('Team Member Management', () => {
  test('all tiers should be able to invite team members', async ({ page }) => {
    await page.goto('/organizer/team');
    
    await expect(page.getByTestId('invite-member-button')).toBeVisible();
    await expect(page.getByTestId('invite-member-button')).toBeEnabled();
  });

  test('all tiers should have role-based permissions', async ({ page }) => {
    await page.goto('/organizer/team');
    
    // Invite with role selection
    await page.getByTestId('invite-member-button').click();
    
    await page.getByLabel('Email').fill('newmember@example.com');
    await page.getByLabel('Role').selectOption('manager');
    
    // Role description should update
    await expect(page.getByTestId('role-permissions-description')).toContainText('Create and edit events');
    
    await page.getByTestId('send-invite-button').click();
    
    // Success message
    await expect(page.getByTestId('invite-sent-success')).toBeVisible();
  });

  test('Gold tier should have additional team collaboration features', async ({ page }) => {
    await page.goto('/organizer/team');
    
    // Advanced permissions
    await expect(page.getByTestId('custom-permissions-toggle')).toBeVisible();
    
    // Team activity log
    await expect(page.getByTestId('team-activity-log')).toBeVisible();
    
    // API key management per member
    await expect(page.getByTestId('member-api-access-section')).toBeVisible();
  });
});

test.describe('Support Access', () => {
  test('Bronze tier should have standard support', async ({ page }) => {
    await page.goto('/organizer/support');
    
    await expect(page.getByTestId('support-email-form')).toBeVisible();
    await expect(page.getByTestId('support-chat-button')).toBeHidden();
    
    // Response time expectation
    await expect(page.getByTestId('support-response-time')).toContainText('24-48 hours');
  });

  test('Silver tier should have priority support', async ({ page }) => {
    await page.goto('/organizer/support');
    
    await expect(page.getByTestId('support-email-form')).toBeVisible();
    await expect(page.getByTestId('support-chat-button')).toBeVisible();
    
    // Priority response time
    await expect(page.getByTestId('support-response-time')).toContainText('4-8 hours');
    await expect(page.getByTestId('priority-badge')).toBeVisible();
  });

  test('Gold tier should have dedicated support', async ({ page }) => {
    await page.goto('/organizer/support');
    
    await expect(page.getByTestId('support-email-form')).toBeVisible();
    await expect(page.getByTestId('support-chat-button')).toBeVisible();
    
    // Dedicated support
    await expect(page.getByTestId('dedicated-support-badge')).toBeVisible();
    await expect(page.getByTestId('support-response-time')).toContainText('1 hour');
    await expect(page.getByTestId('dedicated-rep-info')).toBeVisible();
    
    // Phone support option
    await expect(page.getByTestId('phone-support-button')).toBeVisible();
  });
});

test.describe('Export Functionality', () => {
  test('Bronze tier should NOT have export functionality', async ({ page }) => {
    await page.goto('/organizer/events/event-123/registrations');
    
    const exportButton = page.getByTestId('export-registrations-button');
    await expect(exportButton).toBeDisabled();
    
    await expect(page.getByTestId('export-upgrade-tooltip')).toBeVisible();
  });

  test('Silver tier should have basic exports', async ({ page }) => {
    await page.goto('/organizer/events/event-123/registrations');
    
    const exportButton = page.getByTestId('export-registrations-button');
    await expect(exportButton).toBeEnabled();
    
    await exportButton.click();
    
    // Export options
    await expect(page.getByTestId('export-csv-option')).toBeVisible();
    await expect(page.getByTestId('export-excel-option')).toBeVisible();
    
    // Advanced exports not available
    await expect(page.getByTestId('export-pdf-option')).toBeHidden();
    await expect(page.getByTestId('export-api-option')).toBeHidden();
  });

  test('Gold tier should have all export options', async ({ page }) => {
    await page.goto('/organizer/events/event-123/registrations');
    
    await page.getByTestId('export-registrations-button').click();
    
    // All export options
    await expect(page.getByTestId('export-csv-option')).toBeVisible();
    await expect(page.getByTestId('export-excel-option')).toBeVisible();
    await expect(page.getByTestId('export-pdf-option')).toBeVisible();
    await expect(page.getByTestId('export-api-option')).toBeVisible();
    
    // Custom export builder
    await expect(page.getByTestId('custom-export-builder')).toBeVisible();
  });
});

test.describe('Organizer Tier Upgrade Flow', () => {
  test('should show upgrade prompts for tier-limited features', async ({ page }) => {
    await page.goto('/organizer/events');
    
    // Simulate at event limit
    await page.evaluate(() => {
      (window as any).__EVENTS_USED__ = 5;
      (window as any).__EVENTS_LIMIT__ = 5;
    });
    
    await page.reload();
    
    const upgradeBanner = page.getByTestId('tier-upgrade-banner');
    await expect(upgradeBanner).toBeVisible();
    await expect(upgradeBanner).toContainText('Upgrade to Silver');
    
    const upgradeButton = page.getByTestId('upgrade-tier-button');
    await expect(upgradeButton).toBeVisible();
    await expect(upgradeButton).toHaveAttribute('href', '/organizer/upgrade/silver');
  });

  test('should handle tier upgrade process', async ({ page }) => {
    await page.goto('/organizer/upgrade/silver');
    
    await expect(page.getByTestId('upgrade-page')).toBeVisible();
    
    // See upgrade benefits
    await expect(page.getByTestId('tier-comparison-table')).toBeVisible();
    await expect(page.getByTestId('silver-benefits')).toBeVisible();
    
    // Select billing interval
    await page.getByTestId('billing-monthly').click();
    await expect(page.getByTestId('upgrade-price')).toContainText('$29.99');
    
    await page.getByTestId('billing-yearly').click();
    await expect(page.getByTestId('upgrade-price')).toContainText('$299.90');
    await expect(page.getByTestId('yearly-savings')).toContainText('Save $60');
    
    // Proceed to checkout
    await page.getByTestId('proceed-to-checkout').click();
    await expect(page).toHaveURL(/.*stripe.com.*/);
  });
});

test.describe('Organizer Portal Navigation', () => {
  test('should have consistent navigation across all tiers', async ({ page }) => {
    await page.goto('/organizer/dashboard');
    
    // Main navigation items
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('nav-events')).toBeVisible();
    await expect(page.getByTestId('nav-registrations')).toBeVisible();
    await expect(page.getByTestId('nav-analytics')).toBeVisible();
    await expect(page.getByTestId('nav-team')).toBeVisible();
    await expect(page.getByTestId('nav-settings')).toBeVisible();
  });

  test('should show tier badge in navigation', async ({ page }) => {
    await page.goto('/organizer/dashboard');
    
    const navTierBadge = page.getByTestId('nav-tier-badge');
    await expect(navTierBadge).toBeVisible();
    
    // Should match current tier
    const tierText = await navTierBadge.textContent();
    expect(['Bronze', 'Silver', 'Gold']).toContain(tierText);
  });
});
