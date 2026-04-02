-- Migration: 0022_eagle_ai_bipa_consent_logging
-- BIPA consent record audit trail — fixes Diana's blocking item #3
-- Problem: The existing user_legal_consents table lacks consent_version and explicit
-- BIPA-specific accepted_at tracking required to prove valid written consent under BIPA.
-- Solution: Dedicated eagle_ai_bipa_consent table with full audit trail.

create table if not exists public.eagle_ai_bipa_consent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  consent_version text not null,
  consent_text_hash text not null,
  is_illinois boolean not null default false,
  consent_granted boolean not null default false,
  consent_withheld boolean not null default false,
  ip_address inet,
  app_version text,
  os_platform text,
  granted_at timestamptz,
  withheld_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.eagle_ai_bipa_consent enable row level security;

create policy eagle_ai_bipa_consent_select_own
  on public.eagle_ai_bipa_consent
  for select using (auth.uid() = user_id);

create policy eagle_ai_bipa_consent_insert_self
  on public.eagle_ai_bipa_consent
  for insert with check (auth.uid() = user_id);

-- Audit index for compliance
create index if not exists idx_eagle_ai_bipa_consent_user_created
  on public.eagle_ai_bipa_consent(user_id, created_at desc);

create index if not exists idx_eagle_ai_bipa_consent_version
  on public.eagle_ai_bipa_consent(consent_version, consent_granted);

-- Function: prevent duplicate consent records for same version per user
create or replace function public.eagle_ai_bipa_prevent_duplicate_consent()
returns trigger as $$
begin
  if new.consent_granted = false and new.consent_withheld = false then
    raise exception 'Consent record must be either granted or withheld';
  end if;
  if exists (
    select 1 from public.eagle_ai_bipa_consent
    where user_id = new.user_id
      and consent_version = new.consent_version
      and consent_granted = true
  ) then
    raise exception 'User has already provided consent for version %', new.consent_version;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_eagle_ai_bipa_prevent_duplicate
  before insert on public.eagle_ai_bipa_consent
  for each row execute function public.eagle_ai_bipa_prevent_duplicate_consent();
