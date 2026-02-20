# ADR-004: Authentication - Supabase Auth + Social Login

## Status
Accepted

## Decision
Use Supabase Auth with email/password + magic link + Apple/Google OAuth.

## Rationale
- Consumer app onboarding requires low-friction sign-in paths.
- Tight integration with JWT and RLS claims.
- Reduced time-to-market vs split auth vendor in week one.

## Consequences
- OAuth provider setup and callback management are mandatory early tasks.
