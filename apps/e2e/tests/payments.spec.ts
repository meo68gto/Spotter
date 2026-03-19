import { test, expect } from '@playwright/test';

/**
 * Stripe Payments E2E Tests
 * 
 * Validates payment flows:
 * - Member tier upgrades (FREE → SELECT, SELECT → SUMMIT)
 * - Organizer tier upgrades (Bronze → Silver → Gold)
 * - Event registration payments
 * - Subscription management
 * - Webhook handling
 */

test.describe('Member Tier Upgrade Payments', () => {
  test('should redirect to Stripe Checkout for SELECT upgrade', async ({ page }) => {
    await page.goto('/upgrade/select');
    
    // Verify upgrade page loads
    await expect(page.getByTestId('upgrade-page')).toBeVisible();
    await expect(page.getByTestId('tier-name')).toContainText('Select');
    
    // Select billing interval
    await page.getByTestId('billing-monthly').click();
    await expect(page.getByTestId('price-display')).toContainText('$9.99');
    
    // Click upgrade button
    await page.getByTestId('upgrade-button').click();
    
    // Should redirect to Stripe
    await expect(page).toHaveURL(/.*stripe.com\/checkout.*/);
    
    // Verify checkout session details
    await expect(page.getByText('Select Membership')).toBeVisible();
    await expect(page.getByText('$9.99')).toBeVisible();
  });

  test('should redirect to Stripe Checkout for SUMMIT upgrade', async ({ page }) => {
    await page.goto('/upgrade/summit');
    
    await expect(page.getByTestId('tier-name')).toContainText('Summit');
    
    // Select yearly billing
    await page.getByTestId('billing-yearly').click();
    await expect(page.getByTestId('price-display')).toContainText('$299.90');
    await expect(page.getByTestId('savings-badge')).toContainText('Save $60');
    
    await page.getByTestId('upgrade-button').click();
    
    await expect(page).toHaveURL(/.*stripe.com\/checkout.*/);
    await expect(page.getByText('Summit Membership')).toBeVisible();
    await expect(page.getByText('$299.90')).toBeVisible();
  });

  test('should show proration for tier upgrade', async ({ page }) => {
    // Simulate existing SELECT subscription
    await page.goto('/upgrade/summit?test_existing_tier=select');
    
    await expect(page.getByTestId('proration-notice')).toBeVisible();
    await expect(page.getByTestId('proration-amount')).toContainText('Credit applied');
    
    const finalPrice = await page.getByTestId('final-price').textContent();
    expect(finalPrice).toContain('$');
  });

  test('should handle successful checkout completion', async ({ page }) => {
    // Simulate returning from successful Stripe checkout
    await page.goto('/checkout/success?session_id=cs_test_123');
    
    await expect(page.getByTestId('success-message')).toBeVisible();
    await expect(page.getByTestId('success-message')).toContainText('Welcome to');
    
    // Verify tier updated
    await expect(page.getByTestId('new-tier-badge')).toBeVisible();
    
    // Should redirect to dashboard after delay
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('should handle cancelled checkout', async ({ page }) => {
    await page.goto('/checkout/cancel');
    
    await expect(page.getByTestId('cancelled-message')).toBeVisible();
    await expect(page.getByTestId('try-again-button')).toBeVisible();
    
    // Can navigate back to upgrade page
    await page.getByTestId('try-again-button').click();
    await expect(page).toHaveURL(/.*upgrade.*/);
  });
});

test.describe('Organizer Tier Upgrade Payments', () => {
  test('should redirect to Stripe Checkout for Silver upgrade', async ({ page }) => {
    await page.goto('/organizer/upgrade/silver');
    
    await expect(page.getByTestId('tier-name')).toContainText('Silver');
    await expect(page.getByTestId('price-display')).toContainText('$29.99');
    
    await page.getByTestId('upgrade-button').click();
    
    await expect(page).toHaveURL(/.*stripe.com\/checkout.*/);
    await expect(page.getByText('Silver Organizer Plan')).toBeVisible();
  });

  test('should redirect to Stripe Checkout for Gold upgrade', async ({ page }) => {
    await page.goto('/organizer/upgrade/gold');
    
    await expect(page.getByTestId('tier-name')).toContainText('Gold');
    await expect(page.getByTestId('price-display')).toContainText('$99.99');
    
    await page.getByTestId('upgrade-button').click();
    
    await expect(page).toHaveURL(/.*stripe.com\/checkout.*/);
    await expect(page.getByText('Gold Organizer Plan')).toBeVisible();
  });

  test('should show tier comparison before upgrade', async ({ page }) => {
    await page.goto('/organizer/upgrade/silver');
    
    await expect(page.getByTestId('tier-comparison')).toBeVisible();
    
    // Compare features
    const comparisonTable = page.getByTestId('comparison-table');
    await expect(comparisonTable).toContainText('Events per year');
    await expect(comparisonTable).toContainText('5');
    await expect(comparisonTable).toContainText('20');
    
    await expect(comparisonTable).toContainText('Priority Support');
    await expect(comparisonTable.locator('[data-tier="bronze"] [data-feature="priority-support"]')).toContainText('—');
    await expect(comparisonTable.locator('[data-tier="silver"] [data-feature="priority-support"]')).toContainText('✓');
  });
});

test.describe('Event Registration Payments', () => {
  test('should handle paid event registration', async ({ page }) => {
    await page.goto('/events/paid-event-123');
    
    await expect(page.getByTestId('entry-fee')).toContainText('$50.00');
    
    await page.getByTestId('register-button').click();
    
    // Should go to checkout with event details
    await expect(page).toHaveURL(/.*stripe.com\/checkout.*/);
    await expect(page.getByText('Event Registration')).toBeVisible();
    await expect(page.getByText('$50.00')).toBeVisible();
  });

  test('should handle free event registration', async ({ page }) => {
    await page.goto('/events/free-event-456');
    
    await expect(page.getByTestId('entry-fee')).toContainText('Free');
    
    await page.getByTestId('register-button').click();
    
    // Should complete registration without payment
    await expect(page.getByTestId('registration-success')).toBeVisible();
    await expect(page).toHaveURL(/.*registration\/success.*/);
  });

  test('should apply member discount for paid events', async ({ page }) => {
    // Simulate SELECT tier member
    await page.goto('/events/paid-event-123?test_tier=select');
    
    await expect(page.getByTestId('original-price')).toContainText('$50.00');
    await expect(page.getByTestId('discounted-price')).toContainText('$40.00');
    await expect(page.getByTestId('discount-badge')).toContainText('20% off');
    
    await page.getByTestId('register-button').click();
    
    await expect(page).toHaveURL(/.*stripe.com\/checkout.*/);
    await expect(page.getByText('$40.00')).toBeVisible();
  });

  test('should handle early bird pricing', async ({ page }) => {
    await page.goto('/events/early-bird-event-789');
    
    await expect(page.getByTestId('early-bird-badge')).toBeVisible();
    await expect(page.getByTestId('early-bird-price')).toContainText('$30.00');
    await expect(page.getByTestId('regular-price')).toContainText('$50.00');
    
    // Countdown timer
    await expect(page.getByTestId('early-bird-countdown')).toBeVisible();
  });
});

test.describe('Customer Portal', () => {
  test('should redirect to Stripe Customer Portal', async ({ page }) => {
    await page.goto('/billing');
    
    await page.getByTestId('manage-billing-button').click();
    
    // Should redirect to Stripe Customer Portal
    await expect(page).toHaveURL(/.*stripe.com\/billing.*/);
    
    // Portal should show subscription details
    await expect(page.getByText('Subscription')).toBeVisible();
    await expect(page.getByText('Payment methods')).toBeVisible();
  });

  test('should show current subscription details', async ({ page }) => {
    await page.goto('/billing');
    
    await expect(page.getByTestId('current-plan')).toBeVisible();
    await expect(page.getByTestId('billing-interval')).toBeVisible();
    await expect(page.getByTestId('next-billing-date')).toBeVisible();
    
    // Payment method
    await expect(page.getByTestId('payment-method')).toBeVisible();
    await expect(page.getByTestId('card-ending')).toMatchText(/\*\*\*\* \d{4}/);
  });

  test('should allow cancellation', async ({ page }) => {
    await page.goto('/billing');
    
    await page.getByTestId('cancel-subscription-button').click();
    
    // Confirmation dialog
    await expect(page.getByTestId('cancel-confirmation-dialog')).toBeVisible();
    await page.getByTestId('confirm-cancel-button').click();
    
    // Should show cancellation scheduled
    await expect(page.getByTestId('cancellation-scheduled')).toBeVisible();
    await expect(page.getByTestId('access-until-date')).toBeVisible();
  });
});

test.describe('Payment Method Management', () => {
  test('should allow adding new payment method', async ({ page }) => {
    await page.goto('/billing/payment-methods');
    
    await page.getByTestId('add-payment-method-button').click();
    
    // Should open Stripe Elements
    await expect(page.getByTestId('card-element')).toBeVisible();
    
    // Fill test card details
    await page.locator('iframe[name^="__privateStripeFrame"]').first().contentFrame()
      ?.locator('[placeholder="Card number"]').fill('4242424242424242');
    
    await page.getByTestId('save-payment-method-button').click();
    
    await expect(page.getByTestId('payment-method-saved')).toBeVisible();
  });

  test('should handle card decline', async ({ page }) => {
    await page.goto('/upgrade/select');
    await page.getByTestId('upgrade-button').click();
    
    // Use decline test card
    await page.locator('iframe[name^="__privateStripeFrame"]').first().contentFrame()
      ?.locator('[placeholder="Card number"]').fill('4000000000000002');
    
    await page.getByTestId('pay-button').click();
    
    await expect(page.getByTestId('payment-error')).toBeVisible();
    await expect(page.getByTestId('payment-error')).toContainText('declined');
  });

  test('should handle 3D Secure authentication', async ({ page }) => {
    await page.goto('/upgrade/select');
    await page.getByTestId('upgrade-button').click();
    
    // Use 3D Secure test card
    await page.locator('iframe[name^="__privateStripeFrame"]').first().contentFrame()
      ?.locator('[placeholder="Card number"]').fill('4000002500003155');
    
    await page.getByTestId('pay-button').click();
    
    // Should show 3D Secure iframe
    await expect(page.locator('iframe[src*="3d-secure"]')).toBeVisible();
    
    // Complete authentication
    await page.locator('iframe[src*="3d-secure"]').contentFrame()
      ?.getByTestId('complete-authentication-button').click();
    
    await expect(page).toHaveURL('/checkout/success');
  });
});

test.describe('Invoice and Billing History', () => {
  test('should display billing history', async ({ page }) => {
    await page.goto('/billing/history');
    
    await expect(page.getByTestId('billing-history-list')).toBeVisible();
    
    // Should show past invoices
    const invoices = page.locator('[data-testid="invoice-item"]');
    await expect(invoices).toHaveCountGreaterThan(0);
    
    // Invoice details
    const firstInvoice = invoices.first();
    await expect(firstInvoice.locator('[data-testid="invoice-date"]')).toBeVisible();
    await expect(firstInvoice.locator('[data-testid="invoice-amount"]')).toMatchText(/\$[\d.]+/);
    await expect(firstInvoice.locator('[data-testid="invoice-status"]')).toBeVisible();
  });

  test('should allow downloading invoices', async ({ page }) => {
    await page.goto('/billing/history');
    
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="download-invoice-button"]').first().click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/invoice.*\.pdf/);
  });

  test('should show upcoming invoice preview', async ({ page }) => {
    await page.goto('/billing');
    
    await expect(page.getByTestId('upcoming-invoice')).toBeVisible();
    await expect(page.getByTestId('upcoming-amount')).toBeVisible();
    await expect(page.getByTestId('upcoming-billing-date')).toBeVisible();
  });
});

test.describe('Webhook Handling', () => {
  test('should handle checkout.session.completed webhook', async ({ page }) => {
    // Simulate webhook by directly calling success URL
    await page.goto('/checkout/success?session_id=cs_test_completed');
    
    await expect(page.getByTestId('success-message')).toBeVisible();
    
    // Verify subscription is active
    await page.goto('/billing');
    await expect(page.getByTestId('subscription-status')).toContainText('Active');
  });

  test('should handle invoice.payment_failed webhook', async ({ page }) => {
    // Simulate failed payment
    await page.goto('/billing?test_payment_failed=true');
    
    await expect(page.getByTestId('payment-failed-banner')).toBeVisible();
    await expect(page.getByTestId('update-payment-button')).toBeVisible();
  });

  test('should handle customer.subscription.updated webhook', async ({ page }) => {
    // Simulate tier change
    await page.goto('/billing?test_tier_changed=select');
    
    await expect(page.getByTestId('plan-updated-banner')).toBeVisible();
    await expect(page.getByTestId('new-tier-name')).toContainText('Select');
  });
});

test.describe('Payment Security', () => {
  test('should use Stripe Elements for card input', async ({ page }) => {
    await page.goto('/upgrade/select');
    await page.getByTestId('upgrade-button').click();
    
    // Card input should be in Stripe iframe
    const stripeFrame = page.locator('iframe[name^="__privateStripeFrame"]');
    await expect(stripeFrame).toBeVisible();
    
    // Should not see raw card input in DOM
    const rawCardInput = page.locator('input[name="cardNumber"]:not([data-stripe])');
    await expect(rawCardInput).toHaveCount(0);
  });

  test('should validate coupon codes', async ({ page }) => {
    await page.goto('/upgrade/select');
    
    await page.getByTestId('coupon-code-input').fill('INVALIDCODE');
    await page.getByTestId('apply-coupon-button').click();
    
    await expect(page.getByTestId('coupon-error')).toBeVisible();
    await expect(page.getByTestId('coupon-error')).toContainText('Invalid code');
    
    // Valid coupon
    await page.getByTestId('coupon-code-input').fill('SPOTTER50');
    await page.getByTestId('apply-coupon-button').click();
    
    await expect(page.getByTestId('coupon-success')).toBeVisible();
    await expect(page.getByTestId('discounted-price')).toBeVisible();
  });

  test('should prevent duplicate payments', async ({ page }) => {
    await page.goto('/upgrade/select');
    await page.getByTestId('upgrade-button').click();
    
    // Fill payment details
    await page.locator('iframe[name^="__privateStripeFrame"]').first().contentFrame()
      ?.locator('[placeholder="Card number"]').fill('4242424242424242');
    
    // Click pay multiple times rapidly
    await page.getByTestId('pay-button').click();
    await page.getByTestId('pay-button').click();
    await page.getByTestId('pay-button').click();
    
    // Should only process once
    await expect(page.getByTestId('payment-processing')).toBeVisible();
    await expect(page.getByTestId('pay-button')).toBeDisabled();
  });
});

test.describe('Refund Flow', () => {
  test('should allow organizers to issue refunds', async ({ page }) => {
    await page.goto('/organizer/events/event-123/registrations');
    
    // Find paid registration
    const paidRegistration = page.locator('[data-testid="registration-item"][data-payment-status="paid"]').first();
    await paidRegistration.locator('[data-testid="refund-button"]').click();
    
    // Refund dialog
    await expect(page.getByTestId('refund-dialog')).toBeVisible();
    await page.getByTestId('refund-amount-input').fill('50.00');
    await page.getByTestId('refund-reason-input').fill('Event cancelled');
    
    await page.getByTestId('confirm-refund-button').click();
    
    await expect(page.getByTestId('refund-success')).toBeVisible();
  });

  test('should show refund status to registrant', async ({ page }) => {
    await page.goto('/registrations/event-123');
    
    await expect(page.getByTestId('refund-status')).toBeVisible();
    await expect(page.getByTestId('refund-status')).toContainText('Refunded');
    await expect(page.getByTestId('refund-amount')).toContainText('$50.00');
  });
});
