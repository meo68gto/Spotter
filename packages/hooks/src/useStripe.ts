import { useState, useCallback } from 'react';
import { useStripe as useStripeRN, usePaymentSheet } from '@stripe/stripe-react-native';
import type { FeatureKey } from '@spotter/types';
import { hasAccess } from '@spotter/types';

export interface StripePaymentParams {
  eventId: string;
  amount: number;
  currency: string;
}

export interface StripeCheckoutParams {
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * Shared Stripe checkout hook.
 * On mobile: uses PaymentSheet (Stripe React Native).
 * On web: redirects to Stripe Checkout session URL.
 */
export function useStripe(options?: {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Present the mobile Stripe PaymentSheet for a given clientSecret.
   */
  const presentSheet = useCallback(
    async (clientSecret: string): Promise<boolean> => {
      const { error: initError } = await initPaymentSheet({
        customerEphemeralKeySecret: clientSecret,
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Spotter',
        allowsDelayedPaymentMethods: false,
      });

      if (initError) {
        const msg = initError.message ?? 'Failed to initialize payment sheet';
        setError(msg);
        options?.onError?.(msg);
        return false;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        const msg = presentError.message ?? 'Payment was cancelled or failed';
        setError(msg);
        options?.onError?.(msg);
        return false;
      }

      options?.onSuccess?.();
      return true;
    },
    [initPaymentSheet, presentPaymentSheet, options],
  );

  /**
   * Open Stripe Checkout (web) in a new tab.
   */
  const openCheckoutSession = useCallback(
    async (checkoutUrl: string): Promise<boolean> => {
      if (typeof window === 'undefined') return false;
      window.open(checkoutUrl, '_blank');
      options?.onSuccess?.();
      return true;
    },
    [options],
  );

  return {
    loading,
    error,
    presentSheet,
    openCheckoutSession,
    clearError: () => setError(null),
  };
}
