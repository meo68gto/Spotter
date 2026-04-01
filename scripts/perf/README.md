# Spotter Performance Harness

This folder contains the minimum tooling needed to run production-shaped
performance checks locally once the Supabase stack is healthy.

## What is here

- `seed-spotter-scale.sql`
  Seeds a large same-tier golf dataset for discovery, matching, rounds, and
  network workloads.
- `run-stepped-load.mjs`
  Executes stepped load or soak runs and reports `p50`, `p90`, `p95`, `p99`,
  throughput, error rate, degradation type, risk level, bottleneck map, and
  capacity ceiling.

## Suggested local flow

1. Start local Supabase.
2. Export the local credentials from `supabase status -o env`.
3. Run the SQL seed against the local Postgres instance.
4. Run stepped load first, then soak.

## Seeding knobs

The SQL seed reads optional custom settings:

```sql
select set_config('spotter.perf.users', '3000', false);
select set_config('spotter.perf.courses', '120', false);
select set_config('spotter.perf.rounds', '900', false);
select set_config('spotter.perf.connections_per_user', '3', false);
```

Defaults are:

- `users = 3000`
- `courses = 120`
- `rounds = 900`
- `connections_per_user = 3`

## Load runner knobs

Environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SPOTTER_PERF_USER_ID`
- `PERF_SCENARIO=all|discovery|matching|rounds-rest`
- `PERF_MODE=stepped|soak`
- `PERF_STEPS=1,5,10,20,40`
- `PERF_REQUESTS_PER_STEP=200`
- `PERF_SOAK_DURATION_SEC=900`

## Example

```bash
node scripts/perf/run-stepped-load.mjs
PERF_MODE=soak PERF_SCENARIO=matching node scripts/perf/run-stepped-load.mjs
```
