# Apple IAP vs. Stripe — Legal & Compliance Determination

**Document type:** Legal determination  
**Project:** Spotter Golf  
**Author:** Fox (for Diana — Legal Division)  
**Date:** 2026-03-24  
**Status:** DRAFT — Requires legal counsel review before shipping  

---

## 1. The Question

Can Spotter process digital subscription payments (SELECT membership at $1,000/year, SUMMIT lifetime at $10,000) via Stripe when users access those purchases from an iOS device? Or is Apple In-App Purchase (IAP) mandatory?

---

## 2. Governing Rules

### Apple App Store Review Guideline 3.1.1 — Apps Offering Purchases

> **3.1.1 In-App Purchase:** If you want to unlock features or functionality within your app, you must use In-App Purchase. App Store apps must use Apple’s IAP payment system exclusively. You cannot provide codes, currencies, alternative payment mechanisms, or any other purchasing mechanisms in your app or Extension for digital purchases.

**Key distinction Apple draws:**

| Purchase Type | Rule | Payment Mechanism |
|---|---|---|
| **Digital goods / services** purchased inside the app | Must use Apple IAP | StoreKit (IAP) exclusively |
| **Physical goods** purchased inside the app | Permitted to use Stripe, PayPal, etc. | Third-party payment processors allowed |
| **Physical services** (e.g., real-world coaching, event tickets) | Permitted to use third-party processors | Third-party payment processors allowed |
| **Browser-based purchases** of digital goods accessed on iOS | Generally not covered by 3.1.1 | Stripe / third-party allowed |

---

## 3. Spotter's Purchase Classification

### SELECT Membership ($1,000/year)
- **Classification:** Digital subscription — unlocks in-app features (unlimited connections, priority matching, organizer access, coaching marketplace, tournament registration)
- **All benefits are delivered digitally inside the app**
- **Conclusion: Apple IAP is required** if sold inside the iOS app

### SUMMIT Membership ($10,000 lifetime)
- **Classification:** Digital lifetime subscription — same logic as SELECT, all value is unlocked inside the app
- **Conclusion: Apple IAP is required** if sold inside the iOS app

### Organizer Tier Subscriptions (Bronze/Silver/Gold — pricing TBD)
- **Classification:** Digital subscription — unlocks organizer dashboard features inside the app
- **Conclusion: Apple IAP is required** if sold inside the iOS app

### Guest Checkout / Physical Goods
- If Spotter later sells physical goods (golf equipment, branded merchandise, real-world event tickets where the member attends in person), those **may** use Stripe under Guideline 3.1.3 (Reader Apps, Physical Goods, and Services).
- This carve-out does NOT apply to any subscription tier currently defined.

---

## 4. The "External" Purchase Exception

Apple's guidelines do permit **purchases made on the web** (e.g., via `spotter.golf`) even if the user later accesses the benefit on iOS. The critical case law and enforcement history:

- **Spotify, Netflix, Amazon:** These companies sell subscriptions through their own websites using their own payment processors. Free/reduced-tier iOS users can subscribe on the web. Apple cannot require IAP for purchases initiated on the web, even if the user accesses the content on iOS.
- **Epic Games v. Apple (2021):** The district court found Apple's anti-steering provisions (preventing developers from directing users to web payment options) were **anti-competitive but not a Sherman Act violation**. The ruling did **not** require Apple to allow external payment links. However, it confirmed that Apple cannot block external-browser payment flows.
- **EU Digital Markets Act (DMA) enforcement, 2024:** Apple now allows "core technology fees" and alternative browser-based payment flows in the EU for "reader apps." This is **not applicable** in the US.

**Practical implication for Spotter:** If a user on an iOS device navigates to `spotter.golf` in **Safari or an in-app browser** and purchases SELECT or SUMMIT there, Stripe is permissible. Apple has challenged even this in some App Store review scenarios.

---

## 5. Current Implementation Risk

**Diana's finding (2026-03-24):** The Spotter mobile app currently has the Stripe SDK installed (`ios/Pods/Stripe*`). If the app contains UI that directly triggers a Stripe Checkout session for SELECT/SUMMIT/Organizer tier purchases, Apple will **reject the build** at App Store Review.

**Known code gaps:**
- `apps/mobile/src/screens/guest/GuestCheckoutScreen.tsx` — likely triggers Stripe Checkout
- Stripe checkout sessions are configured to redirect to `APP_URL=https://spotter.golf` for payment completion
- No Apple IAP implementation exists in the codebase

---

## 6. Decision Matrix

| Purchase | Sold In-App (native screen with Stripe SDK) | Sold on Web (browser, spotter.golf) | Sold via External Link (app → browser → Stripe) |
|---|---|---|---|
| SELECT ($1,000/yr) | ❌ Rejected — requires Apple IAP | ✅ Allowed | ⚠️ Risky — Apple may reject "steering" |
| SUMMIT ($10,000) | ❌ Rejected — requires Apple IAP | ✅ Allowed | ⚠️ Risky — Apple may reject "steering" |
| Organizer Tiers | ❌ Rejected — requires Apple IAP | ✅ Allowed | ⚠️ Risky — Apple may reject "steering" |
| Physical goods (future) | ✅ Stripe allowed under 3.1.3 | ✅ Allowed | ✅ Allowed |

---

## 7. Recommended Path Forward

### Option A: Web-first Purchase Flow (Recommended for v1)
1. **Remove all Stripe UI from inside the mobile app.** No "Upgrade" buttons, no payment screens, no Stripe SDK calls from native code.
2. **Build a purchase flow that opens the browser.** The app can link to `https://spotter.golf/subscribe` where users complete Stripe checkout.
3. **App Store listing should state:** "Subscription purchases are made on our website. Manage at spotter.golf."
4. **Upon purchase completion on the web**, the Stripe webhook fires → edge function upgrades the user's tier in Supabase → next app open reflects the upgraded tier.
5. **PRO:** No Apple IAP revenue share (Apple takes 0% of web purchases). Compliant with current App Store guidelines for external purchase flows.
6. **CON:** Apple has rejected apps for "steering" even via external links. Risk is lower if the link opens in an external browser (not an in-app WebView).

### Option B: Apple IAP (Required if in-app purchase flow is used)
1. Implement StoreKit 2 (or use RevenueCat for cross-platform abstraction)
2. Create all subscription price IDs in App Store Connect
3. StoreKit purchases trigger the same tier upgrade in Supabase via an edge function
4. **PRO:** Fully compliant with App Store guidelines. No rejection risk.
5. **CON:** Apple takes **15-30% revenue share** on all IAP transactions. For a $1,000/year SELECT subscription, that is $150-300/year per subscriber lost to Apple.

### Option C: Hybrid (Recommended if revenue is critical)
- Use **web purchase** for SELECT and SUMMIT (Stripe, 0% to Apple)
- Use **Apple IAP** for lower-priced items (e.g., event tickets, single rounds, coaching sessions — if they are physical services)
- Clearly separate digital subscription UI from physical goods UI

---

## 8. Immediate Action Items

| # | Action | Owner | Status |
|---|---|---|---|
| 1 | Audit all mobile screens for Stripe checkout calls | Victor | Pending |
| 2 | Remove or guard Stripe SDK calls behind a feature flag (disabled for App Store build) | Victor | Pending |
| 3 | Confirm purchase URL is `https://spotter.golf` (web) and not an in-app WebView | Victor | Pending |
| 4 | Add App Store Connect subscription prices for SELECT and Organizer tiers | Bruce | Pending |
| 5 | Implement StoreKit IAP if Apple rejects the web-first approach at review | Victor | Pending |
| 6 | Update Terms of Service §5 to reference Apple IAP if Option B is implemented | Diana | Pending |
| 7 | Add `apps/mobile/src/lib/apple-iap.ts` if Option B is selected | Victor | Pending |

---

## 9. Legal Review Required

This determination should be reviewed by a licensed attorney familiar with:
- Apple App Store Review Guidelines (current version)
- Epic Games v. Apple (9th Circuit, ongoing)
- EU Digital Markets Act (if EU launch is planned)
- Consumer protection laws in states where Stripe web purchases may create jurisdiction

**This document does not constitute legal advice. It is an operational summary for product and engineering decision-making.**

---

*Fox for Diana | Legal Division | Batcave Command Center | 2026-03-24*
