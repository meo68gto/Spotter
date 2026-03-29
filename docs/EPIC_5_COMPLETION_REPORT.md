# EPIC 5 Critical Gap Fixes — Completion Report

**Date:** March 29, 2026  
**Status:** ✅ COMPLETE  
**Branch:** main  
**Commit:** Ready to push (not pushed per instructions)

---

## Summary

Fixed 3 critical gaps identified in the Spotter EPIC 5 implementation:

1. **GAP 1:** Round lifecycle state machine — incomplete `lifecycle_status` transitions and missing fields in list/detail APIs
2. **GAP 2:** Profile round history — zero round history section on ProfileScreen
3. **GAP 3:** Free tier 3-round lifetime limit — was incorrectly checking monthly limits; now correctly enforces hard lifetime cap

---

## GAP 1: Round Lifecycle State Machine

### Problem
- `lifecycle_status` never transitioned from `planning` → `invited` → `confirmed`
- `rounds-list` and `rounds-detail` didn't return `lifecycle_status`
- No endpoint to mark a round as `played`

### Fixes Applied

#### `rounds-respond/index.ts`
Added transition logic when the 4th player accepts invitation:
- Counts accepted invitations
- When `acceptedCount === maxPlayers`, updates `rounds.lifecycle_status` to `'confirmed'`

#### `rounds-list/index.ts`
- Added `lifecycle_status` to the SELECT query (both `myRounds` and public query paths)
- Added `lifecycleStatus: string` to `RoundResponse` interface
- Included `lifecycleStatus` in returned response objects
- Added `lifecycle_status` filter via query param (`lifecycle_status=confirmed`)

#### `rounds-detail/index.ts`
- Added `lifecycle_status` and `review_window_closes_at` to SELECT
- Added `lifecycleStatus: string` and `reviewWindowClosesAt?: string` to `RoundDetailResponse` interface
- Included both fields in returned response

#### New: `rounds-mark-played/index.ts`
- New edge function at `apps/functions/supabase/functions/rounds-mark-played/`
- POST endpoint accepting `{ roundId: string }`
- Creator-only authorization
- Validates current `lifecycle_status === 'confirmed'` before transition
- Sets `lifecycle_status = 'played'`, `played_at = now`, `review_window_closes_at = now + 7 days`
- Returns updated round with `playedAt` and `reviewWindowClosesAt`

---

## GAP 2: Profile Round History

### Problem
- ProfileScreen had no round history, standing foursomes section, or played-together data
- Users couldn't see their round history on their own profile

### Fixes Applied

#### New: `RoundHistorySection.tsx`
Created at `apps/mobile/src/components/RoundHistorySection.tsx`:
- **Stats row:** "Rounds Played: X" count from `round_participants_v2`
- **"Would Play Again" %:** Computed from `round_ratings` where `would_play_again = true`
- **Standing Foursomes:** Fetches from `standing_foursome_members` joined with `standing_foursomes`
- **Recent Rounds:** Last 5 rounds with course name, date, and player names
- **Empty state:** Friendly message when no rounds played

#### `ProfileScreen.tsx`
- Imported `RoundHistorySection` component
- Added below `TrustSummary` section in a Card wrapper with "⛳ Round History" header

---

## GAP 3: Free Tier 3-Round Lifetime Limit

### Problem
- Free tier was checking `monthly_rounds_count` against Select tier's 4/month limit
- Free tier should have a hard **lifetime** cap of 3 rounds (not monthly)
- Frontend had no special handling for the `FREE_TIER_LIMIT_REACHED` error code

### Fixes Applied

#### `rounds-create/index.ts`
- Restructured tier checks so FREE tier lifetime limit is checked **before** `canCreateRounds` gate
- Free tier can now create rounds IF under the 3-round lifetime limit
- Uses `round_participants_v2` to count ALL rounds the user ever participated in (lifetime count)
- Returns `403` with code `FREE_TIER_LIMIT_REACHED` when limit is exceeded
- Skips the monthly limit check for free tier (they use lifetime limit instead)

```typescript
// GAP 3: FREE tier hard 3-round LIFETIME limit
if (tierSlug === TIER_SLUGS.FREE) {
  const { count: lifetimeRounds } = await supabase
    .from('round_participants_v2')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);
  
  if ((lifetimeRounds || 0) >= 3) {
    return new Response(JSON.stringify({
      error: 'Free tier is limited to 3 rounds. Upgrade to create more.',
      code: 'FREE_TIER_LIMIT_REACHED',
      used: lifetimeRounds,
      limit: 3
    }), { status: 403, ... });
  }
  freeTierLifetimeCheckPassed = true;
}
```

#### `CreateRoundScreen.tsx`
- Added `FREE_TIER_LIMIT_REACHED` error code handling in catch block
- Triggers `showUpgradeModal()` directly when this code is returned (no alert dialog)

---

## Files Changed

| File | Change |
|------|--------|
| `apps/functions/supabase/functions/rounds-respond/index.ts` | GAP 1: Added lifecycle_status transition on 4th acceptance |
| `apps/functions/supabase/functions/rounds-list/index.ts` | GAP 1: Added lifecycle_status to query/response/filter |
| `apps/functions/supabase/functions/rounds-detail/index.ts` | GAP 1: Added lifecycle_status + review_window_closes_at |
| `apps/functions/supabase/functions/rounds-mark-played/index.ts` | GAP 1: **NEW** creator-only mark-played endpoint |
| `apps/mobile/src/components/RoundHistorySection.tsx` | GAP 2: **NEW** round history component |
| `apps/mobile/src/screens/ProfileScreen.tsx` | GAP 2: Added RoundHistorySection import and usage |
| `apps/functions/supabase/functions/rounds-create/index.ts` | GAP 3: Added free tier lifetime limit + restructured gate |
| `apps/mobile/src/screens/rounds/CreateRoundScreen.tsx` | GAP 3: Added FREE_TIER_LIMIT_REACHED modal trigger |

---

## TypeScript Status

- All new/modified files compile without new errors
- Pre-existing errors in the codebase are unrelated to these changes (palette token mismatches, missing exports in other files)

---

## Testing Notes

1. **GAP 1 — Lifecycle transition:** Create a round, send invitations to 3 players, have each accept. After the 4th acceptance, verify `lifecycle_status` = `'confirmed'` in the DB.

2. **GAP 1 — Mark played:** Call `POST /rounds-mark-played` with a confirmed round as the creator. Verify status → `'played'` and `review_window_closes_at` is set.

3. **GAP 2 — Profile:** View your own profile. Verify "Rounds Played", "Would Play Again %", and any standing foursomes appear.

4. **GAP 3 — Free tier:** As a free-tier user, try to create your 4th round. Verify 403 response with `FREE_TIER_LIMIT_REACHED` code and upgrade modal appears.

---

## Not Pushed

Per instructions, all changes are committed locally but **not pushed**. Run:
```bash
git push origin main
```
to deploy.
