# Epic P0: E2E Reliability and RLS Regression Gates

## Objective
Prevent production regressions by enforcing end-to-end flow tests and RLS isolation tests across all critical entities.

## User-visible outcome
1. New users can complete core journey without support.
2. Cross-user data leaks are blocked.
3. Core engagement flows remain stable after each merge.

## API and DB contract
1. Covered journey APIs:
   - onboarding: `onboarding-profile`
   - matching: `matching-candidates`, `matching-request`, `matching-accept`, `matching-reject`
   - sessions: `sessions-propose`, `sessions-confirm`, `sessions-cancel`, `sessions-feedback`
   - messaging: `chat-send`
   - booking/events: `mcp-booking-plan`, sponsor and networking endpoints
2. RLS checks include private tables: users, skill profiles, messages, video submissions, review orders, invites, registrations.

## Security and RLS rules
1. User A cannot read/write User B private records.
2. Role escalation by payload manipulation is rejected.
3. Admin-only endpoints require explicit admin credential and are audited.

## Telemetry events
1. `e2e_flow_started`
2. `e2e_flow_completed`
3. `e2e_flow_failed`
4. `rls_violation_attempt_blocked`

## Test cases
1. Full onboarding to session proposal happy path.
2. Full onboarding to sponsored event RSVP happy path.
3. Guest and authenticated paths for supported engagement creation.
4. Negative RLS tests for each protected table.
5. Duplicate retry safety for chat/send and RSVP.

## Definition of done
1. CI blocks merge on failing E2E smoke and RLS suite.
2. Staging smoke passes for every release candidate.
3. Test artifacts retained for failed runs.

## Non-goals
1. Load/performance test at internet scale.
2. Long-running chaos test infrastructure.
