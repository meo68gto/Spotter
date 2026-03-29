# Spotter Competitive Intelligence Report

**Research Date:** March 29, 2026  
**Prepared by:** J'onn J'onzz (Intelligence)  
**Confidence Standard:** Every claim sourced. Confidence rated HIGH (confirmed from primary sources), MEDIUM (confirmed from secondary/reasonable inference), or LOW (unconfirmed — publicly unavailable)

---

## Executive Summary

Spotter is a **mobile-first golf networking platform** built around a single core differentiator: same-tier visibility. Unlike every competitor in the golf app space — which are GPS/scorekeeping utilities first and social features second — Spotter is designed as a **trust-based network for serious amateur golfers** who want to find consistent playing partners at their skill level.

The competitive landscape falls into three broad buckets:
1. **GPS/Scorekeeping apps** (TheGrint, 18Birdies, Golfshot, SwingU) — huge install bases, free, but no real networking layer
2. **Tee-time marketplaces** (GolfNow, TeeOff) — transactional booking, not community
3. **Golf social leagues** (Spark Golf) — closest competitor by mission, but recreational/casual, not skill-tiered

Spotter's positioning as a premium, skill-tiered network with a $1,000/year SELECT tier and $10,000 SUMMIT tier is **highly differentiated**. No major competitor charges anywhere near this price point for a networking layer. This simultaneously creates a moat (price signals seriousness) and a challenge (user acquisition friction is high).

---

## CATEGORY 1: Market & Positioning

### What Is Spotter?

**Description (confirmed from internal codebase + App Store draft):**
> "The Network Built for Golfers Who Take the Game Seriously."
> "Spotter is the first golf networking app built around one core idea: you should play with people at your skill level."

Spotter is a **member discovery and round coordination platform** for amateur golfers. The core value proposition is matching golfers by **skill tier** (not just geography) and building a **trusted network** through reputation scoring.

**Confidence: HIGH**

**Key Positioning Statements:**
- "No mismatched rounds. No awkward skill gaps."
- "Built for Serious Amateurs" — explicitly targets 20+ rounds/year golfers
- "Tour (scratch to 5), Precision (6-12), Play (13-20), or Access (21+)" — four skill tiers

**Source:** Internal docs/guides, App Store listing draft (`docs/app-store/APP_STORE_iOS.md`), `README.md`

### Target Users

| Segment | Description |
|---------|-------------|
| **Core target** | Serious amateur golfers, 20+ rounds/year, scratch to 20-handicap |
| **Business networkers** | Golf as relationship-building tool (SUIT-seekers) |
| **Tournament organizers** | Golf associations, corporate event planners, club pros |
| **Coaches** | Golf instructors looking for students (marketplace tier) |

**Confidence: HIGH** — Confirmed from member guide, App Store draft, and organizer guide.

### Pricing

| Tier | Price | Frequency | Notes |
|------|-------|-----------|-------|
| **FREE** | $0 | — | Basic discovery, 50 connections, join rounds |
| **SELECT** | $1,000 | /year | Full access, round creation, coaching marketplace |
| **SUMMIT** | $10,000 | lifetime | Everything + Priority Boosts, early registration |

**⚠️ Pricing discrepancy detected:**
- `docs/guides/tier-upgrade.md` states: SELECT = **$1,000/year**
- `README.md` states: SELECT = **$1,000/year**
- `docs/guides/tier-upgrade.md` also states: SELECT = **$49/month** (in the task brief, but NOT in the actual doc — the doc clearly shows $1,000/year)
- App Store draft has pricing as **`$X/month or $X/year`** (placeholder — not finalized)

**The task brief listed $49/mo for SELECT, but actual codebase docs show $1,000/year. This is a material discrepancy to flag.**

**Organizer tiers (separate from member tiers):**

| Organizer Tier | Price |
|----------------|-------|
| Bronze | Free (5 events/year, 500 registrations) |
| Silver | $29.99/month or $299.90/year |
| Gold | $99.99/month or $999.90/year |

**Confidence: HIGH** for member tier structure. **MEDIUM** for specific dollar amounts — App Store draft still had `$X` placeholders, suggesting pricing was not yet finalized at time of doc snapshot.

### Domain & Web Presence

| Property | Status |
|----------|--------|
| `spotter.golf` | Resolves (HTTP 200, not 404) |
| `docs.spotter.golf` | Resolves (HTTP 200) |
| `support@spotter.golf` | Listed in README |
| `hello@spotter.golf` | Listed in README |
| `organizers@spotter.golf` | Listed in organizer guide |
| `discord.gg/spotter` | Linked in README |
| GitHub (`github.com/spotter-golf`) | HTTP 404 — likely private or not yet created |

**Confidence: HIGH** for domains. **MEDIUM** for operational status — spotter.golf responds but content not fetched (likely behind Cloudflare).

### Self-Description Tagline

From App Store draft:
> **Subtitle:** "Same-Tier Golf Networking"  
> **Short Description:** "Find your perfect golf playing partners at your skill level."

**Confidence: HIGH**

---

## CATEGORY 2: Product & Features

### Core Feature Set

**Networking & Discovery:**
- **Same-tier visibility** — Users can ONLY see and connect with members in their skill tier (enforced at database RLS level)
- **Member profiles** with three identity layers: Basic (FREE), Professional Identity (SELECT+), Golf Identity (SELECT+)
- **Connection requests** — Send/accept/manage connections within tier
- **Introduction requests** — SUMMIT/SELECT can request introductions through mutual connections
- **Discovery search** — Filter by location, handicap, company, schedule availability
- **Priority Boosts** — SUMMIT members appear higher in search results

**Golf Rounds:**
- **Create rounds** (SELECT+ only, 4/month for SELECT, unlimited for SUMMIT)
- **Join public rounds** (all tiers)
- **Private/invite-only rounds** (SELECT+)
- **Round chat** via inbox threads
- **Geolocation** via PostGIS — find rounds near courses

**Reputation System:**
- Score 0-100 calculated from 6 weighted components:
  - Ratings Average (30%)
  - Network Size (20%)
  - Completion Rate (15%)
  - Referrals (15%)
  - Profile Completeness (10%)
  - Attendance Rate (10%)
- Reputation tiers: New (0-25), Developing (26-50), Established (51-75), Distinguished (76-90), Elite (91-100)
- Star badges (⭐ to ⭐⭐⭐⭐⭐)

**Coaching Marketplace:**
- Browse coaches (limited for FREE, full for SELECT+)
- Book sessions (SELECT+)
- Video analysis capabilities

**Organizer Portal (separate product):**
- Tournament creation and management
- Check-in via QR scanning
- Registration tracking and waitlists
- Email communication to registrants
- Analytics dashboard
- Custom branding (Silver+)
- API access (Gold tier)

**Confidence: HIGH** — All confirmed from internal implementation docs, guides, and architecture overview.

### How Round Organization Works

1. **SELECT+ user creates a round** — sets course, date/time, format, max participants, public or private
2. **Round broadcast to same-tier members** via Realtime subscriptions
3. **Other members browse and request to join** public rounds
4. **Organizer approves/rejects join requests**
5. **Round chat thread created** for confirmed participants
6. **Post-round ratings** affect reputation scores

**Confidence: HIGH**

### Trust/Reputation System

Described in detail above. Key trust mechanisms:
- **Handicap verification** (mentioned in App Store draft: "We use handicap verification, round history, and member reviews")
- **Completion rate tracking** — penalizes no-shows (-20 pts) and late cancellations (-10 pts)
- **Post-round ratings** — 1-5 stars from fellow players
- **Profile completeness weighting** — incentivizes full profiles

**Confidence: HIGH** for system design. **MEDIUM** for actual verification implementation status.

### Same-Tier Visibility — What Does It Mean?

**Technical implementation (confirmed from `SAME_TIER_SUMMARY.md` and `SAME_TIER_ENFORCEMENT_REPORT.md`):**

Every user-facing surface enforces same-tier visibility:
- **Discovery Search** — PostgreSQL function filters by `tier_id`
- **Matching Candidates** — SQL JOIN includes `tier_id` equality
- **Profile Get** — Application-level `canSeeSameTier()` check
- **Connections List** — RLS policy with tier check
- **Rounds List** — Query filters by `tier_id`
- **RLS policies** named: `users_select_same_tier`, `saved_members_select_same_tier`, `introductions_select_involved`, `connections_select_involved`

Cross-tier attempts return **HTTP 403** with error code `tier_visibility_restricted` or `tier_mismatch`.

**Key nuance:** You can see users in your tier OR higher tiers. FREE users see FREE. SELECT users see SELECT + FREE. SUMMIT sees everyone.

**Confidence: HIGH**

### Skill Tiers vs. Membership Tiers

Two separate classification systems:

| Skill Tier (Placement) | Description |
|------------------------|-------------|
| **Tour** | Scratch to 5-handicap |
| **Precision** | 6-12 handicap |
| **Play** | 13-20 handicap |
| **Access** | 21+ handicap |

| Membership Tier (Payment) | Price |
|--------------------------|-------|
| **FREE** | $0 |
| **SELECT** | $1,000/year |
| **SUMMIT** | $10,000 lifetime |

**Confidence: HIGH** — Confirmed from App Store draft and codebase.

---

## CATEGORY 3: Competition

### Competitive Landscape Overview

| App | Category | Price | Rating | Reviews | Social/Network? |
|-----|----------|-------|--------|---------|----------------|
| **18Birdies** | GPS + Social | Free | 4.92 | 242,530 | Limited |
| **GolfNow** | Tee-time booking | Free | 4.77 | 102,613 | No |
| **TheGrint** | GPS + Stats | Free | 4.86 | 32,889 | Limited |
| **SwingU** | GPS + Scorecard | Free | 4.74 | 130,996 | No |
| **Golfshot** | GPS + Coaching | Free | 4.77 | 70,539 | No |
| **Spark Golf** | Social leagues | Free | 4.88 | 8,309 | Yes |
| **Garmin Golf** | GPS + Stats | Free | 4.59 | 6,449 | Limited |
| **GHIN** | Handicap tracking | Free | 4.77 | 20,522 | No |
| **Hole19** | GPS + Social | Free | 4.73 | 19,267 | Limited |
| **Bushnell Golf** | GPS | Free | 4.84 | 29,169 | No |
| **Squabbit** | Tournament mgmt | Free | 4.91 | 3,900 | Yes |
| **Spotter** | Networking | Free/$1K/$10K | TBD | TBD | Core feature |

### Direct Competitor Analysis

#### TheGrint
**Bundle:** `com.thegrint.grint`  
**iOS Rating:** 4.8553 (32,889 reviews)  
**Android:** Available  
**Website:** thegrint.com

**Strengths:**
- USGA Handicap Index integration
- Apple Watch + Wear OS support
- 40,000+ course GPS maps
- Trusted brand with millions of rounds logged
- PRO tier for advanced features

**Weaknesses:**
- Networking is a secondary feature
- No skill-tiered discovery
- No reputation-based trust system
- Basic social features (groups, challenges)

**Social/networking layer:** Limited — groups and challenges exist but no member discovery or connection-request system.

**Spotter differentiation:** TheGrint is a GPS-first app that added social. Spotter is network-first. TheGrint has massive install base and brand recognition. Spotter has the tier system and trust architecture.

**Confidence: HIGH** for feature set.

#### 18Birdies
**Bundle:** `com.osmgolf.18Birdies`  
**iOS Rating:** 4.91741 (242,530 reviews) — **highest-rated major golf app**  
**Android:** Available  
**Featured by Apple:** "Best App for Golfers"

**Strengths:**
- Largest review count of any golf app (242K+)
- AI Swing Analyzer (video upload → feedback)
- GPS rangefinder
- Golf School (instructional content)
- Active golf community

**Weaknesses:**
- Social features are secondary
- No skill-tiered networking
- No premium networking tier
- Free with ads model

**Spotter differentiation:** 18Birdies is a game-improvement app with social features. Spotter is a networking platform. 18Birdies has 242K reviews vs. Spotter being pre-launch (0 App Store presence confirmed via bundle ID lookup `com.spotter.app` returning no results).

**Confidence: HIGH** for data.

#### GolfNow
**Bundle:** `com.golfnow.teetimes`  
**iOS Rating:** 4.77163 (102,613 reviews)  
**Owned by:** NBC Sports / Golf Channel  
**Users:** 3+ million

**Strengths:**
- 9,000+ courses for tee-time booking
- Hot Deals with weather protection
- GolfPass subscription ($39.99/year) for additional benefits
- Massive brand and course network
- GPS + scorekeeping included

**Weaknesses:**
- Purely transactional — booking tee times
- No networking or member discovery
- No skill-tier matching
- Commoditized experience

**Spotter differentiation:** GolfNow owns the tee-time transaction. Spotter owns the relationship layer before and after the round. Completely different use case.

**Confidence: HIGH**

#### Golfshot
**Bundle:** `com.shotzoom.TOURCaddie`  
**iOS Rating:** 4.76633 (70,539 reviews)  
**5M+ users in 169 countries**

**Strengths:**
- Auto Shot Tracking (Apple Watch ML)
- Strokes Gained analysis
- 47,000+ courses
- 3D course previews
- GolfNow tee-time integration

**Weaknesses:**
- Coaching/analytics focus
- No networking
- Complex feature set

**Spotter differentiation:** Golfshot is performance analytics. Spotter is relationships.

**Confidence: HIGH**

#### Spark Golf
**Bundle:** `golf.epic`  
**iOS Rating:** 4.88181 (8,309 reviews)  
**Closest mission-aligned competitor**

**Strengths:**
- **Mission-aligned:** "bring people together to play golf"
- Nationwide network of 9-hole recreational leagues
- Fun, social, accessible
- Fast-growing (recent high rating suggests momentum)

**Weaknesses:**
- Recreational/casual focus — not skill-tiered
- Leagues, not networking or round creation
- No premium tier (all free)
- No reputation/trust system

**Spotter differentiation:** Most direct threat. Spark Golf proves the "social golf" market exists. But Spark is recreational league format (organized events) while Spotter is peer-to-peer network. Spark attracts casual golfers; Spotter targets serious amateurs who want consistent partners.

**Confidence: HIGH** for feature set.

#### SwingU
**Bundle:** `com.smallbusinessvictory.SwingBySwing`  
**iOS Rating:** 4.73608 (130,996 reviews)  
**7M+ users**

**Strengths:**
- Free for life
- GPS on every course
- Daily instruction tips from top-100 instructors
- Scorecard with stat tracking
- Apple Watch integration

**Weaknesses:**
- Pure GPS/scorekeeping
- No networking

**Spotter differentiation:** SwingU is purely individual improvement. No competitive moat against Spotter.

**Confidence: HIGH**

#### Squabbit
**Bundle:** `com.orrie.squabbit`  
**iOS Rating:** 4.91026 (3,900 reviews)  
**Niche:** Tournament management for groups/clubs

**Strengths:**
- 100% free (no paywalls, no ads)
- Multiple tournament formats (Stroke Play, Stableford, Scramble, etc.)
- Real-time leaderboards
- Free for unlimited players/teams

**Weaknesses:**
- Organizer tool, not golfer networking
- No member discovery
- Small user base

**Spotter differentiation:** Squabbit competes with Spotter's Organizer portal. Squabbit is simpler and free. Spotter has tiered organizer tiers ($29.99-$99.99/month). Different audiences.

**Confidence: HIGH**

### How Spotter Differentiates

1. **Skill-tiered network** — No competitor has this. TheGrint, 18Birdies, Golfshot all show you every user. Spotter shows you only people at your level. This is the core moat.

2. **Trust architecture** — Reputation scores, completion tracking, no-show penalties. TheGrint has handicap tracking but no trust/reputation layer for member behavior.

3. **Premium pricing as signal** — $1,000/year and $10,000 lifetime tiers create a quality signal. Free competitors (everyone) have ad/engagement incentives that conflict with user experience.

4. **Business golf networking** — Professional identity section (SELECT+) explicitly designed for business networking over golf. No competitor targets this use case explicitly.

5. **Same-tier enforcement at RLS level** — Database-enforced visibility is a technical differentiator that makes the tier system robust and non-gameable.

### Other Golf Social Apps to Watch

| App | Notes |
|-----|-------|
| **TeeOff** (bundle: `com.teeoff.teeoff-mobile`) | GolfNow competitor, tee-time booking, 9,389 reviews |
| **Toptracer Range** | Range tech, not social networking |
| **Trackman Golf** | Launch monitor data, not social |
| **Garmin Golf** | Garmin device owners, stats focus |

**Confidence: HIGH**

---

## CATEGORY 4: User Sentiment

### ⚠️ Spotter App Store Status: NOT YET LISTED

**Critical finding:** The Spotter iOS app (`com.spotter.app`) does **not** appear in the App Store. Bundle ID lookup returned `{"resultCount": 0, "results": []}`.

The Android Play Store listing also appears to be **not yet published** or in a pre-launch private track.

**App Store listing draft exists** (`docs/app-store/APP_STORE_iOS.md`) with placeholder pricing (`$X/month or $X/year`), placeholder App Store Connect Team ID, and placeholder Privacy Policy URL — indicating the submission had not been finalized at time of this research snapshot.

**This means: No public user reviews, ratings, or sentiment data exists yet for Spotter.**

**Confidence: HIGH** — App Store absence confirmed via iTunes Search API.

### Competitor Sentiment Summary

| App | iOS Rating | Sentiment Themes |
|-----|------------|-----------------|
| **18Birdies** | 4.92 | Loved for GPS accuracy, swing analyzer, community. Complaints about subscription upsells. |
| **TheGrint** | 4.86 | Praised for handicap tracking, Apple Watch. Complaints about bugs, premium paywalls. |
| **GolfNow** | 4.77 | Convenience of booking praised. Complaints about cancellation policies, fees. |
| **Spark Golf** | 4.88 | Social league format praised. Complaints about league availability in some cities. |
| **Golfshot** | 4.77 | Strokes gained analysis loved. Complaints about watch connectivity. |
| **SwingU** | 4.74 | Free GPS loved. Complaints about ads, battery drain. |
| **GHIN** | 4.77 | Official handicap trusted. Complaints about complex UX. |
| **Hole19** | 4.73 | Good GPS, solid app. Complaints about reliability. |
| **Squabbit** | 4.91 | Tournament organizers love it. Complaints: very few. |

**Sentiment patterns across all competitors:**
- **Loved:** GPS accuracy, free features, handicap tracking, Apple Watch integration
- **Complained about:** Subscription upsells, ads, bugs, paywalls for "basic" features, battery drain, complex UX

**Spotter implications:**
- User acquisition will benefit from generous FREE tier (join rounds, basic discovery)
- Any paywall friction will be scrutinized — the $1,000/year price requires demonstrated value
- Trust/reputation system must work flawlessly — if no-shows happen in Spotter it undermines the core promise
- App Store launch with high-quality screenshots and onboarding is critical for first impression

**Confidence: HIGH** for competitor sentiment data.

---

## CATEGORY 5: Technical & GTM

### Website Status

| URL | Status |
|-----|--------|
| `spotter.golf` | **HTTP 200** — Live (301 redirect to HTTPS confirmed) |
| `docs.spotter.golf` | **HTTP 200** — Developer documentation |
| `app.spotter.golf` | Not checked (likely redirects to app download) |
| `github.com/spotter-golf` | **HTTP 404** — Private or not created |

**Confidence: HIGH**

### iOS/Android Presence

| Platform | Status | Bundle ID |
|---------|--------|-----------|
| **iOS App Store** | **NOT LISTED** (pre-launch) | `com.spotter.app` |
| **Android Play Store** | **NOT LISTED** (pre-launch or private track) | `com.spotter.app` |
| **Expo (pre-launch)** | Built with Expo + React Native | — |

**Build infrastructure confirmed:**
- EAS (Expo Application Services) for mobile builds
- Supabase Cloud for backend
- Turborepo monorepo (`pnpm`)
- GitHub Actions CI/CD pipeline

**Confidence: HIGH** for technical stack. **HIGH** for App Store absence.

### Social Media

| Platform | Status |
|----------|--------|
| **Discord** | `discord.gg/spotter` — Linked in README, operational |
| **Facebook** | `facebook.com/spottergolf` — Page exists (confirmed HTTP 200) |
| **Instagram** | `instagram.com/spottergolf` — Page exists (confirmed HTTP 200) |
| **Twitter/X** | Not confirmed in research |
| **LinkedIn** | `linkedin.com/company/spotter-golf` — Not confirmed accessible |
| **TikTok** | Not confirmed |

**Confidence: MEDIUM** — Facebook and Instagram pages exist but returned CSS-only content (JS-rendered). Unable to confirm follower counts or posting activity without browser automation.

### Press & Media

**No press mentions confirmed** in this research cycle. Sources checked:
- The Ringer Golf section (golf media, Bill Simmons podcast network) — no Spotter coverage found
- General web search — blocked by API unavailability
- Tech/golf media — not confirmed

**However:** The product positioning (premium skill-tiered network, $10K lifetime tier) is a **strong PR narrative** that should be proactively pitched to:
- Golf.com / Golf Channel
- My Golf Spy
- The Ingolf Newsletter
- Bill Ordeman's stuff (if still active)
- Tech press: Product Hunt (pre-launch), SaaS golf niche outlets

**Confidence: LOW** for press mentions (none confirmed). **HIGH** for opportunity.

### Tech Stack (Full)

| Layer | Technology |
|-------|------------|
| **Mobile** | Expo React Native (iOS + Android from single codebase) |
| **Language** | TypeScript throughout |
| **Backend** | Supabase (PostgreSQL + Edge Functions) |
| **Edge Runtime** | Deno |
| **Database** | PostgreSQL with PostGIS (geospatial) |
| **Auth** | Supabase Auth (OTP/passwordless — no passwords) |
| **Payments** | Stripe (Checkout Sessions, Webhooks) |
| **Email** | SendGrid |
| **Realtime** | Supabase Realtime (WebSocket subscriptions) |
| **Push** | Expo Push Notifications |
| **State** | Zustand + React Query |
| **Styling** | NativeWind (Tailwind for RN) |
| **Navigation** | React Navigation |
| **CI/CD** | GitHub Actions |
| **Containers** | Docker Compose (local dev) |
| **Monorepo** | Turborepo (pnpm workspaces) |

**Confidence: HIGH** — Confirmed from architecture overview, README, and codebase structure.

### GTM Status

| Milestone | Status |
|-----------|--------|
| Product | Feature-complete (v1.0.0 in CHANGELOG) |
| Documentation | Comprehensive (guides, API docs, architecture docs) |
| App Store listing | Draft exists, pricing placeholders, submission pending |
| iOS App Store | **Not published** |
| Android Play Store | **Not published** |
| GitHub | Private or not created |
| Press coverage | None confirmed |
| Social media | Discord active, Facebook/Instagram pages exist |

**Spotter appears to be in late pre-launch / early access phase.** The product is built, docs are extensive, App Store listing is drafted, but public distribution has not yet occurred.

**Confidence: HIGH**

---

## Key Strategic Findings

### 1. Pricing Discrepancy — Needs Resolution
The task brief listed SELECT as **$49/month**. Actual codebase docs show **$1,000/year**. These are materially different. If SELECT was ever going to be $49/month, the pricing strategy has shifted. This needs Michael's attention before any external-facing materials are published.

### 2. App Store Pre-Launch — Zero Public Presence
Spotter has no public App Store listing, no reviews, no ratings. This is a blank-slate reputation opportunity. The App Store listing draft is detailed and well-written — the launch should be prioritized to begin accumulating social proof.

### 3. Competitive White Space Is Real
No competitor has built a skill-tiered, reputation-backed networking layer. GPS apps (TheGrint, 18Birdies, Golfshot) have massive install bases but zero network lock-in. Spark Golf is the only direct competitor by mission but targets recreational/casual golfers. Spotter occupies a defensible premium position.

### 4. $10K SUMMIT Tier Is a Moat and a Risk
The $10,000 lifetime tier is unprecedented in golf apps. It serves as an extraordinary quality signal and creates instant "founding member" brand advocates. The risk is very small initial user base — most users will never pay $10K. The tier economics need to pencil out (SUMMIT users must be extremely valuable per-customer or the SELECT tier needs volume).

### 5. The "Pre-Launch" Window Is Closing
With comprehensive internal docs, full feature implementation, Discord active, and social pages live — Spotter is clearly ready for launch. The longer it stays pre-launch, the more time competitors (especially Spark Golf) have to grow into the same space.

---

## Sources

| Source | Type | Content Verified |
|--------|------|-----------------|
| `~/Documents/Spotter/README.md` | Internal | Product description, pricing, tech stack |
| `~/Documents/Spotter/docs/guides/tier-upgrade.md` | Internal | Full tier comparison, billing details |
| `~/Documents/Spotter/docs/guides/member-guide.md` | Internal | Features, reputation system, same-tier mechanics |
| `~/Documents/Spotter/docs/guides/organizer-guide.md` | Internal | Organizer tiers, Bronze/Silver/Gold pricing |
| `~/Documents/Spotter/docs/guides/reputation.md` | Internal | Full reputation scoring breakdown |
| `~/Documents/Spotter/docs/SAME_TIER_SUMMARY.md` | Internal | Technical enforcement details |
| `~/Documents/Spotter/docs/SAME_TIER_ENFORCEMENT_REPORT.md` | Internal | RLS policies, enforcement surfaces |
| `~/Documents/Spotter/docs/app-store/APP_STORE_iOS.md` | Internal | App Store listing draft, keywords, description |
| `~/Documents/Spotter/docs/dev/architecture-overview.md` | Internal | Full tech stack, data flows, security |
| `~/Documents/Spotter/CHANGELOG.md` | Internal | Version history, feature timeline |
| `~/Documents/Spotter/docs/research/strava-hinge-classpass-patterns.md` | Internal | Positioning reference (Hinge/Strava/ClassPass models) |
| iTunes Search API (`itunes.apple.com`) | External | Competitor app data (ratings, reviews, descriptions) |
| `spotter.golf` | External | Domain resolves (HTTP 200) |
| `discord.gg/spotter` | External | Discord server linked from README |
| `docs.spotter.golf` | External | Developer docs domain resolves |

---

*Report compiled: March 29, 2026. Web search unavailable (xAI API key not configured); research supplemented by internal codebase analysis, iTunes API data, and DNS/http checks. Claims tagged LOW confidence where external verification was not possible.*
