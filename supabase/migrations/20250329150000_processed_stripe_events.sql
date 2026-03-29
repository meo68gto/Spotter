-- EPIC 20: Stripe webhook idempotency table
-- Prevents duplicate processing when Stripe retries webhooks within 24-72 hours

-- ============================================
-- UP MIGRATION
-- ============================================

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id TEXT NOT NULL PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup of old events
CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processed_at
  ON public.processed_stripe_events(processed_at);

COMMENT ON TABLE public.processed_stripe_events IS
  'Idempotency log for Stripe webhook handlers — prevents duplicate processing of retries';

-- ============================================
-- DOWN MIGRATION
-- ============================================

DROP TABLE IF EXISTS public.processed_stripe_events;
