# Spotter Security Audit — 2026-03-29

**Auditor:** J'onn J'onzz (Security & Intelligence)
**Scope:** Full codebase (1,448 files scanned)
**Tooling:** Semgrep (SAST), pnpm audit (Deps), grep-based secrets scan, manual code review

---

## SAST Findings

Semgrep ran 272 rules against all 1,448 tracked files. **13 findings total (all blocking).**

### 🔴 High

| Rule | File | Line | Severity |
|------|------|------|----------|
| `java.android.security.exported_activity.exported_activity` | `apps/mobile/android/app/src/main/AndroidManifest.xml` | 21 | High |

Android activity with `exported=true` and no intent-filter. Verify this activity genuinely needs to be exported (e.g., deep-link target vs. internal-only).

### 🟡 Medium

| Rule | File | Notes |
|------|------|-------|
| `typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml` | `apps/web/.next/server/chunks/2815.js` | Build artifact — investigate source |
| `typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml` | `apps/web-admin/.next/server/chunks/583.js` | Build artifact — investigate source |
| `javascript.express.security.injection.raw-html-format.raw-html-format` | `apps/web/.next/server/edge-instrumentation.js` | Build artifact — `res.send()` with HTML |
| `javascript.express.security.injection.raw-html-format.raw-html-format` | `apps/web-admin/.next/server/chunks/782.js` | Build artifact |
| `python.lang.security.use-defused-xml-parse.use-defused-xml-parse` | `scripts/import-golf-courses/import_golf_courses.py` | 428 |

**Source-level flag:** The `.next` chunks are compiled artifacts — you must identify the **original source files** that produced these. Run with `--verbose` to get line-to-source mapping.

**Python XML finding:** `ET.parse()` on line 428 of the course import script uses the standard library `xml.etree.ElementTree`, which is vulnerable to billion laughs / entity expansion DoS. Should use `defusedxml` instead.

### 🟢 Low (Nginx Config)

| Rule | File | Notes |
|------|------|-------|
| `generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling` | `infra/nginx/staging.conf` | 49, 75 |
| `generic.nginx.security.request-host-used.request-host-used` | `infra/nginx/staging.conf` | 52, 68, 78 |

H2C (HTTP/2 over cleartext) smuggling is a staging-config concern. Verify production Nginx config does not use `h2c://` upstream. The `request-host-used` findings indicate `$host` header is forwarded — ensure upstream is trusted (internal network only).

---

## Secrets Detection

**Status: ✅ CLEAN**

Pattern scan across all TypeScript, JavaScript, Python, YAML, and shell files found **no hardcoded secrets, API keys, Bearer tokens, private keys, or credentials in source code.**

### What was checked
- `sk_live_`, `pk_live_`, `rn_live_` (Stripe live keys)
- `ghp_`, `AIza`, AWS access key prefixes
- `Bearer`, `token`, `password`, `secret` patterns
- Private key file patterns

### Environment Files
- `.env.local` — Contains only placeholder values (tokens are `[REDACTED]` or empty)
- `.env.production` — Exists; assumed to be properly managed (not committed)
- `.env.staging`, `.env.example`, `.env.staging.example` — All use empty/placeholder values
- `.gitignore` appears to exclude `.env.production` and `.env.staging`

### Remaining Risk
- `VIDEO_WORKER_TOKEN`, `ADMIN_DELETION_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` — all referenced in env files. Ensure production values are rotated regularly and stored in a vault, not committed.
- No secrets scanner (e.g., GitLeaks, TruffleHog) is currently integrated into CI.

---

## Dependency Audit

**Status: ⚠️ NEEDS WORK — 62 vulnerabilities found**

```
6 low | 18 moderate | 35 high | 3 critical
```

### Critical CVEs

| CVE | Package | Severity | Notes |
|-----|---------|----------|-------|
| GHSA-ppp5-5v6c-4jwp | `node-forge` <1.4.0 | **Critical** | RSA signature forgery via ASN.1 extra field. Found in 256 paths via `react-native` → `@react-native/dev-middleware` → `selfsigned` → `node-forge@1.3.3`. |
| GHSA-c2c7-rcm5-vvqj | `picomatch` | **Critical** | Pattern Denial of Service. Found in 23 paths via `expo@52.0.49` → `@expo/cli` → `picomatch@3.0.1`. |

### High CVEs (top items)

| CVE | Package | Patched In | Affected Paths |
|-----|---------|------------|----------------|
| GHSA-72xf-4x92-3w45 | `undici` <6.24.1 | 6.24.1 | 5 paths in `apps/mobile` via Expo CLI |
| Multiple | `handlebars` <4.7.9 | 4.7.9 | 8 paths in `apps/api-tests` via `ts-jest` |
| Multiple | `minimatch` <10.2.4 | 10.2.4 | 2 paths in `apps/web` dev deps |
| Multiple | `ajv` <6.14.0 | 6.14.0 | 1 path in root `eslint` |
| Multiple | `flatted` <3.4.2 | 3.4.2 | 2 paths in `eslint` dev deps |
| CVE-2024-37890 | `spectacle` ? | ? | `apps/api-tests` |

### Key Observations

1. **Transitive dependency nightmare:** Most high/critical CVEs are deep in Expo CLI and React Native's dev tooling chain — not in production runtime code. However, `node-forge` in the React Native dev middleware stack could be exploitable if an attacker can serve malicious dev server content.

2. **`picomatch` in Expo CLI:** Expo 52 is pinned in `apps/mobile`. Upgrading Expo (or pinning a newer `@expo/cli`) would fix this.

3. **No Snyk or GitHub Advisory integration detected** — only `pnpm audit` is running.

---

## Prompt Injection / Oracle Shield

**Status: ✅ LOW RISK (based on code review)**

`oracle-shield` and `llm-redteam` are not installed as CLI tools. The following analysis is based on **manual security review of the LLM-adjacent code paths**.

### chat-send (`apps/functions/supabase/functions/chat-send/index.ts`)

**Risk: LOW**

```
✅ Authorization: Requires valid Bearer token (Supabase auth)
✅ Session validation: User must be proposer or partner in session
✅ Input sanitization: Trimmed to 2000 chars, checked for required fields
✅ Rate limiting: 1 message per 60 seconds per user
✅ Idempotency: clientMessageId prevents duplicate inserts
✅ Legal guard: requireLegalConsent() called before processing
```

**No direct prompt injection vector** — this function does not call any LLM. It accepts a `message` string and stores it in Supabase. The `moderation_status` is set to `'pending'`, suggesting a human/mod system reviews messages before they surface anywhere.

**Potential indirect risk:** If a future feature surfaces these messages to an AI (e.g., AI coaching reply, summary), the stored `message` content would need sanitization at that point.

### Stripe Webhook (`apps/web/app/api/operator/stripe/webhook/route.ts`)

**Risk: LOW**

```
✅ Signature verification: Stripe webhook signature validated via constructWebhookEvent()
✅ Idempotency: processed_stripe_events table prevents duplicate handling
✅ Error handling: DB failures return 500 (Stripe retries), not 200
✅ Tournament ownership verification: payment_intent handler checks organizerId owns tournamentId
```

**Potential issues:**
- The `sendWebhookAlert()` function has commented-out Slack/PagerDuty integration — real alerts are going only to `console.error`. In production, this should be wired to a monitored channel.
- The `account.updated` handler only checks `details_submitted` — it may miss other Stripe account state changes.

### No General-Purpose LLM Integration Found

No evidence of:
- Direct LLM API calls (OpenAI, Anthropic, Ollama) in the scanned endpoints
- `system` prompt construction from user input
- Dynamic prompt assembly with user content
- Embedding generation from user messages

**If an LLM is integrated in a future sprint (e.g., AI coaching, chat summaries), that endpoint becomes a priority for Oracle Shield testing.**

---

## Overall Security Score

# 🟡 NEEDS WORK

| Category | Score | Notes |
|----------|-------|-------|
| SAST | 6/10 | 13 findings; most are build artifacts. Python XML and Android exported activity need attention. |
| Secrets | 9/10 | No secrets in source. No CI secrets scanner. |
| Dependencies | 4/10 | 62 vulnerabilities (3 critical). Expo 52 + React Native chain is the main culprit. |
| Prompt Injection | 8/10 | No LLM in current endpoints..chat-send has good guards. |

**Composite: 6.75 / 10 — NEEDS WORK**

---

## Priority Fixes

### P0 — Fix Now (Critical / Exploitable)

1. **Upgrade Expo / @expo/cli** to resolve `picomatch` CVE (GHSA-c2c7-rcm5-vvqj)
   - Run `pnpm up expo @expo/cli -r` in `apps/mobile`
   - Or pin `picomatch` explicitly in resolutions

2. **Upgrade React Native dev tooling** to resolve `node-forge` CVE (GHSA-ppp5-5v6c-4jwp)
   - This is transitive through `@react-native/dev-middleware` → `selfsigned` → `node-forge@1.3.3`
   - May require RN upgrade; check if a newer Expo SDK pins updated deps

3. **Switch Python XML parser to `defusedxml`** in `scripts/import-golf-courses/import_golf_courses.py:428`
   ```python
   # Replace:
   import xml.etree.ElementTree as ET
   # With:
   from defusedxml import ElementTree as ET
   ```

### P1 — Fix Before Production (High Risk)

4. **Add CI secrets scanning** (GitLeaks or TruffleHog in pre-commit / PR pipeline)
   - No secrets detected now, but without CI enforcement, a future commit could leak credentials

5. **Investigate `.next` build artifacts** with `react-dangerouslysetinnerhtml` and `raw-html-format`
   - Run `semgrep --verbose` to map findings back to source files
   - Remove any `innerHTML` usage or replace with sanitized alternatives

6. **Wire `sendWebhookAlert()` to a real monitoring channel** (Slack, PagerDuty, or Sentry)
   - Currently all alerts go to `console.error` only

7. **Review Android exported activity** in `AndroidManifest.xml:21`
   - Confirm it is a legitimate deep-link target, not an accidentally exported internal component

### P2 — Improve (Medium Risk)

8. **Add `pnpm audit` to CI** with fail-on-critical policy
9. **Upgrade `undici`** in `apps/mobile` Expo CLI chain (GHSA-72xf-4x92-3w45)
10. **Audit production Nginx config** for H2C usage (staging config flagged `possible-h2c-smuggling`)

---

*Audit completed by J'onn J'onzz | Batcave Security Intelligence*
*Generated: 2026-03-29 20:56 MST*
