import { test, expect } from '@playwright/test';
import { TierSlug } from '../../packages/types/src/tier';
import { 
  MEMBER_TIER_FEATURES, 
  expectFeatureAccess,
  expectTierBadge,
  navigateWithTierCheck 
} from './fixtures/tier-helpers';

/**
 * Tier Gating E2E Tests
 * 
 * Validates that feature access is properly gated by membership tier:
 * - FREE: Basic matching only
 * - SELECT: Unlimited sessions, video analysis, priority matching
 * - SUMMIT: All features including early access and group sessions
 */

const tiers: TierSlug[] = ['free', 'select', 'summit'];

// Test suite for tier badge display
test.describe('Tier Badge Display', () => {
  for (const tier of tiers) {
    test(`should display ${tier} tier badge on dashboard`, async ({ page }) => {
      // Use tier-specific auth state
      await page.context().addCookies([{ 
        name: 'auth-tier', 
        value: tier, 
        domain: 'localhost', 
        path: '/' 
      }]);
      
      await page.goto('/dashboard');
      await expectTierBadge(page, tier);
    });
  }
});

// Test suite for feature access by tier
test.describe('Feature Access Control', () => {
  test.describe('Matchmaking', () => {
    for (const tier of tiers) {
      test(`${tier} tier should have matchmaking access`, async ({ page }) => {
        await page.goto('/matching');
        await expectFeatureAccess(page, 'matchmaking', true);
      });
    }
  });

  test.describe('Video Analysis', () => {
    test('FREE tier should NOT have video analysis', async ({ page }) => {
      await page.goto('/video-analysis');
      await expectFeatureAccess(page, 'video-analysis', false);
    });

    test('SELECT tier should have video analysis', async ({ page }) => {
      await page.goto('/video-analysis');
      await expectFeatureAccess(page, 'video-analysis', true);
    });

    test('SUMMIT tier should have video analysis', async ({ page }) => {
      await page.goto('/video-analysis');
      await expectFeatureAccess(page, 'video-analysis', true);
    });
  });

  test.describe('Priority Matching', () => {
    test('FREE tier should NOT have priority matching', async ({ page }) => {
      await page.goto('/matching');
      const priorityToggle = page.getByTestId('priority-matching-toggle');
      await expect(priorityToggle).toBeHidden();
    });

    test('SELECT tier should have priority matching', async ({ page }) => {
      await page.goto('/matching');
      const priorityToggle = page.getByTestId('priority-matching-toggle');
      await expect(priorityToggle).toBeVisible();
      await expect(priorityToggle).toBeEnabled();
    });

    test('SUMMIT tier should have priority matching', async ({ page }) => {
      await page.goto('/matching');
      const priorityToggle = page.getByTestId('priority-matching-toggle');
      await expect(priorityToggle).toBeVisible();
      await expect(priorityToggle).toBeEnabled();
    });
  });

  test.describe('Unlimited Sessions', () => {
    test('FREE tier should see session limits', async ({ page }) => {
      await page.goto('/sessions');
      const limitIndicator = page.getByTestId('session-limit-indicator');
      await expect(limitIndicator).toBeVisible();
      await expect(limitIndicator).toContainText('5'); // FREE limit
    });

    test('SELECT tier should see unlimited sessions', async ({ page }) => {
      await page.goto('/sessions');
      const limitIndicator = page.getByTestId('session-limit-indicator');
      await expect(limitIndicator).toContainText('Unlimited');
    });

    test('SUMMIT tier should see unlimited sessions', async ({ page }) => {
      await page.goto('/sessions');
      const limitIndicator = page.getByTestId('session-limit-indicator');
      await expect(limitIndicator).toContainText('Unlimited');
    });
  });

  test.describe('Advanced Analytics', () => {
    test('FREE tier should NOT have advanced analytics', async ({ page }) => {
      await page.goto('/analytics');
      await expectFeatureAccess(page, 'advanced-analytics', false);
    });

    test('SELECT tier should have advanced analytics', async ({ page }) => {
      await page.goto('/analytics');
      await expectFeatureAccess(page, 'advanced-analytics', true);
    });

    test('SUMMIT tier should have advanced analytics', async ({ page }) => {
      await page.goto('/analytics');
      await expectFeatureAccess(page, 'advanced-analytics', true);
    });
  });

  test.describe('Coach Messaging', () => {
    test('FREE tier should NOT have coach messaging', async ({ page }) => {
      await page.goto('/coaches');
      const messageButton = page.getByTestId('message-coach-button');
      await expect(messageButton).toBeHidden();
    });

    test('SELECT tier should have coach messaging', async ({ page }) => {
      await page.goto('/coaches');
      const messageButton = page.getByTestId('message-coach-button');
      await expect(messageButton).toBeVisible();
      await expect(messageButton).toBeEnabled();
    });

    test('SUMMIT tier should have coach messaging', async ({ page }) => {
      await page.goto('/coaches');
      const messageButton = page.getByTestId('message-coach-button');
      await expect(messageButton).toBeVisible();
      await expect(messageButton).toBeEnabled();
    });
  });

  test.describe('Event Access', () => {
    test('FREE tier should NOT see premium events', async ({ page }) => {
      await page.goto('/events');
      const premiumEvents = page.getByTestId('premium-events-section');
      await expect(premiumEvents).toBeHidden();
    });

    test('SELECT tier should see premium events', async ({ page }) => {
      await page.goto('/events');
      const premiumEvents = page.getByTestId('premium-events-section');
      await expect(premiumEvents).toBeVisible();
    });

    test('SUMMIT tier should see premium events', async ({ page }) => {
      await page.goto('/events');
      const premiumEvents = page.getByTestId('premium-events-section');
      await expect(premiumEvents).toBeVisible();
    });
  });

  test.describe('Profile Badges', () => {
    test('FREE tier should NOT have custom badges', async ({ page }) => {
      await page.goto('/profile');
      const badgeSection = page.getByTestId('profile-badges-section');
      await expect(badgeSection).toBeHidden();
    });

    test('SELECT tier should have custom badges', async ({ page }) => {
      await page.goto('/profile');
      const badgeSection = page.getByTestId('profile-badges-section');
      await expect(badgeSection).toBeVisible();
    });

    test('SUMMIT tier should have custom badges', async ({ page }) => {
      await page.goto('/profile');
      const badgeSection = page.getByTestId('profile-badges-section');
      await expect(badgeSection).toBeVisible();
    });
  });

  test.describe('Early Access (SUMMIT only)', () => {
    test('FREE tier should NOT see early access features', async ({ page }) => {
      await page.goto('/features/early-access');
      await expect(page.getByTestId('early-access-badge')).toBeHidden();
    });

    test('SELECT tier should NOT see early access features', async ({ page }) => {
      await page.goto('/features/early-access');
      await expect(page.getByTestId('early-access-badge')).toBeHidden();
    });

    test('SUMMIT tier should see early access features', async ({ page }) => {
      await page.goto('/features/early-access');
      await expect(page.getByTestId('early-access-badge')).toBeVisible();
    });
  });

  test.describe('Group Sessions (SUMMIT only)', () => {
    test('FREE tier should NOT have group session hosting', async ({ page }) => {
      await page.goto('/sessions/new');
      const groupOption = page.getByTestId('group-session-option');
      await expect(groupOption).toBeHidden();
    });

    test('SELECT tier should NOT have group session hosting', async ({ page }) => {
      await page.goto('/sessions/new');
      const groupOption = page.getByTestId('group-session-option');
      await expect(groupOption).toBeHidden();
    });

    test('SUMMIT tier should have group session hosting', async ({ page }) => {
      await page.goto('/sessions/new');
      const groupOption = page.getByTestId('group-session-option');
      await expect(groupOption).toBeVisible();
      await expect(groupOption).toBeEnabled();
    });
  });

  test.describe('Boosted Visibility (SUMMIT only)', () => {
    test('FREE tier should NOT have boosted visibility', async ({ page }) => {
      await page.goto('/profile/settings');
      const boostToggle = page.getByTestId('boosted-visibility-toggle');
      await expect(boostToggle).toBeHidden();
    });

    test('SELECT tier should NOT have boosted visibility', async ({ page }) => {
      await page.goto('/profile/settings');
      const boostToggle = page.getByTestId('boosted-visibility-toggle');
      await expect(boostToggle).toBeHidden();
    });

    test('SUMMIT tier should have boosted visibility', async ({ page }) => {
      await page.goto('/profile/settings');
      const boostToggle = page.getByTestId('boosted-visibility-toggle');
      await expect(boostToggle).toBeVisible();
      await expect(boostToggle).toBeEnabled();
    });
  });
});

// Test suite for upgrade prompts
test.describe('Upgrade Prompts', () => {
  test('FREE tier should see upgrade prompt for premium features', async ({ page }) => {
    await page.goto('/video-analysis');
    const upgradePrompt = page.getByTestId('upgrade-prompt');
    await expect(upgradePrompt).toBeVisible();
    await expect(upgradePrompt).toContainText('Upgrade to Select');
    
    // Check upgrade CTA
    const upgradeButton = page.getByTestId('upgrade-cta-button');
    await expect(upgradeButton).toBeVisible();
    await expect(upgradeButton).toHaveAttribute('href', '/upgrade/select');
  });

  test('SELECT tier should see upgrade prompt for SUMMIT features', async ({ page }) => {
    await page.goto('/features/early-access');
    const upgradePrompt = page.getByTestId('upgrade-prompt');
    await expect(upgradePrompt).toBeVisible();
    await expect(upgradePrompt).toContainText('Upgrade to Summit');
    
    const upgradeButton = page.getByTestId('upgrade-cta-button');
    await expect(upgradeButton).toHaveAttribute('href', '/upgrade/summit');
  });

  test('SUMMIT tier should NOT see upgrade prompts', async ({ page }) => {
    await page.goto('/features/early-access');
    const upgradePrompt = page.getByTestId('upgrade-prompt');
    await expect(upgradePrompt).toBeHidden();
  });
});

// Test suite for quota enforcement
test.describe('Quota Enforcement', () => {
  test('FREE tier should enforce match limits', async ({ page }) => {
    await page.goto('/matching');
    
    // Check limit indicator
    const limitIndicator = page.getByTestId('match-limit-indicator');
    await expect(limitIndicator).toBeVisible();
    await expect(limitIndicator).toContainText('3'); // FREE monthly limit
    
    // Attempt to exceed limit should show upgrade prompt
    await page.goto('/matching?test_exceed_limit=true');
    const limitReached = page.getByTestId('limit-reached-message');
    await expect(limitReached).toBeVisible();
    await expect(limitReached).toContainText('Upgrade for unlimited matches');
  });

  test('FREE tier should enforce session limits', async ({ page }) => {
    await page.goto('/sessions');
    
    const limitIndicator = page.getByTestId('session-limit-indicator');
    await expect(limitIndicator).toBeVisible();
    await expect(limitIndicator).toContainText('5'); // FREE monthly limit
  });

  test('FREE tier should enforce video submission limits', async ({ page }) => {
    await page.goto('/video-analysis');
    
    const limitIndicator = page.getByTestId('video-limit-indicator');
    await expect(limitIndicator).toBeVisible();
    await expect(limitIndicator).toContainText('0'); // FREE has no video submissions
  });

  test('SELECT tier should enforce video submission limits', async ({ page }) => {
    await page.goto('/video-analysis');
    
    const limitIndicator = page.getByTestId('video-limit-indicator');
    await expect(limitIndicator).toBeVisible();
    await expect(limitIndicator).toContainText('10'); // SELECT monthly limit
  });

  test('SUMMIT tier should have unlimited video submissions', async ({ page }) => {
    await page.goto('/video-analysis');
    
    const limitIndicator = page.getByTestId('video-limit-indicator');
    await expect(limitIndicator).toContainText('Unlimited');
  });
});
