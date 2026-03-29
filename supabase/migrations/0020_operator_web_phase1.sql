-- =============================================================================
-- EPIC 18 Phase 1: Operator Web App Foundation
-- Adds user_role enum, sponsor CRM tables, and dashboard stats view
-- =============================================================================

-- 1. Add user_role to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'golfer';

COMMENT ON COLUMN public.users.user_role IS 
  'golfer | operator | admin. Determines app access and feature availability.';

-- 2. Create enum types for sponsor CRM
DO $$ BEGIN
  CREATE TYPE public.sponsor_tier AS ENUM ('bronze', 'silver', 'gold', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM ('draft', 'sent', 'signed', 'active', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.fulfillment_status AS ENUM ('pending', 'in_progress', 'completed', 'missed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Sponsors table
CREATE TABLE IF NOT EXISTS public.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES public.organizer_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  logo_url TEXT,
  website_url TEXT,
  tier TEXT NOT NULL DEFAULT 'bronze',
  notes TEXT,
  stripe_customer_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Sponsor contracts
CREATE TABLE IF NOT EXISTS public.sponsor_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.organizer_events(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  value_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  start_date DATE,
  end_date DATE,
  signed_at TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  created_by UUID REFERENCES public.organizer_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Sponsor fulfillment checklist
CREATE TABLE IF NOT EXISTS public.sponsor_fulfillment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.sponsor_contracts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. RLS policies for sponsor tables
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_fulfillment ENABLE ROW LEVEL SECURITY;

-- Sponsors: operators see their own organizer account's sponsors
CREATE POLICY sponsors_select_operator ON public.sponsors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organizer_members om
      WHERE om.organizer_id = sponsors.organizer_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND EXISTS (
          SELECT 1 FROM public.users u 
          WHERE u.id = auth.uid() 
          AND u.user_role IN ('operator', 'admin')
        )
    )
  );

CREATE POLICY sponsors_insert_operator ON public.sponsors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizer_members om
      WHERE om.organizer_id = sponsors.organizer_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'manager')
        AND EXISTS (
          SELECT 1 FROM public.users u 
          WHERE u.id = auth.uid() 
          AND u.user_role IN ('operator', 'admin')
        )
    )
  );

CREATE POLICY sponsors_update_operator ON public.sponsors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.organizer_members om
      WHERE om.organizer_id = sponsors.organizer_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'manager')
        AND EXISTS (
          SELECT 1 FROM public.users u 
          WHERE u.id = auth.uid() 
          AND u.user_role IN ('operator', 'admin')
        )
    )
  );

-- Contracts: operators see their own sponsors' contracts
CREATE POLICY contracts_select_operator ON public.sponsor_contracts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sponsors s
      JOIN public.organizer_members om ON om.organizer_id = s.organizer_id
      WHERE s.id = sponsor_contracts.sponsor_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND EXISTS (
          SELECT 1 FROM public.users u 
          WHERE u.id = auth.uid() 
          AND u.user_role IN ('operator', 'admin')
        )
    )
  );

CREATE POLICY contracts_insert_operator ON public.sponsor_contracts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sponsors s
      JOIN public.organizer_members om ON om.organizer_id = s.organizer_id
      WHERE s.id = sponsor_contracts.sponsor_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'manager')
        AND EXISTS (
          SELECT 1 FROM public.users u 
          WHERE u.id = auth.uid() 
          AND u.user_role IN ('operator', 'admin')
        )
    )
  );

CREATE POLICY contracts_update_operator ON public.sponsor_contracts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sponsors s
      JOIN public.organizer_members om ON om.organizer_id = s.organizer_id
      WHERE s.id = sponsor_contracts.sponsor_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'manager')
        AND EXISTS (
          SELECT 1 FROM public.users u 
          WHERE u.id = auth.uid() 
          AND u.user_role IN ('operator', 'admin')
        )
    )
  );

-- Fulfillment: same access pattern
CREATE POLICY fulfillment_select_operator ON public.sponsor_fulfillment
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sponsor_contracts sc
      JOIN public.sponsors s ON s.id = sc.sponsor_id
      JOIN public.organizer_members om ON om.organizer_id = s.organizer_id
      WHERE sc.id = sponsor_fulfillment.contract_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND EXISTS (
          SELECT 1 FROM public.users u 
          WHERE u.id = auth.uid() 
          AND u.user_role IN ('operator', 'admin')
        )
    )
  );

CREATE POLICY fulfillment_insert_operator ON public.sponsor_fulfillment
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sponsor_contracts sc
      JOIN public.sponsors s ON s.id = sc.sponsor_id
      JOIN public.organizer_members om ON om.organizer_id = s.organizer_id
      WHERE sc.id = sponsor_fulfillment.contract_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'manager')
        AND EXISTS (
          SELECT 1 FROM public.users u 
          WHERE u.id = auth.uid() 
          AND u.user_role IN ('operator', 'admin')
        )
    )
  );

CREATE POLICY fulfillment_update_operator ON public.sponsor_fulfillment
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sponsor_contracts sc
      JOIN public.sponsors s ON s.id = sc.sponsor_id
      JOIN public.organizer_members om ON om.organizer_id = s.organizer_id
      WHERE sc.id = sponsor_fulfillment.contract_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'manager')
        AND EXISTS (
          SELECT 1 FROM public.users u 
          WHERE u.id = auth.uid() 
          AND u.user_role IN ('operator', 'admin')
        )
    )
  );

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_sponsors_organizer ON public.sponsors(organizer_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_sponsor ON public.sponsor_contracts(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_tournament ON public.sponsor_contracts(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sponsor_fulfillment_contract ON public.sponsor_fulfillment(contract_id);

-- 8. Dashboard stats view
CREATE OR REPLACE VIEW public.operator_dashboard_stats AS
SELECT 
  om.organizer_id,
  COUNT(DISTINCT oe.id)::integer AS total_tournaments,
  COUNT(DISTINCT CASE WHEN oe.status = 'registration_open' THEN oe.id END)::integer AS upcoming_tournaments,
  COUNT(DISTINCT oer.id)::integer AS total_registrations,
  COUNT(DISTINCT CASE WHEN oer.payment_status = 'paid' THEN oer.id END)::integer AS paid_registrations,
  COALESCE(SUM(CASE WHEN oer.payment_status = 'paid' THEN oer.amount_paid_cents ELSE 0 END), 0)::bigint AS total_revenue_cents,
  COUNT(DISTINCT CASE WHEN oer.status = 'waitlisted' THEN oer.id END)::integer AS waitlisted_count,
  COUNT(DISTINCT CASE WHEN oer.status IN ('confirmed', 'checked_in') THEN oer.id END)::integer AS confirmed_count,
  COUNT(DISTINCT s.id)::integer AS active_sponsors
FROM organizer_members om
LEFT JOIN organizer_events oe ON oe.organizer_id = om.organizer_id
LEFT JOIN organizer_event_registrations oer ON oer.event_id = oe.id
LEFT JOIN sponsors s ON s.organizer_id = om.organizer_id AND s.is_active = true
WHERE om.is_active = true
GROUP BY om.organizer_id;
