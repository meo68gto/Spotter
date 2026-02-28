# Spotter Two-Week Execution Sprint (Uninterrupted)

## Week 1 (P0 close)
1. Auth and env hardening
   - Owner: mobile + backend
   - Exit: `/docs/acceptance/epic-p0-auth-and-env.md` done criteria all green
2. Payments correctness
   - Owner: backend
   - Exit: `/docs/acceptance/epic-p0-payments.md` done criteria all green
3. Booking engine reliability
   - Owner: backend + data
   - Exit: `/docs/acceptance/epic-p0-booking-engine.md` done criteria all green

## Week 2 (P0 test gates + P1 kickoff)
1. E2E + RLS regression gates
   - Owner: QA + backend
   - Exit: `/docs/acceptance/epic-p0-e2e-and-rls.md` done criteria all green
2. Sponsor ops (P1)
   - Owner: backend + web-admin
   - Exit: `/docs/acceptance/epic-p1-sponsor-ops.md` done criteria all green
3. Networking depth (P1)
   - Owner: mobile + data
   - Exit: `/docs/acceptance/epic-p1-networking-depth.md` done criteria all green

## Daily execution rules
1. No new feature starts until current epic acceptance checks are green.
2. Every PR must reference the exact acceptance file section changed.
3. Release candidates require staging smoke pass and RLS pass.
4. Any red acceptance check blocks release.
