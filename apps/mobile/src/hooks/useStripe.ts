import { useState, useCallback } from 'react';
import { useStripe as useStripeRN, usePaymentSheet } from '@stripe/stripe-react-native';
import { invokeFunction } from '../lib/api';
import { isWeb } from '../theme/design';

interface PaymentParams {
  eventId: string;
  amount: number;
  currency: string;
  paymentMethod: 'card' | 'apple_pay' | 'google_pay';
}

interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}

export function useStripe() {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processPayment = useCallback(
    async (params: PaymentParams): Promise<{ success: boolean; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        if (isWeb) {
          // Web fallback - use checkout session
          const result = await invokeFunction<CheckoutResponse>('stripe-checkout', {
            method: 'POST',
            body: {
              type: 'event_registration',
              eventId: params.eventId,
            },
          });

          if (result.success && result.checkoutUrl) {
            // Open checkout URL in new window
            window.open(result.checkoutUrl, '_blank');
            return { success: true };
          }

          throw new Error(result.error || 'Failed to create checkout session');
        }

        // Mobile - use PaymentSheet
        // First, create a payment intent
        const { clientSecret } = await invokeFunction<{ clientSecret: string }>(
          'stripe-create-payment-intent',
          {
            method: 'POST',
            body: {
              eventId: params.eventId,
              amount: params.amount,
              currency: params.currency,
            },
          }
        );

        if (!clientSecret) {
          throw new Error('Failed to initialize payment');
        }

        // Initialize PaymentSheet
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Spotter',
          allowsDelayedPaymentMethods: false,
          style: 'automatic',
          googlePay: params.paymentMethod === 'google_pay' ? {
            merchantCountryCode: 'US',
            testEnv: __DEV__,
            currencyCode: params.currency.toUpperCase(),
          } : undefined,
          applePay: params.paymentMethod === 'apple_pay' ? {
            merchantCountryCode: 'US',
            merchantCapabilities: ['3DS', 'credit', 'debit'],
            supportedNetworks: ['visa', 'mastercard', 'amex'],
          } : undefined,
        });

        if (initError) {
          throw new Error(initError.message);
        }

        // Present PaymentSheet
        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          throw new Error(presentError.message);
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment failed';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [initPaymentSheet, presentPaymentSheet]
  );

  const openCustomerPortal = useCallback(
    async (userId: string): Promise<{ success: boolean; url?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invokeFunction<{ success: boolean; portalUrl: string }>(
          'stripe-customer-portal',
          {
            method: 'POST',
            body: { userId },
          }
        );

        if (result.success && result.portalUrl) {
          if (isWeb) {
            window.open(result.portalUrl, '_blank');
          }
          return { success: true, url: result.portalUrl };
        }

        throw new Error('Failed to open customer portal');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open portal';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    processPayment,
    openCustomerPortal,
    loading,
    error,
  };
}
