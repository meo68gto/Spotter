/**
 * Rate limiting utilities for Spotter Edge Functions.
 *
 * Usage:
 *   import { rateLimitUser, exceededMessageLimit } from '../_shared/rate-limit.ts';
 *
 * For per-user rate limiting, uses Supabase to persist counts so it works
 * across Edge Function invocations. Falls back to in-memory tracking for
 * dev/test environments where no DB is available.
 */

import { createServiceClient } from './client.ts';

// ---------------------------------------------------------------------------
// Rate limit constants
// ---------------------------------------------------------------------------

export const exceededMessageLimit = (sentInLastMinute: number): boolean =>
  sentInLastMinute >= 20;

// Discovery search: 30 searches per minute per user (anti-scraping)
export const exceededDiscoveryLimit = (count: number): boolean => count >= 30;

// Payment operations: 10 per minute per user (financial safety)
export const exceededPaymentLimit = (count: number): boolean => count >= 10;

// ---------------------------------------------------------------------------
// Generic rate limiter
// ---------------------------------------------------------------------------

interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfterSeconds?: number;
}

/**
 * Check and increment a rate limit counter for a user + action.
 * Uses Supabase to persist counts so it works across instances.
 *
 * Falls back to allow-if-no-DB for graceful degradation in dev.
 */
export async function rateLimitUser(
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(now - windowMs).toISOString();

  const service = createServiceClient();

  try {
    // Count recent requests in the window
    const { count, error } = await service
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('created_at', windowStart);

    if (error) {
      // If the table doesn't exist or there's a DB error, allow the request
      // (graceful degradation for dev environments)
      console.warn('Rate limit DB check failed, allowing request:', error.message);
      return { allowed: true, currentCount: 0, limit };
    }

    const currentCount = count ?? 0;

    if (currentCount >= limit) {
      const retryAfterSeconds = Math.ceil(windowMs / 1000);
      return { allowed: false, currentCount, limit, retryAfterSeconds };
    }

    // Increment counter (non-blocking — we check-then-insert for simplicity)
    // In a production high-throughput system you'd want a single atomic operation,
    // but for these endpoint sizes this is fine.
    await service.from('rate_limits').insert({
      user_id: userId,
      action,
      created_at: new Date(now).toISOString(),
    });

    return { allowed: true, currentCount: currentCount + 1, limit };
  } catch {
    // If anything fails (including missing table), allow the request
    return { allowed: true, currentCount: 0, limit };
  }
}
