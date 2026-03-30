-- Migration: 0024_rate_limits.sql
-- Purpose: Create rate_limits table for API endpoint rate limiting.
-- Supports per-user, per-action counting with automatic TTL cleanup.
-- Consumed by: apps/functions/supabase/functions/_shared/rate-limit.ts

-- =============================================================================
-- Rate limits table
-- Tracks request counts per user per action in a sliding time window.
-- =============================================================================

create table if not exists public.rate_limits (
  id          bigint generated always as identity primary key,
  user_id     text not null,
  action      text not null,
  created_at  timestamptz not null default now()
);

comment on table public.rate_limits is
  'Per-user action counters for rate limiting. Rows should be cleaned up by cleanup_rate_limits().';

-- Cluster on user + action for the most common access pattern
create index if not exists idx_rate_limits_user_action_created
  on public.rate_limits(user_id, action, created_at desc);

-- =============================================================================
-- Cleanup function — removes expired rate limit entries
-- Call manually or via a nightly cron:
--   SELECT cleanup_rate_limits(3600);  -- drops entries older than 1 hour
-- =============================================================================

create or replace function public.cleanup_rate_limits(window_seconds int default 3600)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  deleted_count bigint;
begin
  delete from public.rate_limits
  where created_at < now() - (window_seconds || ' seconds')::interval;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.cleanup_rate_limits(int) is
  'Delete rate limit rows older than window_seconds. Returns count of deleted rows.';
