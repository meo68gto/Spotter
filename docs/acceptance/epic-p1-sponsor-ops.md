# Epic P1: Sponsor Operations and Campaign Control

## Objective
Enable sponsors to create, manage, and measure local events and invites with clean operational controls.

## User-visible outcome
1. Sponsor can publish/edit/cancel an event.
2. Sponsor can invite local players in radius by sport.
3. Sponsor sees registration funnel and check-in outcomes.

## API and DB contract
1. Sponsor operations use:
   - `sponsors-event-create`
   - `sponsors-event-list`
   - `sponsors-event-invite-locals`
   - `sponsors-event-rsvp`
2. Core tables:
   - `sponsors`
   - `sponsor_memberships`
   - `sponsored_events`
   - `sponsored_event_invites`
   - `sponsored_event_registrations`
3. Admin web surface exposes moderation and exception queues.

## Security and RLS rules
1. Only sponsor `owner|admin` may publish/manage sponsor events.
2. Sponsor members only see sponsor-owned operational details.
3. Registration PII visibility follows minimum-necessary policy.

## Telemetry events
1. `sponsor_event_published`
2. `sponsor_event_edited`
3. `sponsor_event_cancelled`
4. `sponsor_invite_batch_sent`
5. `sponsor_invite_accepted`
6. `sponsor_event_check_in`

## Test cases
1. Sponsor owner creates event successfully.
2. Non-member blocked from sponsor event management.
3. Local invite batch honors limit and radius.
4. RSVP and cancellation state transitions are valid.
5. Event list metrics match source registration rows.

## Definition of done
1. Sponsor happy path demo works on staging.
2. Audit trail for critical sponsor actions exists.
3. Dashboard metrics reconcile with DB snapshots.

## Non-goals
1. Complex ad-buying and budget pacing system.
2. Multi-tenant white-label sponsor portals.
