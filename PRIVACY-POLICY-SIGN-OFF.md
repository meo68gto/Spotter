# Privacy Policy Sign-Off — Diana Prince

**Date:** 2026-04-01
**Status:** NEEDS REVISION — Cannot ship until three BLOCKING items are resolved

---

## GDPR

**Status:** NEEDS_UPDATE

The Eagle AI Privacy Addendum (`EAGLE_AI_PRIVACY.md`) is well-structured and identifies the correct legal basis for biometric-adjacent data (Article 9(2)(a) explicit consent). Data subject rights (access, erasure, correction, portability, restriction, objection, complaint) are comprehensively enumerated. Retention schedules align with data minimization principles.

**APPROVED items:**
- Legal basis for processing special category data (pose keypoints = biometric-adjacent under Art. 9)
- Explicit opt-in consent mechanism with dedicated consent screen
- All GDPR data subject rights enumerated and mapped to specific implementation flows
- Data minimization principles documented
- Security controls (encryption at rest/in transit, role-based access, audit logging)
- Children under 13 exclusion aligned with COPPA

**NEEDS_UPDATE items:**
1. **[ACTION REQUIRED — LEGAL REVIEW]** Supabase DPA must be verified to explicitly cover biometric-adjacent data categories under GDPR Article 9 and confirm SCC coverage for EU data transfers outside the EEA. This is **BLOCKING** for EU user data collection.
2. **[ACTION REQUIRED — LEGAL REVIEW]** Data Protection Officer designation required if EU user base reaches the threshold triggering GDPR Art. 37 requirements. Currently flagged appropriately but needs ongoing monitoring.
3. **[REVIEW]** Privacy contact email (privacy@spotter.golf) is placeholder — must be a real, monitored address before launch.

---

## CCPA / CPRA

**Status:** NEEDS_UPDATE

The main Privacy Policy (`PRIVACY_POLICY.md`) and Eagle AI Addendum together address California consumer rights. Sensitive Personal Information (SPI) classification for biometric data (pose keypoints) is correctly identified. Purpose limitation and no-sale commitments are documented.

**APPROVED items:**
- Right to Know enumerated
- Right to Delete (erasure) with 30-day timeline
- Right to Correct (correction)
- Right to Opt-Out of sale — correctly states "N/A" since no data is sold
- CPRA SPI provisions acknowledged for biometric data
- No discrimination for exercising rights

**NEEDS_UPDATE items:**
1. **[REVIEW]** Privacy contact email (privacy@spotter.golf) and deletion email (deletion@spotter.golf) are placeholder — must be operational before launch.
2. **[REVIEW]** CCPA "Do Not Share My Personal Information" opt-out mechanism referenced but in-app implementation not verified. Must confirm this is a working mechanism, not just policy text.
3. **[REVIEW]** Main Privacy Policy has multiple `[REVIEW]` placeholders for effective date, last updated date, and mailing address. Must be completed before publication.
4. **[REVIEW]** Main Privacy Policy Section 10 (CCPA) "Categories of Personal Information Collected" is marked `[REVIEW]` — must be completed.

---

## BIPA (Illinois Biometric Information Privacy Act)

**Status:** BLOCKING

BIPA compliance is the most acute legal risk for Eagle AI. Pose keypoints extracted from golf swing video (body geometry and joint positioning data) **likely constitute biometric identifiers** under BIPA. The addendum correctly acknowledges this.

The addendum correctly identifies that:
- BIPA statutory damages are **$1,000 per negligent violation** and **$5,000 per intentional/reckless violation**
- Written notice is required before collection
- Written release (consent) must be obtained before collection
- Biometric data cannot be sold or profited from

**CRITICAL — BLOCKING:**

> **"Failure to implement the consent flow in Section 4 before enabling Eagle AI analysis for Illinois users creates direct BIPA liability exposure. Do not launch Eagle AI for Illinois users without the consent mechanism fully operational."** — EAGLE_AI_PRIVACY.md Section 8.3

**BIPA requires:**
1. ✅ Written notice before collection — provided in this addendum
2. ✅ Written release (consent screen) — described in Section 4, but **implementation not verified**
3. ✅ No profit from biometric data — documented, no third-party sharing
4. ✅ Reasonable care in storage — encryption at rest in Supabase
5. ✅ No unauthorized disclosure — documented

**BLOCKING items:**
1. **Consent screen must be fully operational and tested before Illinois users can access Eagle AI.** The addendum describes what the screen will say, but implementation has not been verified by legal. Victor must confirm the consent flow is live and functional, not just designed.
2. **[REVIEW]** Illinois-specific BIPA contact email (bipa@spotter.golf) is placeholder — must be a real, monitored address.
3. **[REVIEW]** BIPA consent records must be retained (BIPA requires proof of consent). Confirm that the consent mechanism logs consent with timestamp and user ID.

---

## Overall Verdict

**NEEDS REVISION — Cannot ship drill outcome data collection for any users until the following BLOCKING items are resolved:**

| # | Regulation | Blocker | Owner |
|---|-----------|---------|-------|
| 1 | GDPR | Supabase DPA not verified for biometric data / EU SCC coverage | Victor Stone |
| 2 | CCPA | Privacy + deletion contact emails are placeholders, not operational | Victor Stone |
| 3 | BIPA | Illinois-specific consent flow not verified as live and functional | Victor Stone |
| 4 | ALL | `[REVIEW]` placeholders throughout must be completed before publication | Legal (external) |

---

## Required Updates

### Must complete before shipping:

1. **Supabase DPA verification (GDPR — BLOCKING)**
   - Confirm Supabase DPA explicitly covers GDPR Article 9 special category data (biometric-adjacent pose keypoints)
   - Confirm Standard Contractual Clauses are in place for any EU data transfers
   - Document: `EAGLE_AI_PRIVACY.md` Section 6.1 and 9.3

2. **Operational contact emails (BLOCKING)**
   - `privacy@spotter.golf` — must be a real, monitored inbox
   - `deletion@spotter.golf` — must be a real, monitored inbox (GDPR/CCPA/BIPA deletion requests)
   - `bipa@spotter.golf` — must be a real, monitored inbox (Illinois-specific BIPA requests)
   - Document: `EAGLE_AI_PRIVACY.md` Section 13 and `PRIVACY_POLICY.md` Section 14

3. **Illinois consent flow verification (BIPA — BLOCKING)**
   - Victor must confirm the Eagle AI consent screen is live and functional in the app
   - Consent must be logged with: user ID, timestamp, consent version, data categories covered
   - Illinois users must be geo-blocked from Eagle AI until consent flow is verified
   - Document: `EAGLE_AI_PRIVACY.md` Section 4 and 8.3

4. **Main Privacy Policy completion (publication prerequisite)**
   - Set effective date and last updated date
   - Complete CCPA "Categories of Personal Information" section
   - Complete retention periods for payment records, analytics, support correspondence
   - Add mailing address
   - Document: `PRIVACY_POLICY.md` throughout

### After resolution, I will re-review and upgrade status to APPROVED.

---

## Summary Assessment

The Eagle AI Privacy Addendum (`EAGLE_AI_PRIVACY.md`) is **substantively well-drafted** for a first-pass legal document. The GDPR legal basis, data subject rights framework, BIPA risk identification, and retention schedules are all correctly structured. This is far ahead of where most startups are at this stage.

However, "well-drafted" is not the same as "ready to ship." The three BLOCKING items above are not cosmetic — they represent direct regulatory exposure:
- **GDPR violation without verified DPA/SCC:** potential fines up to 4% of global annual revenue
- **BIPA violation without verified consent flow:** $1,000–$5,000 per affected Illinois user — a class action here could be existential for Spotter

Victor, get those three items resolved and bring them back to me. I'll sign off the same day.

— **Diana Prince**, Batcave Legal Validation & Compliance
