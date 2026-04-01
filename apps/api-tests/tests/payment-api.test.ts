import { SupabaseClient } from '@supabase/supabase-js';
import { 
  createAuthenticatedClient,
  createOrganizerClient,
  callEdgeFunction,
  TEST_USERS,
  TEST_ORGANIZERS 
} from './utils/supabase-client';

/**
 * Payment API Integration Tests
 * 
 * Tests:
 * - Stripe checkout session creation
 * - Customer portal access
 * - Webhook handling
 * - Refund processing
 * - Subscription management
 */

describe('Stripe Checkout Edge Function', () => {
  test('should create checkout session for SELECT upgrade', async () => {
    const response = await callEdgeFunction('stripe-checkout', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
        tier: 'select',
        billingInterval: 'monthly',
        successUrl: 'http://localhost:3000/checkout/success',
        cancelUrl: 'http://localhost:3000/checkout/cancel',
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.sessionId).toBeDefined();
    expect(data.url).toBeDefined();
    expect(data.url).toContain('stripe.com');
  });

  test('should create checkout session for SUMMIT upgrade', async () => {
    const response = await callEdgeFunction('stripe-checkout', {
      method: 'POST',
      body: {
        userId: TEST_USERS.select.id,
        tier: 'summit',
        billingInterval: 'yearly',
        successUrl: 'http://localhost:3000/checkout/success',
        cancelUrl: 'http://localhost:3000/checkout/cancel',
      },
      userToken: 'mock-token-select',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.sessionId).toBeDefined();
    expect(data.url).toBeDefined();
  });

  test('should create checkout session for organizer Silver upgrade', async () => {
    const response = await callEdgeFunction('stripe-checkout', {
      method: 'POST',
      body: {
        organizerId: TEST_ORGANIZERS.bronze.id,
        tier: 'silver',
        billingInterval: 'monthly',
        successUrl: 'http://localhost:3000/organizer/checkout/success',
        cancelUrl: 'http://localhost:3000/organizer/checkout/cancel',
      },
      userToken: 'mock-token-org-bronze',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.sessionId).toBeDefined();
    expect(data.url).toBeDefined();
  });

  test('should calculate proration for tier upgrade', async () => {
    const response = await callEdgeFunction('stripe-checkout', {
      method: 'POST',
      body: {
        userId: TEST_USERS.select.id,
        tier: 'summit',
        billingInterval: 'monthly',
        currentTier: 'select',
        proration: true,
        successUrl: 'http://localhost:3000/checkout/success',
        cancelUrl: 'http://localhost:3000/checkout/cancel',
      },
      userToken: 'mock-token-select',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.prorationAmount).toBeDefined();
    expect(data.prorationAmount).toBeLessThan(0); // Credit applied
  });

  test('should create checkout for event registration', async () => {
    const response = await callEdgeFunction('stripe-checkout', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
        eventId: 'event-123',
        registrationId: 'reg-456',
        amount: 5000, // $50.00 in cents
        successUrl: 'http://localhost:3000/events/registration/success',
        cancelUrl: 'http://localhost:3000/events/registration/cancel',
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.sessionId).toBeDefined();
    expect(data.amount).toBe(5000);
  });

  test('should apply member discount for paid events', async () => {
    const response = await callEdgeFunction('stripe-checkout', {
      method: 'POST',
      body: {
        userId: TEST_USERS.select.id,
        eventId: 'event-123',
        registrationId: 'reg-456',
        amount: 5000,
        applyDiscount: true,
        userTier: 'select',
        successUrl: 'http://localhost:3000/events/registration/success',
        cancelUrl: 'http://localhost:3000/events/registration/cancel',
      },
      userToken: 'mock-token-select',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.originalAmount).toBe(5000);
    expect(data.discountedAmount).toBe(4000); // 20% off
    expect(data.discountApplied).toBe(true);
  });

  test('should require authentication', async () => {
    const response = await callEdgeFunction('stripe-checkout', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
        tier: 'select',
      },
    });
    
    expect(response.status).toBe(401);
  });
});

describe('Stripe Customer Portal Edge Function', () => {
  test('should create customer portal session', async () => {
    const response = await callEdgeFunction('stripe-customer-portal', {
      method: 'POST',
      body: {
        userId: TEST_USERS.select.id,
        returnUrl: 'http://localhost:3000/billing',
      },
      userToken: 'mock-token-select',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.url).toBeDefined();
    expect(data.url).toContain('stripe.com');
  });

  test('should create organizer customer portal session', async () => {
    const response = await callEdgeFunction('stripe-customer-portal', {
      method: 'POST',
      body: {
        organizerId: TEST_ORGANIZERS.silver.id,
        returnUrl: 'http://localhost:3000/organizer/billing',
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.url).toBeDefined();
  });

  test('should return subscription details', async () => {
    const response = await callEdgeFunction('stripe-customer-portal', {
      method: 'GET',
      body: {
        userId: TEST_USERS.select.id,
      },
      userToken: 'mock-token-select',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.subscription).toBeDefined();
    expect(data.subscription.status).toBeDefined();
    expect(data.subscription.currentPeriodEnd).toBeDefined();
    expect(data.paymentMethod).toBeDefined();
  });
});

describe('Stripe Webhook Edge Function', () => {
  test('should handle checkout.session.completed', async () => {
    const response = await callEdgeFunction('stripe-webhook', {
      method: 'POST',
      body: {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            client_reference_id: TEST_USERS.free.id,
            metadata: {
              tier: 'select',
              userId: TEST_USERS.free.id,
            },
            subscription: 'sub_123',
            customer: 'cus_123',
          },
        },
      },
      headers: {
        'Stripe-Signature': 'test_signature',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.received).toBe(true);
    expect(data.tierUpdated).toBe(true);
  });

  test('should handle invoice.payment_succeeded', async () => {
    const response = await callEdgeFunction('stripe-webhook', {
      method: 'POST',
      body: {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_123',
            subscription: 'sub_123',
            customer: 'cus_123',
            billing_reason: 'subscription_cycle',
          },
        },
      },
      headers: {
        'Stripe-Signature': 'test_signature',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.received).toBe(true);
  });

  test('should handle invoice.payment_failed', async () => {
    const response = await callEdgeFunction('stripe-webhook', {
      method: 'POST',
      body: {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_123',
            subscription: 'sub_123',
            customer: 'cus_123',
            next_payment_attempt: Math.floor(Date.now() / 1000) + 86400,
          },
        },
      },
      headers: {
        'Stripe-Signature': 'test_signature',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.received).toBe(true);
    expect(data.notificationSent).toBe(true);
  });

  test('should handle customer.subscription.updated', async () => {
    const response = await callEdgeFunction('stripe-webhook', {
      method: 'POST',
      body: {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
            items: {
              data: [{
                price: {
                  id: 'price_summit_monthly',
                },
              }],
            },
            metadata: {
              userId: TEST_USERS.select.id,
            },
          },
        },
      },
      headers: {
        'Stripe-Signature': 'test_signature',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.received).toBe(true);
    expect(data.tierUpdated).toBe(true);
  });

  test('should handle customer.subscription.deleted', async () => {
    const response = await callEdgeFunction('stripe-webhook', {
      method: 'POST',
      body: {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            metadata: {
              userId: TEST_USERS.select.id,
            },
          },
        },
      },
      headers: {
        'Stripe-Signature': 'test_signature',
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.received).toBe(true);
    expect(data.tierDowngraded).toBe(true);
    expect(data.newTier).toBe('free');
  });

  test('should reject invalid webhook signature', async () => {
    const response = await callEdgeFunction('stripe-webhook', {
      method: 'POST',
      body: {
        type: 'checkout.session.completed',
        data: { object: {} },
      },
      headers: {
        'Stripe-Signature': 'invalid_signature',
      },
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('signature');
  });
});

describe('Payment Refund Edge Function', () => {
  test('should process full refund', async () => {
    const response = await callEdgeFunction('payments-refund-request', {
      method: 'POST',
      body: {
        organizerId: TEST_ORGANIZERS.silver.id,
        registrationId: 'reg-123',
        amount: 5000,
        reason: 'Event cancelled',
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.refundId).toBeDefined();
    expect(data.amount).toBe(5000);
    expect(data.status).toBe('succeeded');
  });

  test('should process partial refund', async () => {
    const response = await callEdgeFunction('payments-refund-request', {
      method: 'POST',
      body: {
        organizerId: TEST_ORGANIZERS.silver.id,
        registrationId: 'reg-123',
        amount: 2500,
        reason: 'Partial refund - changed to 9 holes',
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.refundId).toBeDefined();
    expect(data.amount).toBe(2500);
  });

  test('should deny refund exceeding payment amount', async () => {
    const response = await callEdgeFunction('payments-refund-request', {
      method: 'POST',
      body: {
        organizerId: TEST_ORGANIZERS.silver.id,
        registrationId: 'reg-123',
        amount: 10000, // More than original payment
        reason: 'Over refund',
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('exceeds');
  });

  test('should track refund in registration', async () => {
    const response = await callEdgeFunction('payments-refund-request', {
      method: 'POST',
      body: {
        organizerId: TEST_ORGANIZERS.silver.id,
        registrationId: 'reg-123',
        amount: 5000,
        reason: 'Event cancelled',
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.registrationUpdated).toBe(true);
    expect(data.registrationStatus).toBe('cancelled');
  });
});

describe('Payment Review Order Edge Function', () => {
  test('should create review order', async () => {
    const response = await callEdgeFunction('payments-review-order-create', {
      method: 'POST',
      body: {
        userId: TEST_USERS.free.id,
        eventId: 'event-123',
        registrationData: {
          name: 'Test User',
          email: 'test@example.com',
          handicap: 15,
        },
        amount: 5000,
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.orderId).toBeDefined();
    expect(data.amount).toBe(5000);
    expect(data.status).toBe('pending');
  });

  test('should get review order details', async () => {
    const response = await callEdgeFunction('payments-review-order-get', {
      method: 'GET',
      body: {
        orderId: 'order-123',
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.orderId).toBe('order-123');
    expect(data.amount).toBeDefined();
    expect(data.registrationData).toBeDefined();
  });

  test('should confirm review order', async () => {
    const response = await callEdgeFunction('payments-review-order-confirm', {
      method: 'POST',
      body: {
        orderId: 'order-123',
        paymentMethodId: 'pm_123',
      },
      userToken: 'mock-token-free',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.paymentIntentId).toBeDefined();
    expect(data.status).toBe('requires_action');
  });
});

describe('Payment Connect Onboard Edge Function', () => {
  test('should create Connect onboarding link', async () => {
    const response = await callEdgeFunction('payments-connect-onboard', {
      method: 'POST',
      body: {
        organizerId: TEST_ORGANIZERS.silver.id,
        returnUrl: 'http://localhost:3000/organizer/settings',
        refreshUrl: 'http://localhost:3000/organizer/settings',
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.url).toBeDefined();
    expect(data.url).toContain('stripe.com');
    expect(data.accountId).toBeDefined();
  });

  test('should check Connect account status', async () => {
    const response = await callEdgeFunction('payments-connect-onboard', {
      method: 'GET',
      body: {
        organizerId: TEST_ORGANIZERS.silver.id,
      },
      userToken: 'mock-token-org-silver',
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.accountId).toBeDefined();
    expect(data.chargesEnabled).toBeDefined();
    expect(data.payoutsEnabled).toBeDefined();
    expect(data.requirements).toBeDefined();
  });
});

describe('Payment RLS Policies', () => {
  let freeUserClient: SupabaseClient;

  beforeAll(async () => {
    freeUserClient = await createAuthenticatedClient('free');
  });

  test('users can read their own payment history', async () => {
    const { data, error } = await freeUserClient
      .from('payments')
      .select('*')
      .eq('user_id', TEST_USERS.free.id);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('users cannot read other users payments', async () => {
    const { data, error } = await freeUserClient
      .from('payments')
      .select('*')
      .eq('user_id', TEST_USERS.select.id);
    
    // Should return empty due to RLS
    expect(data).toHaveLength(0);
  });

  test('users can read their own subscriptions', async () => {
    const { data, error } = await freeUserClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', TEST_USERS.free.id)
      .single();
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
