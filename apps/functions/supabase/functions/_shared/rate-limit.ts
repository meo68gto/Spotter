// _shared/rate-limit.ts
// Sliding window rate limiter using in-memory Map
// In Supabase Edge Functions, each invocation is isolated, so we use
// a simple per-request check against a DB counter for production.
// For local dev, this in-memory approach works within a single instance.

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = { maxRequests: 20, windowMs: 60_000 };

const windowMap = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const entry = windowMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    windowMap.set(identifier, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  entry.count += 1;
  const allowed = entry.count <= config.maxRequests;
  return { allowed, remaining: Math.max(0, config.maxRequests - entry.count), resetAt: entry.resetAt };
}

export function rateLimitHeaders(result: { remaining: number; resetAt: number }): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };
}
