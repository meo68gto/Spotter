# Spotter Day 3 Booking/Payment Hardening - Completion Scorecard

**Date**: March 18, 2026  
**Objective**: Make booking/payment the single most trustworthy path in the product

---

## ✅ Deliverables Completed

### 1. Failure Map Documented
**Location**: `docs/BOOKING_FAILURE_ANALYSIS.md`

Identified 7 critical failure points:
- FP1: Client-Only Success Chain (HIGH)
- FP2: Client Authority Over Payment Status (HIGH)
- FP3: No Publish Recovery Mechanism (MEDIUM)
- FP4: Missing Idempotency (MEDIUM)
- FP5: Poor User State Granularity (MEDIUM)
- FP6: Webhook vs Client Race Condition (LOW)
- FP7: No End-to-End Transaction (HIGH)

---

### 2. Payment States Improved
**Files Modified**:
- `apps/mobile/src/hooks/useBookingFlow.ts` - Complete rewrite
- `apps/mobile/src/screens/dashboard/coaching/BookSessionScreen.tsx` - Complete rewrite

**New Granular States**:
| Old State | New States |
|-----------|------------|
| Step 2: "Opening payment sheet..." | `creating`, `preparing_payment`, `awaiting_payment`, `processing_payment`, `confirming`, `publishing`, `payment_failed`, `publish_failed` |

**User-Facing Improvements**:
- ✅ Clear progress indicators with ActivityIndicator
- ✅ Distinct error states for payment vs publish failures
- ✅ Retry capability for publish failures
- ✅ Helpful guidance text per state
- ✅ "Contact Support" option for unrecoverable failures

---

### 3. Backend Authority Established
**Files Modified**:
- `apps/functions/supabase/functions/engagements-publish/index.ts` - Now verifies payment with Stripe
- `apps/functions/supabase/functions/payments-webhook/index.ts` - Auto-publishes engagements
- `apps/functions/supabase/functions/engagements-create/index.ts` - Added idempotency support

**New Endpoint**:
- `apps/functions/supabase/functions/payments-review-order-get/index.ts` - Client polling endpoint

**Key Changes**:
- ✅ Webhook is now sole authority for payment confirmation
- ✅ Client polls for order status instead of asserting it
- ✅ engagements-publish verifies Stripe payment status before publishing
- ✅ Auto-publish on webhook reduces client fragility
- ✅ Idempotency key support prevents duplicates

---

### 4. End-to-End Tests Created
**File**: `apps/functions/tests/booking-flow.e2e.test.ts`

**Coverage**:
| Mode | Status |
|------|--------|
| text_answer | ✅ Full flow tested |
| video_answer | ✅ Full flow tested |
| video_call | ✅ Full flow tested (scheduled_time validated) |

**Test Scenarios**:
- ✅ Happy path for all modes
- ✅ Idempotency handling
- ✅ Payment webhook integration
- ✅ Publish retry after failure
- ✅ Already-published idempotency

---

### 5. Client Fragility Reduced
**Before**:
```
1. Client creates engagement
2. Client initializes payment
3. Client presents sheet
4. Client asserts "payment succeeded" to backend
5. Client tells backend to publish
6. Any failure = user sees "Payment failed" (even if payment succeeded)
```

**After**:
```
1. Client creates engagement (with idempotency key)
2. Client initializes payment
3. Client presents sheet
4. Client polls for webhook confirmation (backend authority)
5. Client requests publish (backend verifies payment)
6. Webhook auto-publishes as backup
7. Distinguish payment failed vs publish failed
8. Retry capability for publish failures
```

---

## 📊 Scorecard Summary

| Item | Status | Evidence |
|------|--------|----------|
| Failure map documented | ✅ Complete | `docs/BOOKING_FAILURE_ANALYSIS.md` |
| Payment states improved | ✅ Complete | 8 distinct states with UI feedback |
| End-to-end test for text_answer | ✅ Complete | `booking-flow.e2e.test.ts` line 37-89 |
| End-to-end test for video_answer | ✅ Complete | `booking-flow.e2e.test.ts` line 91-125 |
| End-to-end test for video_call | ✅ Complete | `booking-flow.e2e.test.ts` line 127-180 |
| Client-side fragility reduced | ✅ Complete | Polling instead of assertion, webhook auto-publish |
| Unsupported mode removed | ✅ N/A | All 3 modes fully supported |

---

## 🔄 Phase 2 Recommendations (Next Steps)

### Immediate (This Week)
1. **Deploy new functions**:
   ```bash
   supabase functions deploy engagements-create
   supabase functions deploy engagements-publish
   supabase functions deploy payments-review-order-get
   supabase functions deploy payments-webhook
   ```

2. **Configure webhook in Stripe dashboard**:
   - Endpoint: `https://<project>.supabase.co/functions/v1/payments-webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

3. **Test on staging**:
   - Run through all 3 modes
   - Simulate network failures
   - Verify idempotency with double-tap

### Short-term (Next Sprint)
4. **Add AsyncStorage recovery**:
   - Store in-flight booking state locally
   - Resume on app restart

5. **Add reconciliation job**:
   - Daily check for paid orders with unpublished engagements
   - Auto-publish or alert

6. **Add Stripe webhook retry queue**:
   - Failed webhooks should retry with exponential backoff

### Long-term (Backlog)
7. **Atomic payment-publish endpoint**:
   - Single idempotent endpoint that does both

8. **Deep linking for recovery**:
   - URL scheme to resume interrupted bookings

---

## 🎯 Confidence Level

| Component | Confidence | Reasoning |
|-----------|----------|-----------|
| Booking flow reliability | HIGH | Webhook authority, polling, idempotency |
| User experience | HIGH | Granular states, retry capability |
| Payment integrity | HIGH | Backend verification, Stripe validation |
| Recovery from failures | MEDIUM | Manual retry available, auto-retry via webhook |

---

## 📁 Files Modified

### Client
1. `apps/mobile/src/hooks/useBookingFlow.ts` - Complete rewrite
2. `apps/mobile/src/screens/dashboard/coaching/BookSessionScreen.tsx` - Complete rewrite

### Backend
3. `apps/functions/supabase/functions/engagements-create/index.ts` - Idempotency support
4. `apps/functions/supabase/functions/engagements-publish/index.ts` - Payment verification
5. `apps/functions/supabase/functions/payments-webhook/index.ts` - Auto-publish
6. `apps/functions/supabase/functions/payments-review-order-get/index.ts` - NEW

### Documentation
7. `docs/BOOKING_FAILURE_ANALYSIS.md` - NEW

### Tests
8. `apps/functions/tests/booking-flow.e2e.test.ts` - NEW

---

## 📝 Notes

- All launch modes (text_answer, video_answer, video_call) are fully supported
- No modes were cut - all work end-to-end
- video_call mode has scheduled_time validation but no calendar integration (expected for MVP)
- The booking flow is now significantly more robust with clear failure modes and recovery paths
