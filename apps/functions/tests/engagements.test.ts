import { describe, expect, it } from 'vitest';
import { billableMinutesFromSeconds, mapStripeIntentToOrderStatus } from '../supabase/functions/_shared/engagement-utils';

describe('mapStripeIntentToOrderStatus', () => {
  it('maps succeeded to paid', () => {
    expect(mapStripeIntentToOrderStatus('succeeded')).toBe('paid');
  });

  it('maps processing to processing', () => {
    expect(mapStripeIntentToOrderStatus('processing')).toBe('processing');
  });

  it('maps requires_payment_method', () => {
    expect(mapStripeIntentToOrderStatus('requires_payment_method')).toBe('requires_payment_method');
  });

  it('falls back unknown states to created', () => {
    expect(mapStripeIntentToOrderStatus('requires_action')).toBe('created');
  });
});

describe('billableMinutesFromSeconds', () => {
  it('rounds up partial minute', () => {
    expect(billableMinutesFromSeconds(61)).toBe(2);
  });

  it('handles zero safely', () => {
    expect(billableMinutesFromSeconds(0)).toBe(0);
  });

  it('clamps negatives to zero', () => {
    expect(billableMinutesFromSeconds(-10)).toBe(0);
  });
});
