# MCP Booking Engine (Spotter)

## What It Is
MCP stands for **Multi-Constraint Pairing**.  
The engine ranks two recommendation types in one run:
- `pairing`: nearby athletes with skill/availability fit.
- `event`: sponsored tournaments and clinics likely to convert.

Core DB function:
- `public.mcp_booking_recommendations_v1(...)`

Core API:
- `POST /functions/v1/mcp-booking-plan`

## Data Model Added
- `sponsors`: sponsor organizations.
- `sponsor_memberships`: who can create/manage sponsor events.
- `sponsored_events`: tournament/clinic records with activity + geolocation.
- `sponsored_event_invites`: local invite distribution + response status.
- `sponsored_event_registrations`: RSVP and check-in lifecycle.
- `networking_invites`: direct local networking invites between users.
- `mcp_booking_runs`: immutable request record for each MCP planning run.
- `mcp_booking_recommendations`: scored outputs for audit and model training.

## Scoring Inputs (v1)
- Distance between athlete home location and candidate/event location.
- Skill delta from existing `skill_profiles`.
- Availability overlap from existing matching function outputs.
- Event timing proximity (near-term starts get a relevance boost).
- Objective flag (`balanced`, `fast_match`, `tournament_ready`) stored for future weighting variants.

## Methods to Collect Data (Operational)
1. User-generated interaction data
- Invite sent/accepted/declined (`networking_invites`, `sponsored_event_invites`).
- RSVP and check-ins (`sponsored_event_registrations`).
- Session outcomes and post-session feedback (existing tables).

2. Supply-side sponsor data
- Sponsor profile creation and admin assignments.
- Event creation metadata (city, venue, sport, schedule, participant cap).
- Bulk local invite jobs (`sponsors-event-invite-locals`).

3. Geo + skill context
- Home location consented from app onboarding.
- Skill profile dimensions and canonical scores by activity.
- Event venue coordinates provided by sponsors.

4. Booking intelligence telemetry
- Persisted `mcp_booking_runs` and `mcp_booking_recommendations`.
- Later enrichment with conversion labels:
  - recommended pairing -> match requested/accepted/session completed
  - recommended event -> RSVP/check-in

## Data Quality Controls
- RLS on all new tables (participant/admin/owner scoped).
- Unique constraints prevent duplicate invites/registrations.
- Immutable run records keep recommendation auditability.
- Recommendation rows include reasons JSON for explainability.

## Next Training-Ready Fields (recommended)
- `clicked_at`, `accepted_at`, `converted_at` timestamps on recommendations.
- `conversion_type` enum (`match`, `session`, `event_rsvp`, `event_check_in`).
- `objective_variant` and experiment ID for A/B scoring tests.
- Sponsor campaign tags and budget buckets for ROI attribution.
