do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_conversion_type') then
    create type public.booking_conversion_type as enum (
      'pairing_invite',
      'event_rsvp',
      'session_booked',
      'event_check_in'
    );
  end if;
end $$;

alter table if exists public.mcp_booking_recommendations
  add column if not exists clicked_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists conversion_type public.booking_conversion_type,
  add column if not exists objective_variant text,
  add column if not exists experiment_id text,
  add column if not exists conversion_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_mcp_recommendations_conversion
  on public.mcp_booking_recommendations (conversion_type, converted_at desc);

create index if not exists idx_mcp_recommendations_clicked
  on public.mcp_booking_recommendations (clicked_at desc)
  where clicked_at is not null;
