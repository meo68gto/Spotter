import { useState, useCallback } from 'react';
import { Linking } from 'react-native';
import { invokeFunction } from '../lib/api';
import { isWeb } from '../theme/design';
import type { TierSlug } from '@spotter/types';

interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}

export function useUpgrade() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateUpgrade = useCallback(
    async (
      targetTier: TierSlug,
      billingInterval: 'monthly' | 'yearly' = 'monthly'
    ): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        // Get current user
        const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser());
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        const result = await invokeFunction<CheckoutResponse>('stripe-checkout', {
          method: 'POST',
          body: {
            type: 'tier_upgrade',
            userId: user.id,
            targetTier,
            billingInterval,
          },
        });

        if (result.success && result.checkoutUrl) {
          // Open checkout URL
          if (isWeb) {
            window.open(result.checkoutUrl, '_blank');
          } else {
            await Linking.openURL(result.checkoutUrl);
          }
          
          return { 
            success: true, 
            checkoutUrl: result.checkoutUrl 
          };
        }

        throw new Error(result.error || 'Failed to create checkout session');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upgrade failed';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const initiateOrganizerUpgrade = useCallback(
    async (
      organizerTier: 'bronze' | 'silver' | 'gold',
      billingInterval: 'monthly' | 'yearly' = 'monthly'
    ): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser());
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        const result = await invokeFunction<CheckoutResponse>('stripe-checkout', {
          method: 'POST',
          body: {
            type: 'organizer_tier',
            userId: user.id,
            organizerTier,
            billingInterval,
          },
        });

        if (result.success && result.checkoutUrl) {
          if (isWeb) {
            window.open(result.checkoutUrl, '_blank');
          } else {
            await Linking.openURL(result.checkoutUrl);
          }
          
          return { 
            success: true, 
            checkoutUrl: result.checkoutUrl 
          };
        }

        throw new Error(result.error || 'Failed to create checkout session');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upgrade failed';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const openCustomerPortal = useCallback(
    async (): Promise<{ success: boolean; url?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser());
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        const result = await invokeFunction<{ success: boolean; portalUrl: string }>(
          'stripe-customer-portal',
          {
            method: 'POST',
            body: { userId: user.id },
          }
        );

        if (result.success && result.portalUrl) {
          if (isWeb) {
            window.open(result.portalUrl, '_blank');
          } else {
            await Linking.openURL(result.portalUrl);
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
    initiateUpgrade,
    initiateOrganizerUpgrade,
    openCustomerPortal,
    loading,
    error,
  };
}
