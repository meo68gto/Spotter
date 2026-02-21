# Post-Launch Monitoring (24h / 72h)

## On-call rota
- Primary on-call:
- Secondary on-call:
- Escalation manager:
- Start time (UTC):

## Golden signals
- API function 5xx rate
- P95 latency for `engagements-*` and `calls-*`
- Payment failure rate (`review_orders.status=failed`)
- Webhook verification failures (Stripe/Daily)
- Auth success rate (Google/Apple/email)

## 0-2 hours (every 15 minutes)
1. Review Sentry for new critical issues.
2. Check PostHog funnel:
   - auth start -> consent -> onboarding -> engagement create.
3. Generate report artifact:
   - `pnpm ops:health`
   - artifact path `.artifacts/ops-health/<timestamp>/report.md`
4. Check orders by status:
   - `created`, `processing`, `paid`, `failed`, `refunded`.
5. Check call completion and billed minute distribution.
6. Confirm recurring jobs executed at least once.

## 2-24 hours (hourly)
1. Monitor legal consent acceptance rates by platform.
2. Monitor guest checkout conversion and token expiry failures.
3. Watch public feed moderation backlog size.
4. Validate no stuck rows in:
   - `engagement_requests` (`awaiting_expert` past `expires_at`)
   - `review_orders` (`processing` older than expected window)

## 24-72 hours (every 4 hours)
1. Review trend shifts:
   - engagement completion rate
   - call billing anomaly rate
   - refund request volume
2. Confirm backup snapshot continuity.
3. Review support tickets and cluster by root cause.

## Thresholds and actions
- Payment failures > 5% for 15 minutes:
  - freeze new paid engagement creation via feature flag
  - investigate Stripe webhook and auth/capture path
- Function 5xx > 2% for 10 minutes:
  - enable kill-switch for affected feature
  - rollback to previous tag if unresolved in 30 minutes
- OAuth callback failures > 3%:
  - disable affected provider button in UI via flag
  - keep email auth path active

## Reporting template
- Time window:
- Incidents:
- Mitigations applied:
- Flags changed:
- User impact estimate:
- Next checkpoint owner:

## Automation
- GitHub Actions workflow:
  - `Launch Health Report` runs hourly and uploads `.artifacts/ops-health/**`.
- Manual dispatch supports `staging` and `production`.
