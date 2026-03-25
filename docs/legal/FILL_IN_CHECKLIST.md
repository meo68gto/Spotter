# Spotter Legal Documents — Fill-In Checklist

**Document type:** Pre-launch legal compliance  
**Project:** Spotter Golf  
**Author:** Fox (for Diana — Legal Division)  
**Date:** 2026-03-24  
**Status:** Every item must be resolved before legal docs are published  

---

## How to Use This Document

This checklist itemizes every `[INSERT]` placeholder found in the three Spotter legal documents:
- `docs/legal/TERMS_OF_SERVICE.md`
- `docs/legal/PRIVACY_POLICY.md`
- `docs/legal/COOKIE_POLICY.md`

Cross-reference against your actual business registration, contracts, and infrastructure to fill each item. Mark complete with ✅, leave incomplete with ❌.

---

## Section 1 — Business Entity Information

| # | Placeholder | Document | What to Fill In | Status |
|---|---|---|---|---|
| 1 | `[INSERT LEGAL ENTITY NAME]` | TOS §12, Privacy §10 | Full legal name (e.g., "Spotter Golf, Inc.") — verify with business registration in state of incorporation | ❌ |
| 2 | `[INSERT LEGAL MAILING ADDRESS]` | TOS §12, Privacy §10 | Street address, city, state, ZIP for legal notices | ❌ |
| 3 | `[INSERT LEGAL NOTICE ADDRESS]` | TOS §10.6 | Same as above — used for official notices | ❌ |

---

## Section 2 — Contact Emails

| # | Placeholder | Document | What to Fill In | Status |
|---|---|---|---|---|
| 4 | `[INSERT SUPPORT EMAIL]` | TOS §3.5, §5.4, §5.8, §8.1, §10.4, §10.5, §12; Privacy §2.4, §5.2, §5.3, §5.4, §5.5, §7.4; Cookie §3.3, §4.3, §5.4 | `support@spotter.golf` (recommended — implies support function exists) | ❌ |
| 5 | `[INSERT OPT-OUT EMAIL]` | TOS §10.5 | `legal@spotter.golf` or `optout@spotter.golf` | ❌ |
| 6 | `[INSERT GDPR/CCPA CONTACT EMAIL]` | Privacy §5.3, §5.4, §5.5 | `privacy@spotter.golf` (dedicated privacy inbox) | ❌ |
| 7 | `[INSERT SUPPORT EMAIL for legal docs]` | Cookie §3.3, §4.3, §5.4 | `support@spotter.golf` | ❌ |

> **⚠️ ACTION REQUIRED:** `support@spotter.golf` does not exist yet. See `docs/ops/SUPPORT.md` for inbox setup.

---

## Section 3 — Governing Law & Dispute Resolution

| # | Placeholder | Document | What to Fill In | Status |
|---|---|---|---|---|
| 8 | `[INSERT — e.g., Delaware or Arizona]` | TOS §10.1 | State of incorporation or primary business operation. **Recommendation:** Delaware (business-friendly, well-understood). Confirm with legal counsel. | ❌ |
| 9 | `[INSERT ARBITRATION BODY — e.g., JAMS or AAA]` | TOS §10.2 | JAMS or AAA (American Arbitration Association). JAMS is generally preferred for commercial disputes. | ❌ |
| 10 | `[INSERT CITY, STATE]` | TOS §10.2 | City/state where arbitration hearings would be held. Typically same as governing law state. | ❌ |

---

## Section 4 — Pricing

| # | Placeholder | Document | What to Fill In | Status |
|---|---|---|---|---|
| 11 | `$[1,000]` | TOS §1.3, §5.1 | Confirm SELECT tier annual price. Currently draft value. | ❌ |
| 12 | `$[10,000]` | TOS §1.3, §5.1 | Confirm SUMMIT tier one-time price. Currently draft value. | ❌ |
| 13 | `[INSERT ORGANIZER TIER PRICING — Bronze/Silver/Gold monthly and annual]` | TOS §5.1 | Create price table in Stripe Dashboard, fill in here. | ❌ |
| 14 | `[INSERT ORGANIZER TIER PRICING — Bronze/Silver/Gold]` | TOS §5.7 | Same as above — both places must match. | ❌ |

---

## Section 5 — Third-Party Service Providers

| # | Placeholder | Document | What to Fill In | Status |
|---|---|---|---|---|
| 15 | `[INSERT SUPABASE DATA CENTER REGION — e.g., us-west-1, eu-west-1]` | Privacy §4.2 | Check your Supabase project settings at supabase.com/dashboard | ❌ |
| 16 | `[INSERT DAILY.CO LEGAL ENTITY NAME — e.g., Daily Media, Inc.]` | Privacy §4.6 | Check Daily.co at `daily.co` or their Stripe billing name. If video feature (EPIC 17) is not live, remove this section entirely. | ❌ |
| 17 | `[INSERT DAILY.CO PRIVACY POLICY URL]` | Privacy §4.6 | `https://www.daily.co/privacy` or current URL from Daily.co | ❌ |
| 18 | `[INSERT RESEND LEGAL ENTITY NAME — Resend, Inc.]` | Privacy §4.7 | Resend, Inc. (verify from Resend dashboard or Stripe records) | ❌ |
| 19 | `[INSERT RESEND PRIVACY POLICY URL]` | Privacy §4.7 | `https://resend.com/privacy` | ❌ |

---

## Section 6 — Document Metadata

| # | Placeholder | Document | What to Fill In | Status |
|---|---|---|---|---|
| 20 | `[INSERT DATE]` — Effective Date | TOS, Privacy, Cookie | Date the documents go live. Use ISO format: e.g., `2026-04-01` | ❌ |
| 21 | `[INSERT DATE]` — Last Updated | TOS, Privacy, Cookie | Same date for v1. Updates on each revision. | ❌ |
| 22 | `[INSERT SUPPORT EMAIL — e.g., legal@spotter.golf]` | Cookie §7 | `support@spotter.golf` | ❌ |
| 23 | `[INSERT SUPPORT EMAIL — e.g., privacy@spotter.golf or support@spotter.golf]` | Privacy §10 | `privacy@spotter.golf` | ❌ |

---

## Section 7 — Data Protection Officer (GDPR)

| # | Placeholder | Document | What to Fill In | Status |
|---|---|---|---|---|
| 24 | `[INSERT DPO NAME AND CONTACT — required for GDPR if Spotter processes large volumes of EU personal data]` | Privacy §10 | Required only if Spotter has EU users. Options: (a) hire a DPO, (b) designate a DPO within the company, (c) if processing is low-risk, document why GDPR Article 37 DPO obligation does not apply. | ❌ |

---

## Section 8 — International Transfers (GDPR)

| # | Placeholder | Document | What to Fill In | Status |
|---|---|---|---|---|
| 25 | `[INSERT SUPPORT EMAIL]` | Privacy §8 | Spotter's privacy inbox for EEA users to request transfer mechanism details | ❌ |

---

## Section 9 — Risk Notes (Informational Only)

These are flagged in Diana's draft but are not `[INSERT]` placeholders. They require **legal counsel review** before publishing:

| # | Risk | Document | Recommendation | Status |
|---|---|---|---|---|
| R-1 | SUMMIT no-refund policy | TOS §5.5 | Consider 30-day refund window for $10K lifetime purchase | ❌ |
| R-2 | Arbitration clause enforceability | TOS §10.2 | California AB 51 may restrict mandatory consumer arbitration | ❌ |
| R-3 | Liability cap enforceability | TOS §7 | EU/UK law may not permit exclusion for death/personal injury | ❌ |
| R-4 | Appeals process has no SLA | TOS §3.5 | Add 14-business-day response SLA; match GDPR 30-day obligation | ❌ |
| R-5 | Apple IAP vs Stripe | TOS §5 | See `docs/legal/APPLE_IAP_DETERMINATION.md` | ❌ |
| R-6 | COPPA age gate | Privacy §1 | App collects date of birth but does not verify age — see `docs/legal/FILL_IN_CHECKLIST.md` age gate item | ❌ |
| R-7 | 72-hour breach notification | Privacy §7.3 | Requires operational test and 24/7 security contact assignment | ❌ |
| R-8 | GDPR transfer mechanisms | Privacy §8 | Standard Contractual Clauses with Supabase — verify with Supabase legal | ❌ |
| R-9 | CCPA 45-day response window | Privacy §5.4 | Support SLA must match — see `docs/ops/SUPPORT.md` | ❌ |
| R-10 | PCI-DSS card data handling | Privacy §2.5 | Verify Stripe alone handles full card numbers; Spotter must never receive them | ❌ |
| R-11 | PostHog IP anonymization | Privacy §2.7 | Confirm PostHog is configured to anonymize IPs at collection | ❌ |
| R-12 | Sentry error log sanitization | Privacy §4.9 | Review Sentry configuration to prevent message capture | ❌ |
| R-13 | Cookie consent banner | Cookie §1 | Must be live before EU launch (GDPR/ePrivacy) | ❌ |
| R-14 | Google Analytics not confirmed | Cookie §3.3 | Confirm GA is not installed; remove cookie table entries if absent | ❌ |
| R-15 | Do Not Track response | Cookie §5.5 | Document DNT response in a separate statement | ❌ |

---

## Section 10 — Summary Count

| Category | Count |
|---|---|
| Total `[INSERT]` placeholders | **25** |
| Business entity items | 3 |
| Email placeholders | 4 |
| Governing law / dispute items | 3 |
| Pricing items | 4 |
| Third-party service provider items | 5 |
| Document metadata items | 4 |
| DPO item | 1 |
| GDPR transfer item | 1 |

---

## Section 11 — Pre-Publication Checklist

Before publishing legal documents at `spotter.golf/legal/*`, confirm:

- [ ] All 25 placeholders filled with verified values
- [ ] Legal counsel has reviewed R-1 through R-15
- [ ] `support@spotter.golf` inbox is active and monitored (see `docs/ops/SUPPORT.md`)
- [ ] `privacy@spotter.golf` inbox is active and monitored
- [ ] `legal@spotter.golf` inbox is active and monitored (or reuse support)
- [ ] Privacy policy URL is live at `spotter.golf/legal/privacy`
- [ ] Terms of Service URL is live at `spotter.golf/legal/tos`
- [ ] Cookie Policy URL is live at `spotter.golf/legal/cookies`
- [ ] Legal URLs are linked from App Store / Google Play store listings
- [ ] Privacy policy URL is linked from the mobile app's settings screen
- [ ] Cookie consent banner is implemented on web (GDPR requirement)
- [ ] COPPA age gate is implemented in registration flow
- [ ] Supabase SCC / data processing agreement is executed (GDPR)
- [ ] Stripe merchant agreement references correct entity name

---

*Fox for Diana | Legal Division | Batcave Command Center | 2026-03-24*
