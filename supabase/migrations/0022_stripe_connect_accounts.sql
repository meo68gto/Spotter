-- EPIC 20 Phase 4A: Stripe Connect + Payout Flow
-- Adds Stripe Connect Standard account columns to organizer_accounts

-- ============================================
-- UP MIGRATION
-- ============================================

-- Stripe Connect Standard account ID (separate from customer ID)
ALTER TABLE public.organizer_accounts
  ADD COLUMN IF NOT EXISTS stripe_account_id text UNIQUE;

-- Onboarding status for Stripe Connect flow
ALTER TABLE public.organizer_accounts
  ADD COLUMN IF NOT EXISTS stripe_onboarding_status text NOT NULL DEFAULT 'not_started';

-- Index for fast lookup by Stripe account
CREATE INDEX IF NOT EXISTS idx_organizer_accounts_stripe_account
  ON public.organizer_accounts(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- ============================================
-- DOWN MIGRATION
-- ============================================

DROP INDEX IF EXISTS idx_organizer_accounts_stripe_account;
ALTER TABLE public.organizer_accounts DROP COLUMN IF EXISTS stripe_onboarding_status;
ALTER TABLE public.organizer_accounts DROP COLUMN IF EXISTS stripe_account_id;
