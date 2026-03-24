# Spotter — Stripe Test Verification Guide

> This document verifies that Spotter's Stripe integration is properly wired to test mode and documents end-to-end testing procedures.

---

## Overview

Spotter uses **Stripe** for payment processing across:
- Tier subscriptions (SELECT, SUMMIT, Organizer tiers)
- Event registration payments
- Guest checkout flows

This guide covers:
1. How to verify Spotter is using Stripe test mode
2. How to create Stripe test keys
3. How to run end-to-end payment tests
4. What to verify after each test

---

## 1. Verify Current Stripe Configuration

### Check Environment Variables

```bash
# Staging (.env.staging)
grep -i STRIPE ~/Documents/Spotter/.env.staging

# Expected output for test mode:
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Check Edge Function Code

All Stripe edge functions use `Deno.env.get('STRIPE_SECRET_KEY')` which reads from the environment.

**Files to verify:**
- `apps/functions/supabase/functions/stripe-checkout/index.ts`
- `apps/functions/supabase/functions/payments-webhook/index.ts`
- `apps/functions/supabase/functions/stripe-customer-portal/index.ts`
- `apps/functions/supabase/functions/guest-payment-webhook/index.ts`
- `apps/functions/supabase/functions/_shared/payments.ts`

**What to look for:**
```typescript
// ✅ Correct — reads from env
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

// ✅ Correct — webhook verification
const valid = await verifyStripeWebhookSignature(rawBody, signature, env.stripeWebhookSecret);
```

**What to avoid:**
```typescript
// ❌ Wrong — hardcoded key in code
const stripe = new Stripe('sk_test_...');
```

---

## 2. Create Stripe Test Keys

### Step 1 — Create Stripe Account (or Use Existing)

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. If you don't have an account, create one (use a separate email for test vs. production)
3. Toggle between **Test mode** and **Live mode** using the switch in the left nav

> **Important:** Always verify you are in **Test mode** (blue banner: "You are in test mode") before proceeding.

### Step 2 — Get API Keys

Go to **Developers → API Keys** in Stripe Dashboard.

You will see two sets of keys:

| Key Type | Prefix | Used For |
|----------|--------|----------|
| **Secret key** | `sk_test_...` | Server-side (edge functions) |
| **Publishable key** | `pk_test_...` | Client-side (mobile app) |

**Copy the test keys:**
- `STRIPE_SECRET_KEY` = `sk_test_...` from "Secret key" row
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_test_...` from "Publishable key" row

### Step 3 — Create Webhook Secret

1. Go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://<your-project>.supabase.co/functions/v1/stripe-webhook` (for staging: your local or staging URL)
4. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `account.updated`
5. Click **Add endpoint**
6. Copy the **Signing Secret** (starts with `whsec_...`) → this is `STRIPE_WEBHOOK_SECRET`

> **For local testing:** Use `stripe listen` CLI command:
> ```bash
> stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
> ```
> This gives you a local webhook secret.

### Step 4 — Create Test Price IDs

In test mode, you need test price IDs. Create products and prices in the Stripe Dashboard:

1. Go to **Products → Add product**
2. Create products for each tier:

| Product Name | Mode | Price | Price ID (test) |
|-------------|------|-------|-----------------|
| Spotter SELECT Monthly | Recurring | $X/month | `price_test_...` |
| Spotter SELECT Yearly | Recurring | $X/year | `price_test_...` |
| Spotter SUMMIT | One-time | $X | `price_test_...` |
| Spotter Organizer Bronze Monthly | Recurring | $X/month | `price_test_...` |
| Spotter Organizer Bronze Yearly | Recurring | $X/year | `price_test_...` |
| Spotter Organizer Silver Monthly | Recurring | $X/month | `price_test_...` |
| Spotter Organizer Silver Yearly | Recurring | $X/year | `price_test_...` |
| Spotter Organizer Gold Monthly | Recurring | $X/month | `price_test_...` |
| Spotter Organizer Gold Yearly | Recurring | $X/year | `price_test_...` |

3. Copy each price ID (starts with `price_test_...`)

### Step 5 — Configure Environment

```bash
# .env.staging
STRIPE_SECRET_KEY=sk_test_...         # From Developers → API Keys
STRIPE_WEBHOOK_SECRET=whsec_...      # From Webhooks endpoint
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # From Developers → API Keys

# Tier prices
STRIPE_PRICE_SELECT_MONTHLY=price_test_...
STRIPE_PRICE_SELECT_YEARLY=price_test_...
STRIPE_PRICE_SUMMIT_MONTHLY=price_test_...
STRIPE_PRICE_SUMMIT_YEARLY=price_test_...
STRIPE_ORGANIZER_BRONZE_MONTHLY=price_test_...
STRIPE_ORGANIZER_BRONZE_YEARLY=price_test_...
STRIPE_ORGANIZER_SILVER_MONTHLY=price_test_...
STRIPE_ORGANIZER_SILVER_YEARLY=price_test_...
STRIPE_ORGANIZER_GOLD_MONTHLY=price_test_...
STRIPE_ORGANIZER_GOLD_YEARLY=price_test_...
```

---

## 3. Stripe Test Cards

Stripe provides test card numbers that simulate specific responses without moving real money.

### Primary Test Card
| Card Number | Behavior |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Always fails — `card_declined` |
| `4000 0025 0000 3155` | Always fails — `insufficient_funds` |
| `4000 0000 0000 9995` | Always fails — `expired_card` |
| `4000 0000 0000 0069` | Always fails — `processing_error` |

**All test cards:** Expiry date in the future, any 3-digit CVC, any 5-digit ZIP.

### Test Billing Scenarios

| Scenario | Card | CVC | Expiry |
|----------|------|-----|--------|
| Success | 4242 4242 4242 4242 | Any 3 digits | Any future date |
| Decline — insufficient funds | 4000 0000 0000 9995 | Any 3 digits | Any future date |
| Decline — expired card | 4000 0000 0000 0069 | Any 3 digits | Any past date |
| Decline — processing error | 4000 0000 0000 0069 | Any 3 digits | Any future date |
| 3D Secure authentication | 4000 0000 0000 3220 | Any 3 digits | Any future date |

### How to Use Test Cards

1. In the Spotter mobile app, go to checkout
2. Enter a test card number in the Stripe Elements form
3. Enter any future expiry date (e.g., `12/28`)
4. Enter any 3-digit CVC (e.g., `123`)
5. Enter any billing ZIP (e.g., `85251`)
6. Submit payment

---

## 4. End-to-End Test Scenarios

Run these tests in staging with Stripe test mode enabled.

### Test 1 — Free → SELECT Upgrade (Monthly)

1. Create a new test user account (FREE tier)
2. Go to tier upgrade screen → SELECT Monthly → tap Upgrade
3. Stripe Checkout page opens
4. Enter test card: `4242 4242 4242 4242`
5. Complete payment
6. **Verify:**
   - [ ] Stripe Dashboard shows `checkout.session.completed` event
   - [ ] Webhook fires successfully (no 4xx response)
   - [ ] User's `tier` in `users` table updated to `select`
   - [ ] User's `stripe_subscription_id` is set
   - [ ] User redirected to success page in app
   - [ ] Email receipt sent (check email inbox)

### Test 2 — Free → SELECT Upgrade (Yearly)

1. As a new FREE test user, select SELECT Yearly
2. Complete checkout with `4242 4242 4242 4242`
3. **Verify:**
   - [ ] Price charged is yearly amount (not monthly)
   - [ ] `subscription_interval` in DB is `yearly`
   - [ ] Subscription renews in 1 year (Stripe Dashboard shows next billing date)

### Test 3 — Payment Decline

1. As a FREE test user, attempt SELECT Monthly checkout
2. Enter card: `4000 0000 0000 9995` (insufficient funds)
3. **Verify:**
   - [ ] User sees decline error message in checkout flow
   - [ ] User's tier remains `free`
   - [ ] No Stripe subscription created
   - [ ] `payment_intent.payment_failed` event in Stripe Dashboard

### Test 4 — Subscription Renewal Webhook

1. In Stripe Dashboard, find an existing test subscription
2. Manually trigger a renewal by advancing the subscription period (or use `stripe` CLI to simulate)
3. **Verify:**
   - [ ] `invoice.payment_succeeded` event fires
   - [ ] Tier remains active
   - [ ] Renewal count increments in Stripe Dashboard

### Test 5 — Subscription Cancellation

1. In Stripe Dashboard, cancel a test subscription
2. **Verify:**
   - [ ] `customer.subscription.deleted` event fires
   - [ ] User's tier downgrades to `free` (or appropriate fallback)
   - [ ] User loses SELECT feature access

### Test 6 — Guest Checkout (Event Registration)

1. As a guest (not logged in), find a paid event
2. Proceed to guest checkout
3. Enter email + test card `4242 4242 4242 4242`
4. Complete payment
5. **Verify:**
   - [ ] Guest checkout session created
   - [ ] `checkout.session.completed` event fires
   - [ ] `guest_payment_webhook` processes successfully
   - [ ] Email receipt sent to provided email

### Test 7 — Refund Flow

1. Complete a test payment with `4242 4242 4242 4242`
2. In Stripe Dashboard, find the charge → Refund
3. **Verify:**
   - [ ] `charge.refunded` event fires
   - [ ] Webhook updates relevant record in Spotter DB
   - [ ] Email confirmation sent to user

### Test 8 — Organizer Tier Checkout

1. As a new user, attempt to purchase Organizer Bronze Monthly
2. **Verify:**
   - [ ] Checkout session created with correct price ID
   - [ ] On success, `organizer_tier` set in users or organizers table
   - [ ] Stripe Connect onboarding flow triggered (if applicable)

---

## 5. Webhook Testing

### Using Stripe CLI (Recommended for Local Testing)

```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Listen for webhooks and forward to local Supabase
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Copy the webhook signing secret shown (whsec_...)
# Set it in your .env.local:
# STRIPE_WEBHOOK_SECRET=whsec_...
```

### Trigger Test Webhooks

```bash
# Trigger a checkout.session.completed event
stripe trigger checkout.session.completed

# Trigger a payment_intent.succeeded event
stripe trigger payment_intent.succeeded

# Trigger a subscription deletion
stripe trigger customer.subscription.deleted
```

---

## 6. Verify Test Mode Is Active

### In Stripe Dashboard
Look for the **blue banner** at the top of any Stripe Dashboard page:
```
"You are viewing test data. This is a sandbox environment.
Real card transactions will not be processed."
```

### In Code
Add a temporary log in `stripe-checkout/index.ts`:
```typescript
const mode = Deno.env.get('STRIPE_SECRET_KEY')!.startsWith('sk_test_')
  ? 'TEST'
  : 'LIVE';
console.log(`Stripe mode: ${mode}`);
```

### Visual Check
Test mode payments show in Stripe Dashboard with:
- Yellow "Test" label
- No real money moved
- Card numbers masked but readable

---

## 7. Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Webhook never fires | Wrong webhook URL or not configured | Reconfigure webhook in Stripe Dashboard |
| 401 from Stripe | Wrong API key | Verify `STRIPE_SECRET_KEY` is `sk_test_...` not `sk_live_...` |
| Price not found | Wrong or missing price ID | Verify price ID in env matches Stripe Dashboard |
| Checkout fails silently | App URL mismatch | `APP_URL` must match what Stripe redirects to |
| Webhook signature mismatch | Wrong `STRIPE_WEBHOOK_SECRET` | Copy fresh signing secret from Stripe Dashboard |
| Subscription not activated | Webhook handler not processing | Check `payments-webhook` edge function logs |

---

## 8. Michael's Action Items

1. **Create Stripe test account** at [dashboard.stripe.com](https://dashboard.stripe.com) (if not already done)
2. **Switch to Test mode** (blue toggle in Stripe Dashboard)
3. **Get test API keys** from Developers → API Keys
4. **Configure webhook endpoint** for `stripe-webhook` edge function
5. **Create test products and price IDs** in Stripe Dashboard
6. **Update `.env.staging`** with all Stripe test credentials
7. **Run all 8 test scenarios** above in staging
8. **Verify webhook logs** in Supabase Edge Functions dashboard
9. **Document real Stripe keys** (for `.env.production`) separately — never commit live keys

---

## Key Stripe Resources

| Resource | URL |
|----------|-----|
| Stripe Dashboard | https://dashboard.stripe.com |
| Stripe Test Cards | https://stripe.com/docs/testing |
| Stripe CLI | https://stripe.com/docs/stripe-cli |
| Webhook Events | https://stripe.com/docs/webhooks/stripe-events |
| API Keys | https://dashboard.stripe.com/apikeys |
| Test Mode Verification | https://dashboard.stripe.com/settings/test |
