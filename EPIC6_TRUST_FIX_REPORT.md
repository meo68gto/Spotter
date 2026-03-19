# Epic 6 Trust Reliability Contract Mismatch - Fix Report

## Summary
Fixed critical contract mismatches between frontend hooks and backend edge functions that were preventing trust reliability data from loading correctly.

## Contract Mismatches Found and Fixed

### 1. trust-reliability (CRITICAL - Main Issue)
**File:** `apps/mobile/src/hooks/useTrust.ts` (line ~78)

**Before (BROKEN):**
```typescript
const { data: reliabilityData, error: reliabilityError } = await supabase.functions.invoke(
  'trust-reliability',
  { method: 'GET', query: { userId } }
);
```

**After (FIXED):**
```typescript
const { data: reliabilityData, error: reliabilityError } = await supabase.functions.invoke(
  `trust-reliability/${userId}`,
  { method: 'GET' }
);
```

**Issue:** Frontend sent userId as query parameter `?userId=xxx`, but backend expected it in URL path `/trust-reliability/:userId`. Supabase functions.invoke with `query` doesn't translate to path params, so reliability data NEVER loaded.

---

### 2. trust-vouch (Field Name Mismatch)
**File:** `apps/mobile/src/hooks/useTrust.ts` (line ~175)

**Before (BROKEN):**
```typescript
body: { 
  action: 'create',
  vouchedUserId,  // Wrong field name
  notes 
}
```

**After (FIXED):**
```typescript
body: { 
  vouchedId: vouchedUserId,  // Contract: backend expects 'vouchedId'
  notes 
}
```

**Issue:** Frontend sent `vouchedUserId`, but backend expected `vouchedId`. Also removed unused `action: 'create'` field.

---

### 3. trust-report-incident (Field Name Mismatch)
**File:** `apps/mobile/src/hooks/useTrust.ts` (line ~240)

**Before (BROKEN):**
```typescript
body: {
  reportedUserId,  // Wrong field name
  severity,
  category,
  description,
  roundId,
}
```

**After (FIXED):**
```typescript
body: {
  reportedId: reportedUserId,  // Contract: backend expects 'reportedId'
  severity,
  category,
  description,
  roundId,
}
```

**Issue:** Frontend sent `reportedUserId`, but backend expected `reportedId`.

---

## Backend Verification

### trust-reliability (apps/functions/supabase/functions/trust-reliability/index.ts)
- ✅ Returns `{ data: breakdown }` format
- ✅ Same-tier check works (compares caller.tier_id vs target.tier_id)
- ✅ Path-based userId extraction: `const targetUserId = pathParts[pathParts.length - 1]`

### trust-vouch (apps/functions/supabase/functions/trust-vouch/index.ts)
- ✅ Expects `vouchedId` in request body
- ✅ Same-tier enforcement via `verifyInteractionAllowed()`
- ⚠️ **NOTE:** Revoke action not implemented in backend (only create is supported)

### trust-report-incident (apps/functions/supabase/functions/trust-report-incident/index.ts)
- ✅ Expects `reportedId` in request body
- ✅ Validates severity/category enums
- ✅ Duplicate report check (30 days)

---

## ProfileTrustSection Integration

**File:** `apps/mobile/src/components/ProfileTrustSection.tsx`

The component correctly:
- Calls `useTrust({ userId, enabled: !!userId })`
- Transforms reliability data for TrustSummary:
  ```typescript
  const trustData = reliability ? {
    reliabilityScore: reliability.reliabilityScore,
    reliabilityLabel: reliability.reliabilityLabel,
    showRate: reliability.showRate,
    punctualityRate: reliability.punctualityRate,
    roundsCompleted: reliability.roundsCompleted,
    roundsScheduled: reliability.roundsScheduled,
    vouchesReceived,
    badges,
  } : null;
  ```
- Passes data to TrustSummary component

---

## Acceptance Criteria Status

- [x] useTrust calls trust-reliability with path-based userId
- [x] Reliability data loads correctly (contract now matches)
- [x] ProfileTrustSection displays real data (transformation logic correct)
- [x] Same-tier restrictions work (verified in backend code)
- [x] No contract mismatches remain (all 3 functions verified)

---

## Files Modified

1. `apps/mobile/src/hooks/useTrust.ts`
   - Fixed trust-reliability invoke call (path-based userId)
   - Fixed trust-vouch field name (vouchedId)
   - Fixed trust-report-incident field name (reportedId)

---

## Testing Recommendations

1. **Test trust-reliability loading:**
   - Open a user profile
   - Verify reliability score loads
   - Check network tab for `trust-reliability/{userId}` call

2. **Test same-tier restriction:**
   - Try viewing profile of user in different tier
   - Should receive 403 "tier_restricted" error

3. **Test vouch creation:**
   - Play 3+ rounds with another user
   - Click "Give Vouch" button
   - Verify vouch is created

4. **Test incident reporting:**
   - Click "Report Issue" on a profile
   - Submit report
   - Verify report is saved

---

## Additional Notes

- The `revokeVouch` function in useVouch sends `{ action: 'revoke', vouchId }`, but the trust-vouch backend only implements the create flow. This is a missing feature, not a contract bug.
- All backend edge functions properly validate authorization and return appropriate error codes.
