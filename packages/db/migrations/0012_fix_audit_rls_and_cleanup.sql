-- 0012_fix_audit_rls_and_cleanup.sql
-- Fix C-3: Remove overly-permissive audit log insert policy
-- Fix M-7: Document payment_events as service-role-only
-- Fix S-5: Drop legacy users.availability column

-- C-3: Drop the permissive insert policy on deletion_audit_logs
-- Audit log inserts should only come via service_role (Edge Functions bypass RLS)
drop policy if exists deletion_audit_logs_insert_service on public.deletion_audit_logs;

-- M-7: Document payment_events as intentionally service-role-only
comment on table public.payment_events is
  'Stripe webhook event log. Service-role access only. No client RLS policies by design.';

-- S-5: Drop legacy availability jsonb column (replaced by availability_slots table in 0002)
alter table public.users drop column if exists availability;
