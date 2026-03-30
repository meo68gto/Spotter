-- Migration: Add rate_limits table for per-user rate limiting
-- Used by: discovery-search, payments-* edge functions
-- Limits abuse of expensive/scrapable endpoints

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,  -- e.g., 'discovery_search', 'payment_create'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups: count recent requests for a user+action
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_time
  ON rate_limits (user_id, action, created_at DESC);

-- TTL: automatically clean up old entries (keep 1 week of history)
-- Run as a cron job: DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '7 days'
-- Or use a Supabase pg_cron job:
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', $$DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '7 days'$$);
