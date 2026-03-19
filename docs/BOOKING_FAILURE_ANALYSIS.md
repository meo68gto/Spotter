# Spotter Booking/Payment Failure Analysis
## Day 3 Hardening Review - March 2026

---

## Current Transaction Flow

```
1. User taps "Continue to Payment"
2. Client calls engagements-create
   - Creates engagement_requests (status: 'created')
   - Creates review_orders (status: 'created')
   - Creates Stripe Payment Intent
   - Returns client_secret + IDs
3. Client initializes Stripe Payment Sheet
4. User completes payment in Stripe UI
5. Client calls payments-review-order-confirm
   - Updates order status to 'paid'
6. Client calls engagements-publish
   - Updates engagement status to 'awaiting_expert'
7. Done
```

---

## Critical Failure Points

### FP1: Client-Only Success Chain (HIGH SEVERITY)
**Location**: `useBookingFlow.ts` lines 44-60

**Problem**: The entire post-payment flow depends on the client correctly executing:
1. Stripe sheet success → 
2. payments-review-order-confirm → 
3. engagements-publish

**Failure Scenarios**:
- App crashes after payment success but before confirm call
- Network timeout during confirm call (payment succeeded, order not updated)
- Network timeout during publish call (order paid, engagement stuck in 'created')
- User kills app during any of these steps

**Current State**: User sees "Payment failed" alert even though payment succeeded.

---

### FP2: Client Authority Over Payment Status (HIGH SEVERITY)
**Location**: `payments-review-order-confirm/index.ts`

**Problem**: The client tells the backend "the payment succeeded" via:
```typescript
await invokeFunction('payments-review-order-confirm', {
  body: { reviewOrderId, status: 'paid' }
});
```

**This is backwards**: The webhook (`payments-webhook/index.ts`) already handles `payment_intent.succeeded` and updates the order. The client is duplicating this authority.

**Failure Scenario**:
1. Payment succeeds
2. Webhook updates order to 'paid'
3. Client confirm call also tries to update to 'paid' (works - idempotent)
4. But if webhook fails/delayed, client confirms before webhook → race condition

---

### FP3: No Publish Recovery Mechanism (MEDIUM SEVERITY)
**Location**: `engagements-publish/index.ts`

**Problem**: If publish fails after payment success:
- Order is paid
- Engagement is stuck in 'created' status
- User sees error
- No automatic retry
- No way to resume/recover

**Current Code**:
```typescript
await invokeFunction('engagements-publish', {...});
// If this throws, user sees "Payment failed" but payment actually succeeded
```

---

### FP4: Missing Idempotency (MEDIUM SEVERITY)
**Location**: `engagements-create/index.ts`

**Problem**: No idempotency key means:
- Double-clicking "Continue to Payment" creates duplicate engagements
- Retrying a failed booking creates new engagement instead of resuming
- Network retry at edge creates duplicates

---

### FP5: Poor User State Granularity (MEDIUM SEVERITY)
**Location**: `BookSessionScreen.tsx` step 2

**Problem**: Step 2 only shows "Opening payment sheet..." with no distinction between:
- Initializing payment
- Waiting for user input
- Processing payment
- Payment succeeded (brief flash before step 3)
- Payment failed
- Confirming order
- Publishing engagement

**User Experience**: User has no idea what actually failed or succeeded.

---

### FP6: Webhook vs Client Race Condition (LOW SEVERITY)
**Location**: `payments-webhook/index.ts` + `payments-review-order-confirm/index.ts`

**Problem**: Both webhook and client try to update order status. If webhook succeeds first, client confirm is redundant but safe. If client succeeds first, webhook overwrites (same value, but wasted event).

---

### FP7: No End-to-End Transaction (HIGH SEVERITY)
**Problem**: No atomic transaction across:
- Engagement creation
- Order creation
- Payment authorization
- Payment confirmation
- Engagement publish

Each step can succeed/fail independently, leaving partial states.

---

## Launch Mode Analysis

### Mode 1: Text Answer
- **Status**: ✅ Fully supported
- **Flow**: Create engagement → Pay → Publish → Coach writes text response
- **Risk**: Low

### Mode 2: Video Answer
- **Status**: ✅ Fully supported (same as text, just different mode)
- **Flow**: Create engagement → Pay → Publish → Coach uploads video
- **Risk**: Low

### Mode 3: Video Call
- **Status**: ⚠️ Supported but untested end-to-end
- **Flow**: Create engagement → Pay → Publish → Scheduled call
- **Risk**: Medium
  - `scheduled_time` is captured but not validated
  - No calendar integration shown
  - No call setup logic reviewed

---

## Recommended Improvements

### Phase 1: Immediate Fixes (Today)

1. **Move payment confirmation to webhook-only authority**
   - Remove `payments-review-order-confirm` client call
   - Client polls for order status after payment sheet closes
   - Webhook is sole source of truth

2. **Add idempotency to engagements-create**
   - Accept `idempotencyKey` from client
   - Return existing engagement if key matches

3. **Improve user-facing states**
   - Add granular steps: preparing, waiting_for_user, processing, confirming, publishing, done
   - Distinguish payment failure from publish failure

4. **Add retry/resume capability**
   - Store in-flight booking state in AsyncStorage
   - Allow resume on app restart
   - Auto-retry failed publish

### Phase 2: Backend Hardening (This Week)

5. **Create atomic payment-publish endpoint**
   - Single endpoint that confirms payment AND publishes
   - Idempotent - safe to retry
   - Returns success only if both succeed

6. **Add webhook retry queue**
   - Failed webhooks should retry with backoff
   - Dead letter queue for investigation

7. **Add reconciliation job**
   - Daily scan for paid orders with unpublished engagements
   - Auto-publish or alert

### Phase 3: Client Resilience (Next Sprint)

8. **Implement optimistic UI with rollback**
   - Show success immediately after payment sheet
   - Background sync with rollback on failure

9. **Add deep linking for payment recovery**
   - URL scheme to resume interrupted bookings

---

## Scorecard (Current State)

| Item | Status | Notes |
|------|--------|-------|
| Failure map documented | ✅ | This document |
| Payment states improved | ❌ | Step 2 is too vague |
| End-to-end test for text | ⚠️ | Manual only, needs automation |
| End-to-end test for video | ⚠️ | Manual only, needs automation |
| End-to-end test for call | ⚠️ | Not verified |
| Client fragility reduced | ❌ | Still client-driven success chain |
| Backend authority established | ⚠️ | Webhook exists but client overrides |
| Idempotency implemented | ❌ | None present |
| Recovery mechanism | ❌ | None present |

---

## File Modifications Required

### Client
- `apps/mobile/src/hooks/useBookingFlow.ts` - Rewrite success chain
- `apps/mobile/src/screens/dashboard/coaching/BookSessionScreen.tsx` - Add granular states

### Backend
- `apps/functions/supabase/functions/engagements-create/index.ts` - Add idempotency
- `apps/functions/supabase/functions/payments-review-order-confirm/index.ts` - Deprecate or add polling
- `apps/functions/supabase/functions/engagements-publish/index.ts` - Add retry logic
- `apps/functions/supabase/functions/payments-webhook/index.ts` - Add auto-publish option

---

## Testing Matrix

| Scenario | Expected | Current Risk |
|----------|----------|--------------|
| Happy path | ✅ Works | Low |
| Payment fails | ✅ Shows error | Low |
| Payment succeeds, confirm fails | ❌ Shows "failed", actually paid | HIGH |
| Payment succeeds, publish fails | ❌ Shows "failed", actually paid | HIGH |
| App crash mid-flow | ❌ No recovery | HIGH |
| Network timeout on create | ⚠️ May duplicate | MEDIUM |
| Double-tap submit | ⚠️ May duplicate | MEDIUM |
| Webhook delayed | ⚠️ Race condition | LOW |
