# ADR-001: Mobile Framework - Expo React Native

## Status
Accepted

## Decision
Use Expo React Native for a single codebase targeting iOS and Android.

## Rationale
- Fast iteration for consumer UX experiments.
- Unified OTA and build tooling.
- Strong ecosystem for permissions, auth redirects, and offline storage.

## Consequences
- Native modules require plugin configuration.
- Certain low-level capabilities may require prebuild/eject later.
