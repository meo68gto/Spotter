# EPIC 5: ROUNDS & FOURSOMES AS SOCIAL INFRASTRUCTURE
## Making Rounds the Central Social Mechanism of Spotter

**Date:** March 19, 2026  
**Repo:** Meo68gto/Spotter  
**Lead:** Product Architect  
**Depends On:** Epic 4 (Private Network Graph & Saved Members)

---

## 1. EPIC NAME

**Rounds & Foursomes as Social Infrastructure**

*Alternative: The Round-Centric Network*

---

## 2. GOAL: WHAT THIS EPIC ACHIEVES

**Primary Objective:** Transform rounds from isolated events into the connective tissue of the Spotter network. Make every round a trust-building moment that strengthens relationships and generates social proof.

**Success Metrics:**
- 60% of connections originate from round participation (vs. cold discovery)
- 40% of rounds are "replays" (players who've played together before)
- Average 4.2+ post-round rating completion rate
- Free tier users hit 3-round limit and convert to paid at 15%+ rate

**The Shift:**

| Before Epic 5 | After Epic 5 |
|---------------|--------------|
| Rounds are standalone events | Rounds are network-validated social proof |
| Connections happen, then maybe rounds | Rounds happen, then deepen connections |
| Trust is abstract (profile claims) | Trust is concrete (played-together history) |
| Discovery is cold (browse profiles) | Discovery is warm (who played with whom) |
| Free tier has soft limits | Free tier has hard 3-round limit with clear upgrade path |

---

## 3. WHY THIS COMES AFTER NETWORK GRAPH (EPIC 4)

### 3.1 The Sequence Logic

**Epic 4 establishes the graph. Epic 5 activates it through rounds.**

Without a network graph (connections, saved members, mutual connections), rounds lack context. A round invitation from a stranger is spam. A round invitation from a 2nd-degree connection with 3 mutuals is an opportunity.

**The Dependency Chain:**

```
Epic 4: Private Network Graph
    ↓
[Connections exist, saved members exist, 
 mutual connections visible, intro requests possible]
    ↓
Epic 5: Rounds as Social Infrastructure
    ↓
[Rounds validate connections, post-round ratings 
 create trust anchors, replay loops form]
```

### 3.2 Why Rounds Follow Connections

**1. Trust Requires Context**
- Golf is a 4-5 hour commitment with a stranger
- Users need social proof before accepting invites
- Network graph provides that proof (mutual connections, played-together counts)

**2. Rounds Validate Network Relationships**
- A connection on the graph is just a digital handshake
- A round played together is a real-world validation
- Post-round ratings make that validation measurable

**3. The "Played Together" Signal**
- This is the strongest trust signal in golf networking
- More valuable than LinkedIn endorsements or profile completeness
- Creates a virtuous cycle: play → rate → trust → more introductions

### 3.3 How Rounds Validate Network Relationships

**Trust Anchor Creation:**

```
Round Completed
    ↓
Post-Round Ratings Submitted (all 4 players)
    ↓
Trust Scores Updated (reliability, enjoyment, business value)
    ↓
"Played Together" Badge Appears on Profiles
    ↓
Future Discovery Boosted (played-together count = ranking signal)
    ↓
Introduction Requests More Likely (social proof established)
```

**The Validation Loop:**

| Stage | Network State | Trust Level |
|-------|---------------|-------------|
| Pre-Round | Connected (digital) | Low |
| During Round | Playing together (physical) | Medium |
| Post-Round | Rated each other (validated) | High |
| Replay Round | Standing foursome (proven) | Very High |

---

## 4. WHAT TO BUILD

### 4.1 Round Creation from Network (Invite Connections)

**The Flow:**

```
User taps "Create Round"
    ↓
Selects from:
  - My Connections (direct network)
  - Saved Members (bookmarked prospects)
  - Mutual Connections (2nd degree via intro)
    ↓
System enforces: All invitees must be same tier
    ↓
Invite sent with:
  - Proposed date/time window
  - Course (optional - can be TBD)
  - Note/personal message
  - Requester's "played together" history (social proof)
```

**Key Design Decisions:**
- **No public round listings** — Rounds are private, invitation-only
- **No cross-tier invites** — Strictly same-tier (enforced at API level)
- **Course is optional** — Focus on people first, logistics second
- **Time is a window** — "Week of March 24" not "Tuesday 8:30 AM"

### 4.2 Recurring Rounds (Standing Foursomes)

**Concept:** Groups that play together regularly. Not "every Tuesday" automation — rather, a lightweight way to re-convene the same group.

**The Model:**

```typescript
interface StandingFoursome {
  id: string;
  name: string;                    // "The Tuesday Crew", "Sunrise Summit"
  members: User[];                 // 4 players (can be 3 + 1 rotating)
  created_by: User;
  created_at: Date;
  rounds_played_count: number;     // Total rounds as a group
  last_round_at: Date;
  preferred_day: 'weekday' | 'weekend' | 'flexible';
  preferred_time: 'morning' | 'midday' | 'afternoon';
  status: 'active' | 'paused' | 'disbanded';
}
```

**User Flow:**

```
After completing a round:
"Enjoy playing with this group?"
[Create Standing Foursome] [Maybe Later]
    ↓
Name your group (optional)
    ↓
Group appears in:
  - "My Foursomes" tab
  - Round creation flow ("Invite Standing Foursome")
  - Each member's profile ("Plays with...")
```

**Standing Foursome Actions:**
- **"Play Again"** — One-tap round creation with same group
- **"Swap One"** — Replace one member (for rotating 4th)
- **"Pause"** — Stop notifications, keep history
- **"Disband"** — End the group (history preserved)

### 4.3 Round Lifecycle: Planning → Confirmed → Played → Reviewed

**State Machine:**

```
DRAFT (creator only)
    ↓
INVITED → invites sent to 1-3 players
    ↓
    ├─→ DECLINED (player rejects)
    ├─→ ACCEPTED (player accepts)
    └─→ EXPIRED (24h no response)
    ↓
CONFIRMED (all 4 accepted)
    ↓
PLAYED (creator marks complete, or auto after date + 24h)
    ↓
REVIEW_PENDING (ratings open for 7 days)
    ↓
    ├─→ REVIEWED (all 4 submitted ratings)
    └─→ REVIEW_CLOSED (7 days elapsed)
```

**State Details:**

| State | Description | Actions Available |
|-------|-------------|-------------------|
| **DRAFT** | Creator building the round | Add/remove invitees, edit details, send invites |
| **INVITED** | Waiting for responses | Accept, decline, cancel (creator) |
| **CONFIRMED** | All players locked in | Mark played, cancel (emergency) |
| **PLAYED** | Round completed | Submit ratings, view ratings |
| **REVIEW_PENDING** | Ratings window open | Submit ratings (7 day window) |
| **REVIEWED** | All ratings submitted | View full breakdown, update reputation |
| **REVIEW_CLOSED** | Ratings window closed | View anonymized aggregate |

### 4.4 Post-Round Ratings and Feedback

**The Rating Dimensions:**

```typescript
interface RoundRating {
  round_id: string;
  rater_id: string;           // Who is rating
  ratee_id: string;           // Who is being rated
  
  // Core ratings (1-5 stars)
  punctuality: number;        // Showed up on time?
  golf_etiquette: number;     // Pace of play, course care?
  enjoyment: number;          // Fun to play with?
  business_value?: number;    // Networking value (optional)
  
  // Binary flags
  would_play_again: boolean;  // Key signal for matching
  would_introduce: boolean;   // Would you intro them to your network?
  
  // Optional
  private_note?: string;      // Only visible to rater (memory)
  public_compliment?: string; // Visible on ratee's profile (optional)
}
```

**Rating Flow:**

```
Round marked "Played"
    ↓
Push notification: "Rate your round with [names]"
    ↓
Rate each player (not self):
  - Stars for punctuality, etiquette, enjoyment
  - Toggle: "Would play again"
  - Toggle: "Worth introducing to others"
  - Optional: Public compliment ("Great conversation about SaaS pricing")
    ↓
Submit → Ratings aggregated → Reputation scores updated
```

**Rating Visibility:**

| Data | Visible To |
|------|------------|
| Individual ratings | Only rater and ratee (private) |
| Average scores | Ratee sees their own averages |
| Would play again % | Ratee sees %, others see "Highly rated" badge |
| Public compliments | Ratee's profile (if they approve) |
| Played-together count | Public on both profiles |

### 4.5 Round History as Trust Anchor

**Profile Integration:**

```
Profile Screen
├── Identity Cards (existing)
├── Network Stats (existing from Epic 4)
└── NEW: Round History Section
    ├── "Rounds Played: 12"
    ├── "Standing Foursomes: 2"
    ├── "Played With: [mutual connections]"
    └── Recent Rounds (last 3)
        ├── Date, course, group
        └── "You rated them: ⭐⭐⭐⭐⭐"
```

**Trust Signals Generated:**

| Signal | Meaning | Display |
|--------|---------|---------|
| **Rounds Completed** | Active participant | "12 rounds played" |
| **Standing Foursomes** | Has loyal playing partners | "2 regular groups" |
| **Would Play Again %** | Enjoyable playing partner | "95% would play again" |
| **Played Together** | Mutual trust validated | "Played with [name] 3x" |
| **Introductions Made** | Network contributor | "Introduced 8 connections" |

### 4.6 "Play Together Again" Prompts

**Trigger Conditions:**

```
After round completes:
    ↓
IF all ratings >= 4 stars AND all "would_play_again" = true
    ↓
Show prompt to all 4 players:
"Everyone enjoyed playing together. Create a standing foursome?"
    ↓
[Yes, Create Group] [Remind Me Later] [No Thanks]
```

**Additional Triggers:**
- **30-day reminder:** "You played with [name] a month ago. Schedule again?"
- **Seasonal:** "It's been 3 months since you played with [group]. Reconvene?"
- **Availability-based:** "[Name] is looking for a round this week. You played well together before."

---

## 5. WHAT TO REUSE

### 5.1 Existing Rounds System

**Already Built (No Changes Needed):**

| Function | Location | Reuse |
|----------|----------|-------|
| `rounds-create` | `apps/edge-functions/rounds-create/index.ts` | ✅ Reuse — just add network-aware invite flow |
| `rounds-invite` | `apps/edge-functions/rounds-invite/index.ts` | ✅ Reuse — add connection validation |
| `rounds-join` | `apps/edge-functions/rounds-join/index.ts` | ✅ Reuse — add tier enforcement check |
| `rounds-list` | `apps/edge-functions/rounds-list/index.ts` | ✅ Reuse — add lifecycle states |
| `rounds-respond` | `apps/edge-functions/rounds-respond/index.ts` | ✅ Reuse — add state transitions |

**Schema Already Exists:**

```typescript
// packages/types/src/rounds.ts (existing)
interface Round {
  id: string;
  created_by: string;
  course_id?: string;
  scheduled_date?: Date;
  status: 'draft' | 'invited' | 'confirmed' | 'completed' | 'cancelled';
  max_players: number;
  created_at: Date;
  updated_at: Date;
}

interface RoundPlayer {
  round_id: string;
  user_id: string;
  status: 'invited' | 'accepted' | 'declined' | 'completed';
  invited_at: Date;
  responded_at?: Date;
}
```

### 5.2 Existing Network Connections

**From Epic 4:**

| Component | Use In Epic 5 |
|-----------|---------------|
| `user_connections` table | Validate invitees are connected |
| `saved_members` table | Allow inviting bookmarked prospects |
| Mutual connections query | Show social proof on invites |
| Introduction request flow | Enable 2nd-degree round invites |

### 5.3 Existing Reputation System

**From Epic 3 + 6:**

| Component | Use In Epic 5 |
|-----------|---------------|
| `user_reputation` table | Add round-derived scores |
| `reputation-calculate` function | Include round ratings in formula |
| Trust badges | Display "Highly Rated" from round data |

### 5.4 Existing Matching for Filling Foursomes

**When a foursome has 3 players and needs a 4th:**

```
Creator taps "Find 4th"
    ↓
System queries matching engine (Epic 3)
    ↓
Filters: Same tier, compatible handicap, available date
    ↓
Ranks by: Match score + "would play again" history
    ↓
Presents: "Suggested 4th" with mutual connections
    ↓
Creator invites → 4th accepts → Round confirmed
```

---

## 6. WHAT NOT TO DO

### 6.1 Don't Build Generic Event System

**Resist the temptation:**
- ❌ No "create any type of event" abstraction
- ❌ No calendar integration (Google/Outlook sync)
- ❌ No recurring scheduling automation ("every Tuesday")
- ❌ No "public events" or "open tee times"

**Why:** Golf rounds are specific social contracts. Generic event systems dilute the focus and create complexity we don't need.

### 6.2 Don't Allow Cross-Tier Round Invites

**Hard rule:**
- ❌ Free cannot invite Select/Summit
- ❌ Select cannot invite Summit
- ❌ Summit cannot invite down (maintains exclusivity)

**Enforcement:**
```typescript
// In rounds-invite edge function
const inviteeTier = await getUserTier(inviteeId);
const creatorTier = await getUserTier(creatorId);

if (inviteeTier !== creatorTier) {
  throw new Error('Cross-tier rounds not allowed');
}
```

### 6.3 Don't Over-Engineer Logistics

**Out of scope:**
- ❌ Tee time booking APIs
- ❌ Cart assignment
- ❌ Score tracking / handicaps
- ❌ Course availability checking
- ❌ Payment splitting for green fees
- ❌ Weather integration

**In scope (lightweight):**
- ✅ Proposed date/time window
- ✅ Course name (text, not validated)
- ✅ "Meet at pro shop" default
- ✅ Notes field for logistics

**Philosophy:** Spotter connects people. Courses handle logistics. We don't compete with GolfNow or TeeOff.

---

## 7. CORE BACKEND WORK

### 7.1 Schema Changes for Recurring Rounds

**New Table: `standing_foursomes`**

```sql
CREATE TABLE standing_foursomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  preferred_day TEXT CHECK (preferred_day IN ('weekday', 'weekend', 'flexible')),
  preferred_time TEXT CHECK (preferred_time IN ('morning', 'midday', 'afternoon')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disbanded')),
  rounds_played_count INTEGER DEFAULT 0,
  last_round_at TIMESTAMPTZ
);

CREATE TABLE standing_foursome_members (
  foursome_id UUID REFERENCES standing_foursomes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  role TEXT DEFAULT 'member' CHECK (role IN ('creator', 'member')),
  PRIMARY KEY (foursome_id, user_id)
);

-- RLS: Only same-tier members can see foursome
CREATE POLICY standing_foursomes_same_tier ON standing_foursomes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM standing_foursome_members sfm
      JOIN users u ON u.id = sfm.user_id
      WHERE sfm.foursome_id = standing_foursomes.id
      AND u.tier_id = auth.user_tier_id()
    )
  );
```

**Update Table: `rounds`**

```sql
-- Add lifecycle states
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS 
  lifecycle_status TEXT DEFAULT 'draft' 
  CHECK (lifecycle_status IN (
    'draft', 'invited', 'confirmed', 'played', 
    'review_pending', 'reviewed', 'review_closed', 'cancelled'
  ));

-- Add standing foursome reference
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS 
  standing_foursome_id UUID REFERENCES standing_foursomes(id);

-- Add played_at timestamp
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS 
  played_at TIMESTAMPTZ;

-- Add reviewed_at timestamp
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS 
  reviewed_at TIMESTAMPTZ;
```

### 7.2 Post-Round Rating System

**New Table: `round_ratings`**

```sql
CREATE TABLE round_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  rater_id UUID REFERENCES users(id) NOT NULL,
  ratee_id UUID REFERENCES users(id) NOT NULL,
  
  -- Core ratings (1-5)
  punctuality INTEGER CHECK (punctuality BETWEEN 1 AND 5),
  golf_etiquette INTEGER CHECK (golf_etiquette BETWEEN 1 AND 5),
  enjoyment INTEGER CHECK (enjoyment BETWEEN 1 AND 5),
  business_value INTEGER CHECK (business_value BETWEEN 1 AND 5),
  
  -- Binary signals
  would_play_again BOOLEAN DEFAULT false,
  would_introduce BOOLEAN DEFAULT false,
  
  -- Optional text
  private_note TEXT,
  public_compliment TEXT,
  public_compliment_approved BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One rating per rater-ratee-round
  UNIQUE(round_id, rater_id, ratee_id)
);

-- Indexes
CREATE INDEX idx_round_ratings_round ON round_ratings(round_id);
CREATE INDEX idx_round_ratings_ratee ON round_ratings(ratee_id);
CREATE INDEX idx_round_ratings_rater ON round_ratings(rater_id);

-- RLS: Users can only see their own ratings (given and received)
CREATE POLICY round_ratings_own ON round_ratings
  FOR SELECT USING (
    rater_id = auth.uid() OR ratee_id = auth.uid()
  );
```

**Edge Function: `rounds-rate`**

```typescript
// apps/edge-functions/rounds-rate/index.ts
export default async (req: Request): Promise<Response> => {
  const { round_id, ratings } = await req.json();
  const rater_id = getAuthUser(req);
  
  // Verify round is in 'played' or 'review_pending' state
  // Verify rater was a participant
  // Verify ratees were participants
  // Verify no duplicate ratings
  
  // Insert ratings
  for (const rating of ratings) {
    await sql`
      INSERT INTO round_ratings 
        (round_id, rater_id, ratee_id, punctuality, 
         golf_etiquette, enjoyment, would_play_again, would_introduce)
      VALUES 
        (${round_id}, ${rater_id}, ${rating.ratee_id}, ${rating.punctuality},
         ${rating.golf_etiquette}, ${rating.enjoyment}, 
         ${rating.would_play_again}, ${rating.would_introduce})
    `;
  }
  
  // Update round state if all ratings submitted
  await checkAndUpdateRoundState(round_id);
  
  // Trigger reputation recalculation
  await triggerReputationUpdate(rater_id);
  
  return json({ success: true });
};
```

### 7.3 Integration with Network Graph

**New Function: `get_network_round_eligible_users`**

```sql
-- Returns users who can be invited to a round
-- Must be: same tier, connected or saved, not already in a round that day
CREATE OR REPLACE FUNCTION get_network_round_eligible_users(
  p_user_id UUID,
  p_proposed_date DATE
)
RETURNS TABLE (
  user_id UUID,
  connection_type TEXT, -- 'direct', 'saved', 'mutual'
  mutual_count INTEGER,
  played_together_count INTEGER,
  last_round_together DATE
) AS $$
BEGIN
  RETURN QUERY
  WITH eligible AS (
    -- Direct connections
    SELECT 
      uc.addressee_id AS user_id,
      'direct'::TEXT AS connection_type,
      0 AS mutual_count
    FROM user_connections uc
    WHERE uc.requester_id = p_user_id
    AND uc.status = 'accepted'
    
    UNION
    
    -- Saved members
    SELECT 
      sm.saved_user_id AS user_id,
      'saved'::TEXT AS connection_type,
      0 AS mutual_count
    FROM saved_members sm
    WHERE sm.saver_id = p_user_id
    
    UNION
    
    -- 2nd degree (via introduction)
    SELECT 
      intro.introduced_id AS user_id,
      'mutual'::TEXT AS connection_type,
      1 AS mutual_count
    FROM introduction_requests intro
    WHERE intro.requester_id = p_user_id
    AND intro.status = 'accepted'
  )
  SELECT 
    e.user_id,
    e.connection_type,
    e.mutual_count,
    COALESCE(pt.played_together_count, 0),
    pt.last_round_together
  FROM eligible e
  JOIN users u ON u.id = e.user_id
  -- Same tier only
  WHERE u.tier_id = (SELECT tier_id FROM users WHERE id = p_user_id)
  -- Not already in a round that day
  AND NOT EXISTS (
    SELECT 1 FROM round_players rp
    JOIN rounds r ON r.id = rp.round_id
    WHERE rp.user_id = e.user_id
    AND r.scheduled_date = p_proposed_date
    AND r.status IN ('confirmed', 'invited')
  );
END;
$$ LANGUAGE plpgsql;
```

### 7.4 Free Tier 3-Round Limit Enforcement

**Schema Addition:**

```sql
-- Add round count tracking to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  rounds_created_count INTEGER DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  rounds_joined_count INTEGER DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  rounds_limit_reset_at TIMESTAMPTZ;
```

**Edge Function Enforcement:**

```typescript
// In rounds-create edge function
async function checkRoundLimit(userId: string, tierId: string): Promise<void> {
  if (tierId === 'free') {
    const user = await getUserRoundStats(userId);
    const totalRounds = user.rounds_created_count + user.rounds_joined_count;
    
    if (totalRounds >= 3) {
      throw new Error('FREE_TIER_LIMIT_REACHED');
    }
  }
}

// Returns clear error for frontend to show upgrade CTA
```

**Frontend CTA:**

```
"You've used 3/3 rounds on the Free tier.

Upgrade to Select ($1000/year) for unlimited rounds
and access to our private network of 2,000+ golfers.

[Upgrade to Select] [Learn More]"
```

---

## 8. CORE FRONTEND WORK

### 8.1 Round Creation from Member Profiles

**New Component: `RoundInviteButton`**

```typescript
// apps/mobile/src/components/RoundInviteButton.tsx
interface Props {
  userId: string;
  variant: 'profile' | 'connection_card' | 'standing_foursome';
}

// On profile: "Invite to Round"
// On connection card: "+ Round"
// In standing foursome: "Play Again"
```

**New Screen: `CreateRoundScreen`**

```
Create Round
├── Step 1: Select Players
│   ├── Tab: My Connections
│   ├── Tab: Saved Members  
│   ├── Tab: Standing Foursomes
│   └── Selected: [UserChip] [UserChip] [+]
├── Step 2: When & Where
│   ├── Date: [Week of March 24] (flexible)
│   ├── Time: [Morning] [Midday] [Afternoon]
│   └── Course: [Type or TBD]
├── Step 3: Personal Note
│   └── "Looking forward to playing with you..."
└── Send Invites
```

### 8.2 Round Management Screens

**Updated: `RoundsScreen`**

```
My Rounds
├── Tab: Upcoming
│   └── RoundCard (status: confirmed, invited)
├── Tab: Pending Review
│   └── RoundCard (status: played, needs rating)
├── Tab: History
│   └── RoundCard (status: reviewed, closed)
└── [+ Create Round]
```

**New Component: `RoundCard`**

```typescript
interface RoundCardProps {
  round: Round;
  players: RoundPlayer[];
  status: 'draft' | 'invited' | 'confirmed' | 'played' | 'review_pending' | 'reviewed';
  onAccept?: () => void;
  onDecline?: () => void;
  onRate?: () => void;
  onCreateAgain?: () => void;
}

// Visual states:
// - Invited: "Accept" / "Decline" buttons
// - Confirmed: Player avatars, date, course
// - Played: "Rate Your Round" CTA
// - Reviewed: Star ratings summary
```

**New Screen: `RoundDetailScreen`**

```
Round Detail
├── Status Badge: [Confirmed]
├── Players (4 avatars)
│   └── Tap to view profile
├── When: Week of March 24, Morning
├── Where: TPC Scottsdale (or TBD)
├── Note from organizer
├── Actions:
│   ├── [Message Group] (if confirmed)
│   ├── [Mark Played] (if organizer)
│   └── [Cancel Round]
└── History:
    └── Created: March 15
        Invited: March 15
        Confirmed: March 16
```

### 8.3 Post-Round Rating UI

**New Screen: `RateRoundScreen`**

```
Rate Your Round
"How was playing with this group?"

├── Player 1: [Name] [Avatar]
│   ├── Punctuality: ⭐⭐⭐⭐⭐
│   ├── Golf Etiquette: ⭐⭐⭐⭐⭐
│   ├── Enjoyment: ⭐⭐⭐⭐⭐
│   ├── [✓] Would play again
│   └── [✓] Worth introducing to others
│   └── Optional: "Great conversation about..."
├── Player 2: [Name] [Avatar]
│   └── [Same rating UI]
├── Player 3: [Name] [Avatar]
│   └── [Same rating UI]
└── [Submit Ratings]

Note: Ratings are private. Players won't see 
individual scores, only averages.
```

**New Component: `RatingSummary`**

```
Your Round Ratings
├── "You've played 12 rounds"
├── "Average rating: 4.6/5"
├── "95% would play again"
└── Recent compliments:
    ├── "Great conversation about SaaS pricing"
    ├── "Excellent pace of play"
    └── "Would love to play again soon"
```

### 8.4 Round History in Profile

**Updated: `ProfileScreen`**

```
Profile
├── Identity Cards (existing)
├── Network Stats (existing)
└── NEW: Round History Section
    ├── Stats Row:
    │   ├── "12 Rounds"
    │   ├── "2 Foursomes"
    │   └── "95% Rating"
    ├── Standing Foursomes:
    │   └── [FoursomeCard] [FoursomeCard]
    ├── Recent Rounds:
    │   └── [RoundHistoryItem] x 3
    └── [View Full History]
```

**New Component: `FoursomeCard`**

```
┌─────────────────────────────┐
│ The Tuesday Crew            │
│ 👤 👤 👤 👤                  │
│ 8 rounds together           │
│ Last: March 10              │
│ [Play Again]                │
└─────────────────────────────┘
```

**New Component: `RoundHistoryItem`**

```
┌─────────────────────────────┐
│ March 10, 2026              │
│ TPC Scottsdale              │
│ With: [Name], [Name], [Name]│
│ You rated: ⭐⭐⭐⭐⭐           │
│ They rated you: ⭐⭐⭐⭐⭐        │
└─────────────────────────────┘
```

### 8.5 "Schedule Again" Flows

**New Component: `ScheduleAgainPrompt`**

```
┌─────────────────────────────┐
│ 🔄 Play Together Again?     │
│                             │
│ You played with [Name]      │
│ 30 days ago.                │
│                             │
│ [Schedule Round] [Dismiss]  │
└─────────────────────────────┘
```

**Trigger Locations:**
- Home screen (after 30 days since last round with connection)
- After completing a round (if all ratings high)
- Profile view (if played together before)
- Standing foursome detail ("It's been 2 weeks...")

---

## 9. ACCEPTANCE CRITERIA

### 9.1 Backend Criteria

| # | Criteria | Verification |
|---|----------|--------------|
| 1 | Schema migrations for `standing_foursomes`, `round_ratings` applied | `supabase db diff` shows tables exist |
| 2 | RLS policies enforce same-tier on all round operations | Test: Free user cannot invite Select user |
| 3 | Free tier 3-round limit enforced at API level | Test: 4th round creation returns 403 with `FREE_TIER_LIMIT_REACHED` |
| 4 | Round lifecycle state machine transitions correctly | Test: All state transitions in test suite pass |
| 5 | Post-round ratings update reputation scores | Test: Submit rating → reputation recalculated |
| 6 | `get_network_round_eligible_users` returns only same-tier connections | Test: Query returns only matching tier_ids |
| 7 | Standing foursome creation updates `user_connections` trust scores | Test: Create foursome → connection strength increased |

### 9.2 Frontend Criteria

| # | Criteria | Verification |
|---|----------|--------------|
| 1 | Round creation flow accessible from profile, connections, saved members | Manual: Tap "Invite to Round" on profile |
| 2 | Round cards display correct lifecycle state and actions | Visual: Invited shows Accept/Decline, Played shows Rate |
| 3 | Rating UI allows 1-5 stars for 3 dimensions + binary toggles | Manual: Complete rating flow |
| 4 | Profile shows round history, standing foursomes, played-together count | Visual: Profile screen displays section |
| 5 | "Schedule Again" prompts appear after 30 days | Manual: Set system date forward 30 days |
| 6 | Free tier users see upgrade CTA after 3 rounds | Visual: 4th round attempt shows upgrade modal |
| 7 | Standing foursome "Play Again" creates round with same group | Manual: Tap Play Again → verify same 4 players |

### 9.3 Integration Criteria

| # | Criteria | Verification |
|---|----------|--------------|
| 1 | Round invites respect network graph (only connections/saved/mutuals) | Test: Random user ID cannot be invited |
| 2 | Post-round ratings visible on profile as trust signals | Visual: "95% would play again" badge shown |
| 3 | Matching engine includes "played together" as ranking signal | Test: Match score higher for played-together |
| 4 | Introduction requests reference round history | Visual: "You both played with [Name]" shown |
| 5 | Free tier limit resets annually with subscription | Test: Update `rounds_limit_reset_at` → count resets |

### 9.4 Product Criteria

| # | Criteria | Target |
|---|----------|--------|
| 1 | 60% of connections originate from round participation | Analytics tracking |
| 2 | 40% of rounds are "replays" (played together before) | Analytics tracking |
| 3 | 4.2+ post-round rating completion rate | Analytics tracking |
| 4 | Free tier → paid conversion at 15%+ | Stripe data |
| 5 | Average 2.5 rounds per user per month | Analytics tracking |
| 6 | Standing foursome groups average 6+ rounds together | Analytics tracking |

---

## 10. ARCHITECTURAL DECISIONS

### 10.1 Why No Cross-Tier Rounds

**Decision:** Strict same-tier enforcement for rounds.

**Rationale:**
- Rounds are the highest-trust interaction on the platform
- Cross-tier would undermine the exclusivity promise
- Summit members pay $10K for privacy from lower tiers
- Free users have limited rounds — they should use them within their tier

**Exception:** None. Even introductions across tiers don't enable cross-tier rounds.

### 10.2 Why Lightweight Logistics

**Decision:** No tee time booking, no course APIs, no cart assignment.

**Rationale:**
- Spotter is a network, not a booking platform
- GolfNow, TeeOff, and courses own logistics
- Focus on people matching, not schedule coordination
- "TBD" is a valid course — the group decides later

### 10.3 Why 7-Day Rating Window

**Decision:** Ratings open for 7 days after round, then close.

**Rationale:**
- Fresh memories = accurate ratings
- Creates urgency to complete
- Prevents gaming the system with delayed ratings
- 7 days is enough for busy professionals

### 10.4 Why Private Ratings with Public Signals

**Decision:** Individual ratings private, aggregated signals public.

**Rationale:**
- Honesty requires privacy (won't rate friend poorly if public)
- Trust requires transparency (need to see if someone is reliable)
- Compromise: Private details, public patterns

### 10.5 Why Standing Foursomes vs. Recurring Events

**Decision:** Lightweight groups, not automated scheduling.

**Rationale:**
- Golf schedules are irregular (weather, travel, work)
- "Every Tuesday" creates no-show problems
- Better: One-tap "Play Again" when the group is ready
- Keeps the social contract explicit

---

## 11. RISKS AND MITIGATIONS

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low rating completion | Medium | High | Push notifications, 7-day window, profile nudges |
| Free tier abuse (fake accounts) | Low | Medium | Phone verification, 3-round limit, report system |
| Standing foursomes become stale | Medium | Medium | Auto-pause after 90 days, "revive" prompt |
| Users rate retaliate (bad round = bad rating) | Low | High | Weight ratings by round count, outlier detection |
| Cross-tier invite attempts | Medium | High | API enforcement, clear error messages, upgrade CTA |
| Over-engineering logistics | Medium | Medium | Strict "no tee times" rule in PRD, product review gate |

---

## 12. DEPENDENCIES

| Dependency | Epic | Status | Blocker? |
|------------|------|--------|----------|
| Network graph | 4 | In Progress | YES — need connections, saved members |
| Same-tier enforcement | 2 | Complete | No — already enforced |
| Premium matching | 3 | Complete | No — reuse matching engine |
| Reputation system | 3/6 | Partial | No — basic system exists |
| Rounds system | Pre-1 | Complete | No — foundation exists |

---

## 13. EPIC 5 COMPLETE CHECKLIST

### Backend
- [ ] `standing_foursomes` table created with RLS
- [ ] `standing_foursome_members` junction table created
- [ ] `round_ratings` table created with RLS
- [ ] Round lifecycle state machine implemented
- [ ] `get_network_round_eligible_users` function deployed
- [ ] Free tier 3-round limit enforcement in `rounds-create`
- [ ] `rounds-rate` edge function deployed
- [ ] Reputation recalculation includes round ratings
- [ ] `rounds-update-state` edge function for lifecycle transitions

### Frontend
- [ ] `RoundInviteButton` component (profile, connections, saved)
- [ ] `CreateRoundScreen` with network-aware player selection
- [ ] `RoundCard` component with lifecycle states
- [ ] `RoundsScreen` with Upcoming/Pending/History tabs
- [ ] `RoundDetailScreen` with player management
- [ ] `RateRoundScreen` with 3-dimension rating UI
- [ ] `RatingSummary` component for profile
- [ ] `FoursomeCard` component
- [ ] `RoundHistoryItem` component
- [ ] `ScheduleAgainPrompt` component
- [ ] Profile screen updated with round history section
- [ ] Free tier upgrade CTA modal

### Integration
- [ ] Round creation from network graph (connections, saved, mutuals)
- [ ] Post-round ratings update reputation
- [ ] Standing foursome "Play Again" flow
- [ ] "Schedule Again" prompts (30-day, post-round, seasonal)
- [ ] Matching engine includes played-together signal
- [ ] Introduction requests show round history overlap

### Quality
- [ ] Same-tier enforcement verified (no cross-tier rounds)
- [ ] Free tier limit tested (3 rounds max)
- [ ] Rating privacy verified (individual ratings not visible)
- [ ] Analytics events tracked (round created, rated, replayed)
- [ ] Error handling for all edge cases

---

## 14. POST-EPIC 5: WHAT COMES NEXT

**Epic 6: Trust & Reputation Expansion**
- Reliability score (show rate calculation)
- No-show tracking and consequences
- Trust badges ("Highly Rated", "Reliable")
- Played-together count as ranking signal

**Epic 7: Premium Tier Differentiation**
- Tier-specific discovery filters
- Summit-only rounds and foursomes
- Premium visibility controls
- Elite networking events

**Epic 8: Coaching Repositioning**
- Remove multi-sport (pickleball, tennis)
- Golf-only coach marketplace
- Move to "More" menu
- Tier-based coaching access

---

## APPENDIX: DATA FLOW DIAGRAMS

### A.1 Round Creation Flow

```
User taps "Create Round"
    ↓
Frontend: Fetch eligible users from network
    ↓
API: get_network_round_eligible_users(user_id, date)
    ↓
DB: Query connections + saved + mutuals, filter same tier
    ↓
Frontend: Display eligible users with social proof
    ↓
User selects 1-3 players
    ↓
Frontend: POST /rounds-create
    ↓
API: Verify all players same tier, create round
    ↓
DB: Insert round, insert round_players (status: invited)
    ↓
API: Send push notifications to invitees
    ↓
Frontend: Show "Invites Sent" confirmation
```

### A.2 Post-Round Rating Flow

```
Round date passes + 24h
    ↓
Cron: Mark round as "played"
    ↓
DB: Update round status, set review_pending
    ↓
API: Send push: "Rate your round"
    ↓
User opens RateRoundScreen
    ↓
Frontend: Display 3 players to rate
    ↓
User submits ratings
    ↓
API: POST /rounds-rate
    ↓
DB: Insert round_ratings
    ↓
API: Check if all ratings submitted
    ↓
DB: Update round to "reviewed"
    ↓
API: Trigger reputation recalculation
    ↓
DB: Update user_reputation with new averages
    ↓
Frontend: Show "Thanks for rating" confirmation
```

### A.3 Standing Foursome Flow

```
Round completes with high ratings
    ↓
Frontend: Show "Create Standing Foursome?" prompt
    ↓
User taps "Yes"
    ↓
Frontend: POST /standing-foursomes-create
    ↓
API: Create foursome, add 4 members
    ↓
DB: Insert standing_foursomes, standing_foursome_members
    ↓
Frontend: Show foursome in "My Foursomes"
    ↓
Later: User taps "Play Again"
    ↓
Frontend: Pre-populate CreateRoundScreen with 4 members
    ↓
User confirms date/time
    ↓
API: Create round with standing_foursome_id
    ↓
DB: Insert round, round_players (status: invited)
    ↓
API: Send notifications to all 4
```

---

**Document Status:** Ready for Implementation  
**Last Updated:** March 19, 2026  
**Author:** Product Architect  
**Reviewers:** Awaiting Fox (Implementation), Clark (Strategy), Diana (Legal)
