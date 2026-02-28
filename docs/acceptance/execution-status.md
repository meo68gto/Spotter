# Spotter Execution Status (Acceptance-Driven)

Last updated: 2026-02-28 (America/Phoenix)
Owner: Codex execution run

## Global release gate
1. [ ] All P0 epic Definition-of-Done checks pass
2. [ ] CI green for lint, tests, env validation, migration checks
3. [ ] Staging smoke run green for auth, booking, sponsor events, session flow
4. [ ] No open P0 security or payment correctness defects

## Epic status board

### P0 Auth and Environment (`epic-p0-auth-and-env.md`)
1. [x] App does not blank-screen when env missing (fallback + demo mode)
2. [x] OAuth telemetry start/success/failure instrumented
3. [x] Session restore success/failure telemetry instrumented
4. [ ] LinkedIn OAuth provider fully validated on iOS/Android/web staging
5. [x] Auth callback matrix doc completed (`/docs/ops/auth-callback-matrix.md`)
6. [ ] Auth E2E suite passing in CI

### P0 Payments (`epic-p0-payments.md`)
1. [x] Payment function endpoints exist
2. [x] Stripe webhook signature verification confirmed by test evidence
3. [ ] Idempotent webhook replay tests passing
4. [ ] Auth-hold capture/release flow validated end-to-end
5. [ ] Production key guardrails verified (`release:preflight`)

### P0 Booking Engine (`epic-p0-booking-engine.md`)
1. [x] MCP run + recommendation persistence implemented
2. [x] Sponsor event create/list/invite/rsvp endpoints implemented
3. [x] Networking invite send endpoint implemented
4. [x] Deterministic ranking test evidence captured
5. [x] Conversion labels added on recommendations (`clicked/accepted/converted`)
6. [ ] Query-plan/index evidence attached for ranking path

### P0 E2E and RLS (`epic-p0-e2e-and-rls.md`)
1. [x] Base RLS smoke check exists
2. [ ] Cross-user table-by-table RLS regression suite complete
3. [ ] Full onboarding -> matching -> session propose E2E test complete
4. [ ] Sponsored event E2E test complete
5. [ ] CI blocking gates wired for E2E + RLS suite

### P1 Sponsor Ops (`epic-p1-sponsor-ops.md`)
1. [x] Sponsor data model and core endpoints present
2. [ ] Sponsor edit/cancel lifecycle complete
3. [ ] Sponsor metrics dashboard parity check complete
4. [ ] Audit trail verification complete

### P1 Networking Depth (`epic-p1-networking-depth.md`)
1. [x] Networking screen + MCP recommendations + invite action working
2. [ ] Invite accept/decline lifecycle end-to-end surfaced in mobile
3. [ ] DND/availability effects validated in ranking tests
4. [ ] Invite conversion funnel verified in analytics

## Current uninterrupted execution order
1. Close P0 Auth/Env staging validation and callback docs.
2. Close P0 Payments webhook/idempotency and auth-hold evidence.
3. Close P0 Booking deterministic ranking + conversion labels.
4. Close P0 E2E/RLS mandatory gates in CI.
5. Begin P1 Sponsor Ops and Networking Depth enhancements.

## Evidence log
1. 2026-02-28: Mobile auth/env telemetry updates landed in:
   - `/Users/brucewayne/Documents/Spotter/apps/mobile/src/screens/AuthScreen.tsx`
   - `/Users/brucewayne/Documents/Spotter/apps/mobile/App.tsx`
2. 2026-02-28: Auth callback matrix documented in:
   - `/Users/brucewayne/Documents/Spotter/docs/ops/auth-callback-matrix.md`
3. 2026-02-28: Verification command passed:
   - `pnpm --filter @spotter/mobile lint`
4. 2026-02-28: Stripe webhook signature tests added/passing:
   - `/Users/brucewayne/Documents/Spotter/apps/functions/tests/payments.test.ts`
   - `pnpm --filter @spotter/functions test`
5. 2026-02-28: Booking conversion labels added:
   - migrations:
     - `/Users/brucewayne/Documents/Spotter/packages/db/migrations/0012_mcp_recommendation_conversions.sql`
     - `/Users/brucewayne/Documents/Spotter/apps/functions/supabase/migrations/20260228165000_mcp_recommendation_conversions.sql`
   - endpoints:
     - `/Users/brucewayne/Documents/Spotter/apps/functions/supabase/functions/networking-invite-send/index.ts`
     - `/Users/brucewayne/Documents/Spotter/apps/functions/supabase/functions/sponsors-event-rsvp/index.ts`
6. 2026-02-28: Deterministic ranking sort + test added:
   - `/Users/brucewayne/Documents/Spotter/apps/functions/supabase/functions/_shared/mcp.ts`
   - `/Users/brucewayne/Documents/Spotter/apps/functions/supabase/functions/mcp-booking-plan/index.ts`
   - `/Users/brucewayne/Documents/Spotter/apps/functions/tests/mcp.test.ts`
   - `pnpm --filter @spotter/functions test`
