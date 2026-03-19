"use client";

import { useState, useCallback } from "react";
import type { TierSlug } from "@spotter/types";

interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}

interface PortalResponse {
  success: boolean;
  portalUrl?: string;
  error?: string;
}

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = async (): Promise<string | null> => {
    // Get token from localStorage or your auth system
    const token = localStorage.getItem("spotter:auth-token");
    return token;
  };

  const invokeFunction = async <T,>(
    path: string,
    options?: {
      method?: "GET" | "POST";
      body?: Record<string, unknown>;
    }
  ): Promise<T> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const url = `${baseUrl}/functions/v1/${path}`;

    const response = await fetch(url, {
      method: options?.method ?? "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      data?: T;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || "Request failed");
    }

    return payload.data as T;
  };

  const initiateTierUpgrade = useCallback(
    async (
      userId: string,
      targetTier: TierSlug,
      billingInterval: "monthly" | "yearly" = "monthly"
    ): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invokeFunction<CheckoutResponse>("stripe-checkout", {
          method: "POST",
          body: {
            type: "tier_upgrade",
            userId,
            targetTier,
            billingInterval,
          },
        });

        if (result.success && result.checkoutUrl) {
          // Open checkout in same window for web
          window.location.href = result.checkoutUrl;
          return { success: true, checkoutUrl: result.checkoutUrl };
        }

        throw new Error(result.error || "Failed to create checkout session");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upgrade failed";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const initiateEventRegistration = useCallback(
    async (
      userId: string,
      eventId: string
    ): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invokeFunction<CheckoutResponse>("stripe-checkout", {
          method: "POST",
          body: {
            type: "event_registration",
            userId,
            eventId,
          },
        });

        if (result.success && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return { success: true, checkoutUrl: result.checkoutUrl };
        }

        throw new Error(result.error || "Failed to create checkout session");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Registration failed";
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
      userId: string,
      organizerTier: "bronze" | "silver" | "gold",
      billingInterval: "monthly" | "yearly" = "monthly"
    ): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invokeFunction<CheckoutResponse>("stripe-checkout", {
          method: "POST",
          body: {
            type: "organizer_tier",
            userId,
            organizerTier,
            billingInterval,
          },
        });

        if (result.success && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return { success: true, checkoutUrl: result.checkoutUrl };
        }

        throw new Error(result.error || "Failed to create checkout session");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upgrade failed";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const openCustomerPortal = useCallback(
    async (userId: string): Promise<{ success: boolean; url?: string; error?: string }> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invokeFunction<PortalResponse>("stripe-customer-portal", {
          method: "POST",
          body: { userId },
        });

        if (result.success && result.portalUrl) {
          window.open(result.portalUrl, "_blank");
          return { success: true, url: result.portalUrl };
        }

        throw new Error(result.error || "Failed to open customer portal");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to open portal";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    initiateTierUpgrade,
    initiateEventRegistration,
    initiateOrganizerUpgrade,
    openCustomerPortal,
    loading,
    error,
  };
}
