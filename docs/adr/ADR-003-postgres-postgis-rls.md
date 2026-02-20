# ADR-003: Data Platform - Supabase Postgres + PostGIS + RLS

## Status
Accepted

## Decision
Use Supabase Postgres as system of record, PostGIS for geospatial matching, and RLS enforced on all user-data tables.

## Rationale
- Geospatial constraints are core product logic.
- RLS gives first-class tenant/user isolation.
- PostgreSQL supports JSONB + vector experiments without early fragmentation.

## Consequences
- Migration discipline required from day one.
- Query tuning needed for distance + skill composite filtering.
