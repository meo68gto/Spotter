-- Migration: 0021_bipa_consent
-- BIPA (Illinois Biometric Information Privacy Act) consent record
-- Adds BIPA-specific fields to user_legal_consents for Illinois biometric data disclosure

alter table public.user_legal_consents
  add column if not exists bipa_version text,
  add column if not exists bipa_accepted boolean,
  add column if not exists is_illinois boolean default false,
  add column if not exists location_denied boolean default false,
  add column if not exists consent_withheld boolean default false;

-- Illinois is state FIPS code 17
create index if not exists idx_user_legal_consents_bipa
  on public.user_legal_consents(user_id, bipa_version, bipa_accepted, is_illinois)
  where bipa_version is not null;
