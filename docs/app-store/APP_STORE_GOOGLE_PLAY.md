# Spotter — Google Play Store Listing

> Draft — Google Play Console submission. Content subject to revision after legal review and final product freeze.

---

## App Name
**Spotter** (or **Spotter Golf**)

> Confirm availability in Google Play Console before finalizing.

---

## Tagline / Short Description
**Find golfers at your skill level. Play better rounds.**

> **Character limit:** 80 characters (hard limit — Google will truncate in search results)

---

## Full Description

**The Network Built for Golfers Who Take the Game Seriously.**

Spotter is the first golf networking app built around one core idea: you should play with people at your skill level.

Whether you're a scratch golfer hunting for competitive rounds or a 12-handicapper who just wants consistent partners, Spotter matches you with verified golfers in your tier. No beginners. No sandbaggers. Just golfers like you.

---

**How It Works**

**1. Join Your Tier**
Sign up and get placed in your skill tier: Tour (scratch to 5), Precision (6-12), Play (13-20), or Access (21+). Your tier is visible to other members in your tier — and only your tier.

**2. Find Your People**
Browse profiles of golfers near you. Filter by location, schedule availability, preferred courses, and playing style. See who else is looking for rounds.

**3. Connect & Schedule**
Send a connection request to someone you'd like to play with. When they accept, you can message directly and set up a round. Simple.

---

**Why Spotter?**

**Same-Tier Visibility** — Other apps show you everyone's profile. Spotter shows you only golfers at your skill level. Your network is relevant by design.

**Trust System** — Spotter members are real golfers. We use handicap verification, round history, and member reviews to keep the network credible.

**Built for Serious Amateurs** — If you're playing 20+ rounds a year and care about finding consistent playing partners, Spotter was built for you.

**All the Tools In One Place**
- Tier-gated discovery and matching
- Round scheduling and coordination
- Golf course directory (courses across the US)
- Coaching marketplace (Spotter SELECT+)
- Tournament organizer tools (Organizer tiers)

---

**Membership Tiers**

**FREE** — Browse your tier, send connection requests, join rounds in your area.

**SELECT** ($X/month or $X/year) — Full same-tier access, unlimited connections, round scheduling, video analysis, coaching marketplace access. The complete Spotter experience.

**SUMMIT** ($X lifetime) — Everything in SELECT, plus lifetime membership and founding member status.

---

> **Character count:** ~1,800 (well under the 4,000 character limit)

---

## Graphics Required

### App Icon
- **Size:** 512x512 PNG (will be cropped to various sizes for different surfaces)
- **Required format:** 32-bit PNG with alpha channel
- **Design guidance:** Spotter wordmark or logo. Must look sharp when cropped to circle (Android adaptive icon).

### Feature Graphic
- **Size:** 1024x500 PNG (no alpha channel)
- **Shown in:** Play Store listing header, various promotional surfaces
- **Design guidance:** Bold, clean graphic that reads well at small sizes. Avoid small text.

### Screenshots

Google Play requires a minimum of **2 screenshots** (phone-size) but you should provide **8** (4 phone + 4 tablet minimum) to fill the Play Store listing properly.

**Phone screenshots (recommended 9:16 or 1080x1920px):**
1. **Home/Discovery** — Tier-gated profile discovery
2. **Profile Screen** — User's own profile
3. **Connection/Matching** — How connections appear within tier
4. **Round Scheduling** — Round coordination interface
5. **Golf Course Directory** — Course map or list view
6. **Onboarding/Tier Selection** — Skill tier placement flow
7. **Coaching (SELECT+)** — Video analysis or coaching marketplace
8. **Video/Rounds Feed** — Activity feed showing rounds and video

**Tablet screenshots (recommended 9:16 or same as phone):**
Same 8 screenshots at tablet dimensions.

**Requirements:**
- JPEG or 24-bit PNG
- Minimum dimension: 320px
- Maximum dimension: 3840px
- Must match final UI before submission

### Promo Graphic / Video (Optional)

- **Short promo video:** Up to 30 seconds, MP4, shown in Play Store listing
- **Additional promotional graphics:** Optional; varies by campaign type

---

## Category

**Primary Category:** Sports
**Secondary Category:** Social

---

## Content Rating

Complete the questionnaire in Google Play Console. Based on app content:
- **Approximate rating:** Everyone 10+ (US) / PEGI 3 (EU)
- **Contains:** Social features, user-generated content, in-app purchases
- **No mature content, no violence, no gambling**

---

## Requirements Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| App Bundle ID | 🔴 Placeholder | Must be registered in Play Console (e.g., `com.spotter.app`) |
| Service Account JSON | 🔴 Placeholder | Required for EAS build submission (`service-account.json`) |
| Privacy Policy URL | 🔴 Required | Must be live HTTPS URL before submission |
| Data Safety Form | 🔴 Required | Must be completed in Play Console (describes data collection) |
| Content Rating Questionnaire | 🔴 Required | Complete in Play Console |
| Ad Declaration | ✅ "Not Ad Supported" | No ads in app |
| In-App Purchases | ✅ Declared | Using Stripe, not Google Play Billing |
| Accessibility Declaration | 🔴 Required | Briefly describe accessibility features |

---

## Data Safety Form (Google Play)

Google Play requires a "Data Safety" form disclosing what data the app collects. Key disclosures for Spotter:

| Data Type | Collected? | Shared with Third Parties? | Purpose |
|-----------|-----------|---------------------------|---------|
| Location (precise) | Yes (with consent) | No | Course discovery, round scheduling |
| Location (approximate) | Yes | No | Network discovery |
| Name / Profile | Yes | Other users (within tier) | Identity in network |
| Email address | Yes | No | Account, communications |
| Handicap / skill tier | Yes | Other users (within tier) | Tier matching |
| Payment info | Yes | Stripe (processor only) | Subscription processing |
| Device ID | Yes | No | Auth, security |
| Usage data | Yes | PostHog (analytics) | Product improvement |

> **Note:** This is a draft. The Data Safety form must be finalized with actual data collection disclosures reviewed by legal before submission.

---

## Notes for Michael

- Google Play requires a privacy policy URL that is live and accessible before you can publish
- The Data Safety form is shown to users on the Play Store listing — inaccuracies here can cause rejection
- "In-app purchase" declaration: since Spotter uses Stripe (not Google Play Billing), you must clearly indicate this. Google may require you to disclose that Apple IAP is not used and that Stripe is the payment processor
- App signing: configure Play App Signing (optional but recommended for key security)
- Device manifest: ensure all permissions are justified (location, camera for video upload, storage for media)
- Internal testing track: use before submitting to production to catch UI/screenshot mismatches
