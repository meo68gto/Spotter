import { Page, expect } from '@playwright/test';
// @ts-ignore - types package not linked in e2e
import { TierSlug, TIER_DEFINITIONS, TierFeatures } from '@spotter/types/src/tier';
// @ts-ignore - types package not linked in e2e
import { OrganizerTier, ORGANIZER_TIERS } from '@spotter/types/src/organizer';

/**
 * Helper functions for tier-based testing
 * Provides utilities for validating tier gates and feature access
 */

// Member tier feature expectations
export const MEMBER_TIER_FEATURES: Record<TierSlug, (keyof TierFeatures)[]> = {
  free: [
    'matchmaking',
  ],
  select: [
    'matchmaking',
    'unlimitedSessions',
    'videoAnalysis',
    'priorityMatching',
    'advancedAnalytics',
    'coachMessaging',
    'eventAccess',
    'profileBadges',
    'adFree',
  ],
  summit: [
    'matchmaking',
    'unlimitedSessions',
    'videoAnalysis',
    'priorityMatching',
    'advancedAnalytics',
    'coachMessaging',
    'eventAccess',
    'profileBadges',
    'earlyAccess',
    'adFree',
    'boostedVisibility',
    'groupSessions',
  ],
};

// Organizer tier feature expectations
export const ORGANIZER_TIER_LIMITS = {
  bronze: {
    eventsPerYear: 5,
    registrationsPerYear: 500,
    hasApiAccess: false,
    hasWhiteLabel: false,
    hasPrioritySupport: false,
  },
  silver: {
    eventsPerYear: 20,
    registrationsPerYear: 2500,
    hasApiAccess: false,
    hasWhiteLabel: false,
    hasPrioritySupport: true,
  },
  gold: {
    eventsPerYear: null, // unlimited
    registrationsPerYear: null, // unlimited
    hasApiAccess: true,
    hasWhiteLabel: true,
    hasPrioritySupport: true,
  },
};

/**
 * Check if a feature element is visible/accessible based on tier
 */
export async function expectFeatureAccess(
  page: Page,
  feature: string,
  shouldHaveAccess: boolean
): Promise<void> {
  const featureElement = page.getByTestId(`feature-${feature}`);
  
  if (shouldHaveAccess) {
    await expect(featureElement).toBeVisible();
    // Check it's not disabled or showing upgrade prompt
    await expect(featureElement).not.toHaveAttribute('data-locked', 'true');
  } else {
    // Either hidden or shows upgrade prompt
    const isHidden = await featureElement.isHidden().catch(() => true);
    if (!isHidden) {
      // If visible, it should be locked or show upgrade prompt
      await expect(featureElement).toHaveAttribute('data-locked', 'true');
    }
  }
}

/**
 * Verify tier badge is displayed correctly
 */
export async function expectTierBadge(
  page: Page,
  expectedTier: TierSlug | OrganizerTier
): Promise<void> {
  const tierBadge = page.getByTestId('tier-badge');
  await expect(tierBadge).toBeVisible();
  await expect(tierBadge).toHaveText(new RegExp(expectedTier, 'i'));
}

/**
 * Navigate to a page and verify tier-based access
 */
export async function navigateWithTierCheck(
  page: Page,
  path: string,
  options: {
    allowedTiers: TierSlug[];
    currentTier: TierSlug;
    upgradePrompt?: boolean;
  }
): Promise<void> {
  const { allowedTiers, currentTier, upgradePrompt = true } = options;
  const hasAccess = allowedTiers.includes(currentTier);
  
  await page.goto(path);
  
  if (hasAccess) {
    // Should see the page content
    await expect(page.getByTestId('page-content')).toBeVisible();
    await expect(page.getByTestId('upgrade-prompt')).toBeHidden();
  } else if (upgradePrompt) {
    // Should see upgrade prompt
    await expect(page.getByTestId('upgrade-prompt')).toBeVisible();
    await expect(page.getByText(/upgrade to access/i)).toBeVisible();
  } else {
    // Should be redirected or see 403
    await expect(page.getByTestId('access-denied')).toBeVisible();
  }
}

/**
 * Get tier limits for validation
 */
export function getTierLimits(tier: TierSlug) {
  return TIER_DEFINITIONS[tier];
}

/**
 * Get organizer tier limits
 */
export function getOrganizerTierLimits(tier: OrganizerTier) {
  return ORGANIZER_TIER_LIMITS[tier];
}

/**
 * Validate quota display on page
 */
export async function validateQuotaDisplay(
  page: Page,
  used: number,
  limit: number | null,
  resource: string
): Promise<void> {
  const quotaElement = page.getByTestId(`quota-${resource}`);
  await expect(quotaElement).toBeVisible();
  
  if (limit === null) {
    await expect(quotaElement).toContainText('Unlimited');
  } else {
    await expect(quotaElement).toContainText(`${used} / ${limit}`);
    const percentage = Math.round((used / limit) * 100);
    await expect(quotaElement).toContainText(`${percentage}%`);
  }
}

/**
 * Check if user can perform action based on tier
 */
export async function canPerformAction(
  page: Page,
  action: string,
  requiredTier: TierSlug,
  currentTier: TierSlug
): Promise<boolean> {
  const tierOrder: Record<TierSlug, number> = {
    free: 1,
    select: 2,
    summit: 3,
  };
  
  const hasAccess = tierOrder[currentTier] >= tierOrder[requiredTier];
  
  const actionButton = page.getByTestId(`action-${action}`);
  const isVisible = await actionButton.isVisible().catch(() => false);
  
  if (!isVisible) return false;
  
  const isDisabled = await actionButton.isDisabled().catch(() => false);
  const isLocked = await actionButton.getAttribute('data-locked') === 'true';
  
  return hasAccess && !isDisabled && !isLocked;
}

/**
 * Test data builders for creating tier-specific test scenarios
 */
export const TestDataBuilders = {
  memberProfile(tier: TierSlug) {
    return {
      tier,
      features: MEMBER_TIER_FEATURES[tier],
      limits: getTierLimits(tier),
    };
  },
  
  organizerAccount(tier: OrganizerTier) {
    return {
      tier,
      limits: getOrganizerTierLimits(tier),
    };
  },
};
