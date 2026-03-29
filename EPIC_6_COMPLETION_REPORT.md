# EPIC-6 Completion Report — Trust & Reliability Gap Fixes

**Date:** 2026-03-29
**Status:** ✅ All 3 critical gaps resolved

---

## GAP 1: `calculateRatingsAverage` Used Wrong Column

**File:** `apps/functions/supabase/functions/reputation-calculate/index.ts`

### Problem
`calculateRatingsAverage` queried `round_ratings.rating`, but that column does not exist. The `round_ratings` table has `punctuality`, `golf_etiquette`, and `enjoyment` columns instead.

### Fix Applied
Replaced the broken query:
```sql
-- BEFORE (broken)
SELECT rating FROM round_ratings WHERE rated_user_id = $1

-- AFTER (correct)
SELECT punctuality, golf_etiquette, enjoyment FROM round_ratings WHERE rated_user_id = $1
```

Also fixed the **reliability score weights** to match EPIC-6 spec:

| Component | Weight | Source |
|-----------|--------|--------|
| show_rate | 40% | rounds attended vs registered |
| ratings_average | 30% | avg of (punctuality + etiquette + enjoyment) / 3, normalized to 0-100 |
| network_size | 20% | accepted connections count |
| vouch_count | 10% | active vouches received |

Replaced `calculateCompletionRate` → `calculateShowRate` using `round_participants_v2` (the correct table). Removed dead code: `calculateReferralsCount`, `calculateProfileCompleteness`, `calculateAttendanceRate`.

### Files Changed
- `apps/functions/supabase/functions/reputation-calculate/index.ts`

---

## GAP 2: Cron Jobs Never Scheduled

**Problem:** `scripts/jobs/calculate-reliability.ts`, `award-trust-badges.ts`, and `expire-vouches.ts` existed but had no automatic execution.

### Fix Applied
Created `.github/workflows/trust-cron.yml`:

- **Schedule:** Daily at 2 AM PST (`0 10 * * *` UTC) — uses existing `workflow_dispatch` for manual runs
- **Job order:** `reliability` → `badges` and `vouches` (both depend on reliability completing first)
- Each job installs pnpm deps, then runs the appropriate script with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from GitHub Secrets

### Files Created
- `.github/workflows/trust-cron.yml` (new)

### Files Referenced
- `scripts/jobs/calculate-reliability.ts`
- `scripts/jobs/award-trust-badges.ts`
- `scripts/jobs/expire-vouches.ts`

---

## GAP 3: Round Completion Didn't Trigger Reliability Updates

**Problem:** When a round transitioned to `played` (or `review_pending`/`reviewed`), no database trigger fired to update participants' reliability scores or award badges.

### Fix Applied

**1. New migration:** `supabase/migrations/20250330000000_round_completion_trust_trigger.sql`

Creates `fn_recalculate_reliability_on_round_complete()` — a `SECURITY DEFINER` plpgsql function that increments `rounds_completed` and stamps `last_reliability_calc_at = NOW()` for all checked-in participants in the round.

Trigger `trg_round_completion_reliability` fires on `AFTER UPDATE OF lifecycle_status` when transitioning to `played`, `review_pending`, or `reviewed`.

**2. Updated `rounds-rate` endpoint:** `apps/functions/supabase/functions/rounds-rate/index.ts`

After inserting ratings, the endpoint now calls `supabase.functions.invoke('reputation-calculate', { body: { userId } )` for each rated user, so reliability scores update immediately without waiting for the nightly cron.

### Files Changed
- `apps/functions/supabase/functions/rounds-rate/index.ts`
- `supabase/migrations/20250330000000_round_completion_trust_trigger.sql` (new)

---

## Summary

| Gap | File(s) | Status |
|-----|---------|--------|
| Wrong column in ratings query + weight fix | `reputation-calculate/index.ts` | ✅ |
| Cron scheduling for trust jobs | `.github/workflows/trust-cron.yml` | ✅ |
| DB trigger on round completion | `round_completion_trust_trigger.sql` + `rounds-rate/index.ts` | ✅ |

**Note:** `vouch_count` is queried live in `calculateVouchCount()` rather than stored as a separate column — the column does not yet exist in `user_reputation` per the EPIC-6 migration. The query is correct against the `vouches` table. If a `vouch_count` column is added to `user_reputation` later, the migration can be updated to maintain it.
