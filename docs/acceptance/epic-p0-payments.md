# Epic P0: Payments and Settlement Correctness

## Objective
Guarantee safe payment authorization, capture, refund, and payout flows for coach/expert transactions.

## User-visible outcome
1. User can create paid order without double-charge.
2. Failed payments are recoverable.
3. Refund status is visible and accurate.
4. Coach payout routing works through Stripe Connect.

## API and DB contract
1. `POST /functions/v1/payments-connect-onboard`
2. `POST /functions/v1/payments-review-order-create`
3. `POST /functions/v1/payments-review-order-confirm`
4. `POST /functions/v1/payments-refund-request`
5. `POST /functions/v1/payments-webhook`
6. Webhook idempotency enforced via `payment_events` unique event IDs.
7. `review_orders.status` lifecycle supported:
   - `created|requires_payment_method|processing|paid|failed|refunded|cancelled`

## Security and RLS rules
1. Webhook endpoint verifies Stripe signature.
2. User may only read own orders.
3. Coach may only read orders assigned to own reviews.
4. Service-role operations are restricted to trusted function paths.

## Telemetry events
1. `payment_order_created`
2. `payment_intent_requires_action`
3. `payment_succeeded`
4. `payment_failed`
5. `payment_refund_requested`
6. `payment_refunded`
7. `stripe_webhook_invalid_signature`

## Test cases
1. Successful payment transitions to `paid` once.
2. Duplicate webhook does not duplicate state transition.
3. Failed payment transitions to `failed` and can retry.
4. Refund request transitions order correctly.
5. Webhook invalid signature rejected.

## Definition of done
1. End-to-end payment flow passes in Stripe test mode.
2. Idempotency tests pass for webhook replay.
3. Production preflight blocks test keys in prod env.
4. Payment alerts configured for failure spikes.

## Non-goals
1. Subscription billing.
2. Multi-currency treasury optimization.
