# ADR-002: Backend Runtime - Supabase Edge Functions

## Status
Accepted

## Decision
Use Supabase Edge Functions (Deno) as the serverless API surface.

## Rationale
- Shared operational plane with Auth, Postgres, and Realtime.
- Reduced integration overhead for week-one velocity.
- Native JWT verification and policy-friendly architecture.

## Consequences
- Deno runtime conventions differ from Node conventions.
- Heavy CPU tasks will move to queue workers later.
