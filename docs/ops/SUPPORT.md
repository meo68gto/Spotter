# Spotter Support Operations Runbook

**Document type:** Operations / Support infrastructure  
**Project:** Spotter Golf  
**Author:** Fox (for Diana — Legal Division)  
**Date:** 2026-03-24  
**Status:** ❌ INCOMPLETE — `support@spotter.golf` does not yet exist  

---

## 1. Purpose

This document defines the support infrastructure, workflows, and SLAs for Spotter Golf. It ensures the support email (`support@spotter.golf`) referenced in all legal documents is functional before launch.

**Legal relevance:**
- Terms of Service §3.5, §5.4, §5.8, §8.1, §10.4, §10.5, §12
- Privacy Policy §2.4, §5.2, §5.3, §5.4, §5.5
- Cookie Policy §3.3, §4.3, §5.4
- GDPR Article 30 response obligations
- CCPA 45-day response window for California residents

**A non-functional support inbox creates legal and regulatory exposure.** All legal docs point users to it for appeals, charge disputes, deletion requests, and data rights.

---

## 2. Required Email Addresses

| Email | Purpose | Legal References |
|---|---|---|
| `support@spotter.golf` | General support, appeals, charge disputes, account issues | TOS §3.5, §5.4, §5.8, §8.1, §10.4, §10.5, §12 |
| `privacy@spotter.golf` | GDPR/CCPA data rights requests (access, deletion, portability) | Privacy §5.3, §5.4, §5.5, §10 |
| `legal@spotter.golf` | Arbitration opt-outs, legal notices, litigation hold | TOS §10.5, §10.6 |

> **Priority:** `support@spotter.golf` is the minimum required for launch. `privacy@spotter.golf` is required if serving EU or California users. `legal@spotter.golf` can be a forwarding rule to `support@spotter.golf` for v1.

---

## 3. Setup Instructions

### Option A — Google Workspace / Workspace Individual (Recommended)

1. Register `spotter.golf` domain (not yet done — see Diana's ship research)
2. In Google Admin Console → Apps → Google Workspace → Gmail → Route → Add routing rule
3. Create the following aliases:
   - `support@spotter.golf` → monitored by on-call engineer or dedicated support inbox
   - `privacy@spotter.golf` → monitored by privacy/compliance owner
   - `legal@spotter.golf` → forwarded to legal counsel
4. Set up ** Gmail filters** to auto-label and route incoming tickets

### Option B — Resend (Already in Stack)

Resend is already wired in the Spotter infrastructure for transactional email. Resend also supports **inbound email routing** (Enterprise plan) or can be used with **Resend + Zapier** for support ticketing:

1. Verify `support@spotter.golf` is verified in Resend (Resend dashboard → DNS)
2. Use Resend's inbound email webhook to forward support emails to a ticketing system
3. Connect to:
   - **Zapier** → **Help Scout** (help desk)
   - **Zapier** → **Linear** (for engineering bugs/issues)
   - **Zapier** → **Slack** `#support` channel

### Option C — FastMail / FastMail + FastMail Rules

If Google Workspace is not set up, FastMail at `fastmail.com` supports custom domain email hosting with powerful filtering and sieve rules.

---

## 4. Support Workflow

### Tier 1 — Automated / Self-Service (Launch Target: T-0)

| Issue Type | Automation | Tool |
|---|---|---|
| "Reset my password" | Supabase Auth magic link | Built-in |
| "Cancel my subscription" | Stripe Customer Portal | Built-in Stripe |
| "Delete my account" | Account deletion flow in app | App UI |
| "Request my data export" | GDPR/CCPA export pipeline | See `docs/ops/deletion-workflow.md` |
| "I didn't receive verification email" | Resend delivery check | Resend logs |

### Tier 2 — Human Support (Launch Target: T-0)

When automated resolution is not available, human agents handle:

| Issue Type | SLA | Owner | Tool |
|---|---|---|---|
| Account access issues | 24 hours | On-call engineer | Resend → Slack `#support` |
| Charge disputes | 14 days (TOS §5.8) | Finance/Bruce | Resend → Help Scout |
| Trust violation appeals | 14 days (TOS §3.5) | Trust & Safety | Resend → Linear |
| Incident reports | 48 hours acknowledgment | Trust & Safety | Resend → Linear |
| GDPR/CCPA data rights | 30 days (GDPR) / 45 days (CCPA) | Privacy owner | Resend → Help Scout |
| Legal notices | 5 business days | Legal counsel | `legal@spotter.golf` |
| Bug reports | 48 hours acknowledgment | Engineering | Resend → GitHub issue |

---

## 5. SLA Matrix

| Request Type | First Response | Resolution Target | Legal Requirement |
|---|---|---|---|
| General support | 24 hours | 5 business days | None (operational) |
| Charge disputes | 14 days | 30 days | TOS §5.8 |
| Trust violation appeal | 14 days | 30 days | TOS §3.5 |
| Incident reports | 48 hours | 14 days | TOS §2.3(e) |
| GDPR data access request | 30 days | 30 days | GDPR Art. 12 |
| GDPR erasure request | 30 days | 30 days | GDPR Art. 17 |
| CCPA data access request | 45 days | 45 days | CCPA §1798.130 |
| Security breach notification | 72 hours | N/A | GDPR Art. 33, California CPPA |
| Legal notices | 5 business days | Per statute | Per applicable law |

---

## 6. On-Call Rotation

Until a dedicated support team exists, an on-call rotation handles support escalations:

**Recommended rotation (placeholder — assign before launch):**
- Primary: Bruce (weekdays)
- Secondary: TBD
- Escalation: TBD

**On-call tools:**
- **Resend** inbound email → Slack `#support`
- **Linear** for issue tracking
- **Sentry** alerts → PagerDuty or Slack `#alerts`

---

## 7. Support Ticket Categorization

All support emails must be categorized at intake:

| Category | Priority | Linear Team | Description |
|---|---|---|---|
| `billing` | P2 | Finance | Charge disputes, refund requests, subscription issues |
| `account` | P2 | Engineering | Access issues, password reset, 2FA problems |
| `trust-violation` | P2 | Trust & Safety | Appeals of trust violations, no-show disputes |
| `incident-report` | P1 | Trust & Safety | Harassment, misconduct, safety concerns |
| `gdpr-ccpa` | P1 | Compliance | Data access, erasure, portability, opt-out requests |
| `legal` | P0 | Legal | Litigation hold, subpoena, arbitration opt-out |
| `bug` | P3 | Engineering | App bug, crash, broken feature |
| `feature-request` | P4 | Product | New feature ideas (not a legal risk) |

---

## 8. Data Retention for Support Communications

Per Privacy Policy §5.2, support communications are retained for **3 years** from last communication. This must be enforced:
- Help Scout: Set retention policy in workspace settings
- Resend: Export/archive old threads manually or via automation
- Linear: Archive resolved tickets after 3 years

---

## 9. Pre-Launch Checklist

- [ ] `support@spotter.golf` inbox created and verified
- [ ] `privacy@spotter.golf` inbox created (or forwarding rule to support)
- [ ] `legal@spotter.golf` inbox created (or forwarding rule)
- [ ] DNS MX records updated for `spotter.golf` domain
- [ ] Support workflow documented in Resend or Help Scout
- [ ] On-call rotation assigned (primary + secondary)
- [ ] SLA matrix communicated to on-call team
- [ ] Ticket categorization labels created in help desk tool
- [ ] GDPR/CCPA data rights workflow tested
- [ ] Account deletion workflow tested (end-to-end)
- [ ] Data export workflow tested (GDPR portability)
- [ ] Breach notification runbook tested (72-hour requirement)

---

## 10. Key Legal Dependencies

| Legal Doc Section | Support Obligation |
|---|---|
| TOS §3.5 | Appeals for trust violations → 14-day response SLA |
| TOS §5.4 | Cancellation requests → process within billing period |
| TOS §5.8 | Charge disputes → 60-day window to contact, 30-day resolution |
| TOS §8.1 | Account deletion → 30-day processing window |
| TOS §10.4 | Informal dispute resolution → 30-day attempt before arbitration |
| Privacy §5.3 (GDPR) | Data access/erasure → 30-day response |
| Privacy §5.4 (CCPA) | Data access/deletion → 45-day response |
| Privacy §7.3 | Security breach → 72-hour notification |

**Failure to meet these SLAs creates regulatory and litigation exposure.** Do not launch without support infrastructure in place.

---

*Fox for Diana | Legal Division | Batcave Command Center | 2026-03-24*
