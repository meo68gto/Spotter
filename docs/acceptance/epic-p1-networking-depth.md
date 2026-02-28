# Epic P1: Networking Depth and Local Growth Loops

## Objective
Deepen repeat usage by improving connection quality, trust signals, and tournament invitation loops.

## User-visible outcome
1. Users can discover local players by sport and intent.
2. Users can send and track networking invites.
3. Sponsor-driven local tournaments convert to recurring participation.

## API and DB contract
1. Primary endpoints:
   - `mcp-booking-plan`
   - `networking-invite-send`
   - `sponsors-event-list`
   - `sponsors-event-rsvp`
2. Primary tables:
   - `networking_invites`
   - `mcp_booking_runs`
   - `mcp_booking_recommendations`
3. Future-compatible fields for conversion labeling:
   - `clicked_at`
   - `accepted_at`
   - `converted_at`
   - `conversion_type`

## Security and RLS rules
1. Invite records visible only to sender/receiver and authorized admins.
2. No exposure of private skill/location details beyond policy-allowed summary.

## Telemetry events
1. `networking_screen_viewed`
2. `networking_filter_applied`
3. `networking_invite_sent`
4. `networking_invite_accepted`
5. `tournament_invite_sent`
6. `tournament_invite_accepted`

## Test cases
1. Invite send, accept, decline, and duplicate prevention.
2. Network recommendations update by activity filter.
3. DND/availability impacts ranking visibility.
4. Tournament invites route to eligible locals only.

## Definition of done
1. Invite conversion funnel visible in analytics.
2. Repeat weekly active usage increases vs baseline.
3. No open P0 privacy/security issues in networking layer.

## Non-goals
1. Full social graph feed ranking.
2. Viral referral program optimization.
