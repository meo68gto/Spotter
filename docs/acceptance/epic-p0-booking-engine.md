# Epic P0: MCP Booking Engine v1 Quality

## Objective
Deliver deterministic, explainable, and measurable ranking for partner pairing + sponsored event recommendations.

## User-visible outcome
1. User receives up to 5 high-quality local pairing candidates.
2. User sees relevant sponsored events nearby.
3. Results include explainable reasons.

## API and DB contract
1. `POST /functions/v1/mcp-booking-plan` stores run in `mcp_booking_runs`.
2. Recommendations persist to `mcp_booking_recommendations` with rank and reason payload.
3. SQL scorer function: `public.mcp_booking_recommendations_v1(...)`.
4. Invite endpoints:
   - `POST /functions/v1/networking-invite-send`
   - `POST /functions/v1/sponsors-event-invite-locals`
5. Event endpoints:
   - `POST /functions/v1/sponsors-event-create`
   - `POST /functions/v1/sponsors-event-list`
   - `POST /functions/v1/sponsors-event-rsvp`

## Security and RLS rules
1. Users can only create invites as self.
2. Sponsor event creation/invite-locals requires sponsor admin role.
3. Feed/event reads obey status and policy boundaries.

## Telemetry events
1. `mcp_booking_run_created`
2. `mcp_pairing_impression`
3. `mcp_event_impression`
4. `networking_invite_sent`
5. `sponsored_event_created`
6. `sponsored_event_rsvp`
7. `sponsored_event_local_invites_sent`

## Test cases
1. Same input returns deterministic order.
2. Top-N limit respected.
3. Candidate distance filter respected.
4. Invite send writes one row and blocks duplicates by constraint.
5. Sponsor admin guard blocks unauthorized local-invite runs.
6. Only published events appear in feed/list by default.

## Definition of done
1. Ranking produces stable results in staging.
2. Reasons are non-empty for all returned recommendations.
3. Conversion labels are captured for accepted invite / RSVP.
4. Query plan for ranking path uses intended indexes.

## Non-goals
1. ML model training in v1.
2. Global ranking personalization beyond local objective weights.
