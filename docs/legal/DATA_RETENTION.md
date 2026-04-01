# Data Retention Policy — Eagle AI Coaching Data

**Document Type:** Data Retention Schedule — Eagle AI Golf Coaching Engine  
**Effective Date:** [TBD — to be set at launch]  
**Last Updated:** 2026-04-01  
**Applies To:** All Eagle AI coaching data collected, processed, and stored by Spotter, Inc.

> ⚠️ **For Batcave use — to be reviewed by legal counsel before deployment.**

---

## 1. Purpose

This policy defines how long Spotter retains Eagle AI coaching data, including swing videos, pose keypoints, coaching history, and drill outcomes. It implements the right-to-erasure requirements under GDPR, CCPA/CPRA, and BIPA, and supports Spotter's privacy-first approach to biometric-adjacent data.

---

## 2. Scope

This policy applies to all data generated or collected through Spotter's Eagle AI feature, including:

- Swing video recordings
- Pose keypoints and biomechanical data (EP-01, EP-02)
- Swing fault classifications (EP-03)
- AI-generated coaching output (tips, cues, drill recommendations)
- Coaching session history
- Drill library citations (EP-16)
- Practice plans (EP-17)
- Drill completion records

This policy supplements the main Spotter Privacy Policy (`docs/legal/PRIVACY_POLICY.md`) and the Eagle AI Privacy Addendum (`EAGLE_AI_PRIVACY.md`).

---

## 3. Retention Schedule

### 3.1 Data Categories and Retention Periods

| Data Category | Default Retention | User Control | Notes |
|---------------|------------------|--------------|-------|
| **Swing Video Files** | 90 days from capture date | Delete at any time via in-app flow | Raw video is deleted first; extracted frames retained separately per this schedule |
| **Pose Keypoints & Biomechanical Data** | 2 years from capture date | Delete at any time via in-app flow | Linked to swing video at time of capture |
| **Swing Fault Classifications** | 2 years from analysis date | Delete at any time via in-app flow | Linked to pose keypoints |
| **AI Coaching Output (Tips, Cues, Drills)** | 2 years from generation date | Delete at any time via in-app flow | User can delete specific coaching sessions |
| **Coaching Session History** | 2 years from session date | Delete at any time via in-app flow | Full session, not individual messages |
| **Drill Library Citations (EP-16)** | 2 years from reference date | Cannot be deleted individually | Citation references only; drill library is Spotter content |
| **Drill Completion Records** | 2 years from completion date | Delete at any time via in-app flow | Tracks which drills were completed |
| **Practice Plans (EP-17)** | 2 years from generation date | Delete at any time via in-app flow | Full plan, including any modifications |
| **Aggregated Anonymized Coaching Data** | Indefinite | Cannot be deleted | De-identified data used to improve Eagle AI engine; cannot be linked back to individual |
| **Eagle AI Verification Scores (V1–V5)** | 2 years from session date | Delete at any time via in-app flow | Internal quality data; deleted with session |

### 3.2 Rationale for Retention Periods

| Period | Rationale |
|--------|-----------|
| **90 days (video)** | Sufficient time for users to review and request analysis. Long enough for meaningful delayed feedback. Short enough to minimize biometric data exposure. |
| **2 years (coaching data)** | Aligns with standard fitness/training program cycles. Covers a full golf season. Long enough for meaningful progress tracking. Supports GDPR/CCPA compliance without indefinite retention of personal data. |
| **Indefinite (anonymized)** | Engine improvement benefits from longitudinal data; anonymization removes personal data linkage. Required to be retained per GDPR legitimate interest balancing test. |

---

## 4. User-Controlled Deletion

### 4.1 In-App Deletion Flow

Users may delete Eagle AI data at any time via:

```
Spotter App → Settings → Eagle AI → Delete My Swing Data
```

This flow allows users to:
- Delete individual swing videos
- Delete all pose keypoints and biomechanical data
- Delete all coaching history
- Delete all drill completion records

The deletion flow presents a clear summary of what will be deleted before confirmation.

### 4.2 Deletion Confirmation

Within 72 hours of a deletion request, Spotter will:
1. Confirm receipt of the deletion request
2. Initiate the deletion process
3. Provide an estimated completion timeframe

### 4.3 What Happens to Data After Deletion

When a user deletes Eagle AI data:
- **Swing video:** Permanently removed from Supabase storage; removal from any backups within 30 days
- **Pose keypoints:** Permanently removed from all active databases
- **Coaching history:** Permanently removed; session records deleted
- **Drill completions:** Permanently removed
- **Aggregated anonymized data:** Not affected (no individual can be identified from it)

---

## 5. Automatic Deletion Schedules

### 5.1 Swing Video — 90-Day Auto-Delete

Swing video files are automatically flagged for deletion 90 days after capture. The deletion is executed by an automated background process.

**Before auto-deletion:**
- Users receive a notification at 30 days and 7 days before deletion
- Users may download their swing videos before deletion (via in-app export)
- Users may explicitly extend retention up to 1 year if desired (premium feature consideration)

**Grace period:** Deleted swing videos that have associated pending coaching sessions are retained until the session is closed, with a maximum 30-day grace period beyond the 90-day window.

### 5.2 Coaching Data — 2-Year Auto-Delete

Coaching output, session history, and drill completion records are automatically flagged for deletion 2 years after creation.

**No automatic notification is required** for data deleted under the 2-year schedule, as this is within the maximum retention period and does not require user action.

### 5.3 Aggregated Anonymized Data — No Auto-Delete

Aggregated anonymized coaching data is never automatically deleted, as it is no longer linked to individual users and cannot be used to identify any specific person.

---

## 6. Account Deletion — Full Data Purge

### 6.1 Trigger

When a user's Spotter account is deleted (via account deletion flow, subscription cancellation, or inactivity termination per Spotter's account lifecycle policy), all Eagle AI data associated with that account is subject to deletion.

### 6.2 Deletion Timeline

Upon account deletion:
- **Immediate:** Eagle AI access is revoked; no new data collected
- **Within 72 hours:** Deletion request confirmed to user
- **Within 30 days:** Full purge of all Eagle AI personal data from all systems, including:
  - Swing videos
  - Pose keypoints and biomechanical data
  - All coaching history and session data
  - Drill completion records
  - Any data in backups (via backup rotation cycle)

### 6.3 Exceptions

- **Aggregated anonymized data:** Retained indefinitely (de-identified, no individual linkage)
- **Legal holds:** Data subject to a legal hold (e.g., pending litigation, regulatory investigation) will be retained until the hold is released, even if account deletion is requested
- **Financial records:** Eagle AI transaction records (if applicable) retained per applicable financial record retention laws

### 6.4 Account Deletion vs. Eagle AI Deactivation

| Action | Effect on Eagle AI Data |
|--------|------------------------|
| User disables Eagle AI (retains Spotter account) | Eagle AI data retained per normal schedule; user can still delete manually |
| User deletes Spotter account | Full data purge within 30 days per above schedule |
| Spotter terminates service | All user data purged within 90 days of service termination |

---

## 7. Data Minimization Principles

Spotter applies the following data minimization principles to Eagle AI:

1. **Collection minimization:** Only collect pose keypoints necessary for the specific coaching analysis requested; do not collect full video if a brief clip suffices
2. **Processing minimization:** Video frames are processed and then discarded; only derived keypoints and fault data are retained long-term
3. **Retention minimization:** Default retention periods are set to the minimum necessary to fulfill the coaching purpose; users may request deletion earlier
4. **Aggregation:** Raw personal data is aggregated into anonymized statistical datasets for engine improvement; individual data is deleted per schedule

---

## 8. Data Storage and Security

All Eagle AI coaching data is stored in Supabase (Spotter's primary database) with the following security controls:

| Control | Implementation |
|---------|---------------|
| Encryption at rest | AES-256 encryption on all Supabase storage |
| Encryption in transit | TLS 1.2+ for all data transmission |
| Access controls | Role-based access; Eagle AI data accessible only to Spotter backend services |
| Audit logging | All data access and deletion events logged |
| Backup retention | Supabase backup retention: 7 days (deletion from backups within 30 days of user deletion request) |
| Incident response | Data breach notification per GDPR Art. 33 (72 hours to supervisory authority) and Art. 34 (to data subjects without undue delay) |

---

## 9. Cross-Border Data Transfer

Eagle AI coaching data (swing videos, pose keypoints, coaching history) is processed and stored in Supabase, which may involve data transfer outside the user's home country.

For EU/EEA users: Data transfers outside the EEA are covered by:
- Supabase Data Processing Agreement (DPA) with GDPR-compliant terms
- Standard Contractual Clauses (SCCs) where required

For Illinois users: BIPA data (pose keypoints as biometric identifiers) is stored on US-based Supabase infrastructure only.

---

## 10. Compliance Mappings

| Regulation | Requirement | Eagle AI Retention Implementation |
|------------|-------------|----------------------------------|
| **GDPR (EU)** | Lawfulness, purpose limitation, data minimization, right to erasure (Art. 17) | Per this policy; erasure requests honored within 30 days |
| **CCPA/CPRA (California)** | Right to delete, right to know, sensitive personal information limits | Per this policy; deletion requests honored within 15 days (CCPA) |
| **BIPA (Illinois)** | No profit from biometric data; proper storage; no unauthorized disclosure | Pose keypoints treated as biometric data; no sale/sharing; secure storage |
| **COPPA (US)** | No collection from under-13 without parental consent | Eagle AI not available to under-13; age verification at onboarding |

---

## 11. Review and Updates

This Data Retention Policy will be reviewed:
- At least annually
- Upon material changes to Eagle AI data collection or processing
- Upon material changes to applicable law (GDPR, CCPA, BIPA)
- Upon any data breach involving Eagle AI data

Material changes will be communicated to users via in-app notification and email.

---

## 12. Contact

For questions about Eagle AI data retention or to submit a deletion request:

- **Email:** [REVIEW: privacy@spotter.golf]
- **Deletion Requests:** [REVIEW: deletion@spotter.golf]
- **In-App:** Settings → Eagle AI → Delete My Swing Data

For the Eagle AI Privacy Addendum: `EAGLE_AI_PRIVACY.md`  
For the Eagle AI Terms of Service: `EAGLE_AI_TERMS.md`  
For the main Spotter Privacy Policy: `docs/legal/PRIVACY_POLICY.md`

---

*This document was prepared by Batcave Legal (internal) and requires review by a licensed attorney before deployment. Spotter, Inc. is not a law firm and this document does not constitute legal advice. ⚠️ For Batcave use — to be reviewed by legal counsel before deployment.*
