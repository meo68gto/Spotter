# Spotter — Analytics Setup Guide (PostHog)

> This document explains how to configure PostHog for Spotter's mobile and web applications.

---

## Overview

Spotter uses **PostHog** for product analytics — tracking user behavior, funnel conversion, retention, and feature adoption.

**Current status:** The PostHog integration is wired in the codebase but uses placeholder credentials (`your-posthog-key`). This document explains how to:
1. Create a real PostHog project
2. Get your API key
3. Configure it in Spotter

---

## What Is PostHog?

PostHog is an open-source product analytics platform. It provides:
- Event tracking (`trackEvent` calls throughout the app)
- Funnel analysis (signup → onboard → connect → upgrade)
- Session recording (optional, privacy-sensitive)
- Feature flags
- A/B testing

Spotter's mobile app uses PostHog's `/capture` API directly (no SDK dependency).

---

## Step 1 — Create a PostHog Account

1. Go to [https://posthog.com](https://posthog.com)
2. Click **Get started** → sign up with email or GitHub/Google
3. Create your **first project**:
   - Project name: `Spotter` (or `Spotter Production`)
   - Team slug: your choice (e.g., `spotter-golf`)
   - Web app URL: `https://spotter.golf` (for production)
   - **Set instance region:** Choose US or EU

4. After project creation, you'll land on the onboarding wizard

---

## Step 2 — Get Your API Keys

In PostHog, go to **Settings → Project → Keys** (or `Settings → Projects → [Project] → Keys`).

You will see:

| Key | Used For | Spotter Env Var |
|-----|---------|----------------|
| **Project API Key** | Mobile app event capture (`/capture/`) | `EXPO_PUBLIC_POSTHOG_KEY` |
| **Public Edge API Key** | (Optional) Web client-side | Not needed |
| **Personal API Key** | Server-side operations, CI, tooling | `POSTHOG_PROJECT_API_KEY` |

**Copy the Project API Key.** It looks like: `phc_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

---

## Step 3 — Configure Environment Variables

### Mobile App (`apps/mobile/.env.local` or `.env.staging` / `.env.production`)

```bash
EXPO_PUBLIC_POSTHOG_KEY=phc_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Supabase Edge Functions (optional server-side)

```bash
POSTHOG_PROJECT_API_KEY=phc_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
POSTHOG_HOST=https://app.posthog.com
```

> **Note:** Do NOT use the same key for both client-side (mobile) and server-side. Use the Project API Key for client-side `/capture/` calls. Use the Personal API Key only for server-side operations.

---

## Step 4 — Recommended Event Taxonomy

Before instrumenting, define your event taxonomy. Suggested events for Spotter:

### Core Funnel Events

| Event Name | Trigger | Properties |
|-----------|---------|-----------|
| `app_installed` | First open after install | `platform`, `source` |
| `signup_started` | User taps Sign Up | `method` (email, Apple, Google) |
| `signup_completed` | Account created | `tier_initial` (free) |
| `onboarding_started` | First step of onboarding | — |
| `onboarding_completed` | All onboarding steps done | `skill_tier`, `handicap` |
| `tier_viewed` | User views a tier upgrade screen | `target_tier` |
| `upgrade_clicked` | User taps upgrade CTA | `tier`, `billing_interval` |
| `checkout_started` | Stripe checkout initiated | `tier`, `billing_interval`, `source` |
| `checkout_completed` | Stripe checkout success | `tier`, `billing_interval`, `session_id` |
| `checkout_cancelled` | User cancels Stripe checkout | `tier`, `step` |

### Networking Events

| Event Name | Trigger | Properties |
|-----------|---------|-----------|
| `discovery_viewed` | User opens discovery screen | `filters_applied` |
| `profile_viewed` | User views another member profile | `viewed_tier`, `connection_status` |
| `connection_request_sent` | User sends connection request | `recipient_tier`, `method` |
| `connection_request_received` | User receives connection request | `sender_tier` |
| `connection_accepted` | Connection confirmed | — |
| `connection_declined` | Connection rejected | — |
| `message_sent` | Direct message sent | `connection_id` |
| `round_created` | User posts a round | `tier`, `location`, `public/private` |
| `round_joined` | User joins someone else's round | `round_id`, `organizer_tier` |
| `round_completed` | Round marked as played | `round_id`, `course_id` |

### Video Events (SELECT+)

| Event Name | Trigger | Properties |
|-----------|---------|-----------|
| `video_uploaded` | Video uploaded | `duration_seconds`, `upload_source` |
| `video_analysis_requested` | User requests AI analysis | — |
| `video_analysis_received` | Analysis results displayed | `turnaround_ms` |
| `coaching_request_sent` | User contacts a coach | `coach_id`, `tier` |

---

## Step 5 — Configure in PostHog

After creating your project and getting keys:

### Set up dashboards
1. **Funnel Dashboard:** Create a funnel: `signup_started` → `signup_completed` → `onboarding_completed` → `connection_request_sent` → `upgrade_clicked`
2. **Retention Dashboard:** Track 1-day, 7-day, 30-day retention by signup cohort
3. **Revenue Dashboard:** Track MRR from Stripe webhook events (requires server-side PostHog integration)

### Enable Passive Features (optional)
- **Session recording:** Enable for web app (not recommended for mobile due to privacy)
- **Feature flags:** Enable to support A/B testing
- **Correlation analysis:** Enable to find drop-off causes

### Set up data retention
PostHog free tier: **1M events/month, 30-day retention**
PostH paid tier: **unlimited events, configurable retention**

For GDPR compliance, set retention to maximum 26 months in project settings.

---

## Step 6 — Verify Events Are Arriving

After configuring the API key in your environment:

1. **Local dev:** Run the mobile app and trigger events manually
2. Go to PostHog → **Events** tab
3. You should see events appearing in real-time
4. If no events appear after 5 minutes:
   - Verify `EXPO_PUBLIC_POSTHOG_KEY` is set correctly
   - Check the PostHog `/capture/` endpoint is accessible
   - Verify network is not blocked by firewall or VPN

### PostHog Debugger
PostHog includes a **debugger mode** that shows events as they arrive. Use it to verify event structure and properties before deploying.

---

## Step 7 — CI / Automated Verification

### Verify in E2E Tests
Add PostHog event verification to `scripts/ops/e2e-verification.sh`:

```bash
# After signup test, verify PostHog received the event
curl -X POST "https://app.posthog.com/capture/" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "'$POSTHOG_PROJECT_API_KEY'",
    "event": "e2e_test_event",
    "distinct_id": "test_user_id",
    "properties": { "test": true }
  }'
```

---

## Key PostHog Resources

| Resource | URL |
|----------|-----|
| PostHog Dashboard | https://app.posthog.com |
| PostHog Docs | https://posthog.com/docs |
| PostHog API | https://posthog.com/docs/api |
| Event Debugger | https://app.posthog.com/instance/editor |
| Privacy (GDPR/CCPA) | https://posthog.com/docs/privacy |

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| No events appear | Wrong API key | Verify `EXPO_PUBLIC_POSTHOG_KEY` matches Project API Key exactly |
| 401 errors | Using Personal API Key for capture | Use Project API Key for `/capture/` endpoint |
| Events delayed | PostHog free tier batching | Free tier batches events; expect 1-5 minute delay |
| High event volume | Unintended double-capture | Audit code for duplicate `trackEvent` calls |

---

## Michael's Action Items

1. **Create PostHog account** at [posthog.com](https://posthog.com)
2. **Create a project** named `Spotter`
3. **Copy Project API Key** from Settings → Project → Keys
4. **Update `.env.staging` and `.env.production`** with real key
5. **Define event taxonomy** using the table above
6. **Verify events** appear in PostHog after running a test signup flow
7. **Set up dashboards** for funnel, retention, and revenue tracking
