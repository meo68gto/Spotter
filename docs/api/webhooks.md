# Webhooks

Spotter uses webhooks for asynchronous events, primarily for Stripe payment processing.

## Overview

- **Primary Webhook**: Stripe payment events
- **Endpoint**: `POST /functions/v1/stripe-webhook`
- **Security**: Signature verification
- **Idempotency**: Events processed once via idempotency keys

## Stripe Webhooks

### Endpoint Configuration

Configure in Stripe Dashboard:

```
Endpoint URL: https://api.spotter.golf/functions/v1/stripe-webhook
Webhook Secret: <whsec_...>
Events to subscribe:
  - checkout.session.completed
  - invoice.payment_succeeded
  - invoice.payment_failed
  - customer.subscription.updated
  - customer.subscription.deleted
```

### Security

All webhook requests include a Stripe signature header:

```http
Stripe-Signature: t=1710807600,v1=...
```

The endpoint verifies this signature before processing:

```typescript
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  webhookSecret
);
```

### Event Types

#### checkout.session.completed

Triggered when a user completes checkout for tier upgrade or event registration.

**Payload:**
```json
{
  "id": "evt_...",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_...",
      "customer": "cus_...",
      "metadata": {
        "type": "tier_upgrade",
        "userId": "uuid",
        "tierSlug": "select"
      },
      "payment_intent": "pi_...",
      "subscription": "sub_..."
    }
  }
}
```

**Actions:**
1. Upgrade user tier
2. Log tier history
3. Send confirmation email

#### invoice.payment_succeeded

Triggered for subscription renewals (annual Select tier).

**Payload:**
```json
{
  "id": "evt_...",
  "type": "invoice.payment_succeeded",
  "data": {
    "object": {
      "id": "in_...",
      "subscription": "sub_...",
      "customer": "cus_...",
      "billing_reason": "subscription_cycle"
    }
  }
}
```

**Actions:**
1. Extend tier expiration date
2. Update subscription status

#### invoice.payment_failed

Triggered when subscription renewal fails.

**Payload:**
```json
{
  "id": "evt_...",
  "type": "invoice.payment_failed",
  "data": {
    "object": {
      "id": "in_...",
      "subscription": "sub_...",
      "customer": "cus_...",
      "attempt_count": 1,
      "next_payment_attempt": 1710894000
    }
  }
}
```

**Actions:**
1. Mark tier status as `payment_failed`
2. Send payment failure notification
3. Log to tier history

#### customer.subscription.updated

Triggered when subscription details change.

**Actions:**
1. Sync subscription status
2. Update tier status accordingly

#### customer.subscription.deleted

Triggered when subscription is cancelled.

**Actions:**
1. Revert user to FREE tier
2. Log cancellation to tier history
3. Send cancellation confirmation

### Webhook Response

Success response:
```json
{ "received": true }
```

Error response:
```json
{
  "error": "Invalid signature",
  "code": "webhook_verification_failed"
}
```

## Local Webhook Testing

Use Stripe CLI for local development:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Trigger test events
stripe trigger checkout.session.completed
```

### Webhook Payload Structure

All Stripe webhook payloads follow this structure:

```typescript
interface StripeWebhookEvent {
  id: string;           // Event ID (for idempotency)
  type: string;         // Event type
  data: {
    object: any;        // The Stripe object
  };
  created: number;      // Unix timestamp
  livemode: boolean;    // Live or test mode
}
```

## Event Processing

### Idempotency

Events are processed exactly once using the event ID:

```sql
-- Check if event already processed
SELECT 1 FROM webhook_events 
WHERE stripe_event_id = 'evt_...';

-- Mark as processed
INSERT INTO webhook_events (stripe_event_id, processed_at)
VALUES ('evt_...', now());
```

### Retry Logic

If the endpoint returns a non-2xx status, Stripe will retry:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4+ | Exponential backoff |

### Error Handling

Webhook processing errors are logged:

```json
{
  "event_id": "evt_...",
  "event_type": "checkout.session.completed",
  "error": "User not found",
  "stack_trace": "...",
  "timestamp": "2024-03-18T20:00:00Z"
}
```

## Metadata Reference

### Tier Upgrade Metadata

```json
{
  "type": "tier_upgrade",
  "userId": "uuid",
  "tierSlug": "select|summit",
  "previousTier": "free"
}
```

### Event Registration Metadata

```json
{
  "type": "event_registration",
  "userId": "uuid",
  "eventId": "uuid",
  "registrationId": "uuid"
}
```

### Organizer Tier Metadata

```json
{
  "type": "organizer_tier",
  "userId": "uuid",
  "organizerTier": "bronze|silver|gold"
}
```

## Testing Webhooks

### Stripe Dashboard Testing

1. Go to Stripe Dashboard → Developers → Webhooks
2. Select your endpoint
3. Click "Send test event"
4. Choose event type and send

### Programmatic Testing

```bash
curl -X POST http://localhost:54321/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test_signature" \
  -d '{
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_...",
        "metadata": {
          "type": "tier_upgrade",
          "userId": "test-uuid",
          "tierSlug": "select"
        }
      }
    }
  }'
```

## Environment Variables

```bash
# Required for webhooks
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional webhook URL override
STRIPE_WEBHOOK_URL=https://api.spotter.golf/functions/v1/stripe-webhook
```

## Monitoring

Monitor webhook health:

```sql
-- Failed webhooks in last 24 hours
SELECT 
  stripe_event_id,
  event_type,
  error_message,
  created_at
FROM webhook_events
WHERE processed_successfully = false
  AND created_at > now() - interval '24 hours';
```

## Related Documentation

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Authentication](./authentication.md)
- [Tier Upgrade Guide](./../guides/tier-upgrade.md)
