# ADR-006: Analytics and Feature Flags

## Status
Accepted

## Decision
Adopt PostHog for product analytics and Statsig (or LaunchDarkly) for feature flagging.

## Rationale
- Funnel and retention visibility required before optimization.
- Controlled rollout and rapid experimentation are mandatory for consumer velocity.

## Consequences
- Client-side event taxonomy must be defined early.
- Flag governance and ownership must be explicit.
