# Network Connection State Machine

## Overview

The private golf network uses a progressive connection state machine that tracks relationship evolution from discovery through trust. This document defines the valid state transitions and validation rules.

## State Definitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONNECTION STATE MACHINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │  DISCOVERED │◄────────────────────────────────────────────────────┐
    └──────┬──────┘                                                     │
           │                                                             │
           │ Save Member                                                │
           │ (via discovery/search)                                     │
           ▼                                                             │
    ┌─────────────┐     Remove                                          │
    │    SAVED    │─────────────────────────────────────────────────────┤
    └──────┬──────┘                                                     │
           │                                                             │
           │ Request Introduction                                        │
           │ (warm intro via mutual)                                    │
           ▼                                                             │
    ┌─────────────┐     Decline                                         │
    │   INVITED   │─────────────────────────────────────────────────────►│
    └──────┬──────┘                                                     │
           │ Accept                                                    │
           │ (connector approves)                                       │
           ▼                                                             │
    ┌─────────────┐     Decline                                         │
    │  CONNECTED  │─────────────────────────────────────────────────────┤
    │  (accepted) │                                                      │
    └──────┬──────┘                                                     │
           │                                                             │
           │ Play Round Together                                         │
           │ (round completed)                                          │
           ▼                                                             │
    ┌─────────────┐                                                     │
    │   PLAYED    │                                                     │
    │  TOGETHER   │─────────────────────────────────────────────────────┤
    └──────┬──────┘                                                     │
           │                                                             │
           │ 3+ Rounds Together                                          │
           │                                                             │
           ▼                                                             │
    ┌─────────────┐                                                     │
    │   TRUSTED   │                                                     │
    │ CONNECTION  │                                                     │
    └─────────────┘                                                     │
           │                                                             │
           │ Block / Remove                                              │
           │                                                             │
           └────────────────────────────────────────────────────────────►┘
```

## State Descriptions

| State | Description | Entry Criteria | Exit Criteria |
|-------|-------------|----------------|---------------|
| **discovered** | Initial discovery via app features | User views another user's profile | Save member or dismiss |
| **saved** | Member saved to personal network | User saves member | Request intro or remove |
| **invited** | Warm introduction requested | Connector receives intro request | Connector responds |
| **connected** | Direct connection established | Target accepts introduction | Play round together |
| **played_together** | Completed at least one round | Round status = 'reviewed' | Play 3+ rounds |
| **trusted_connection** | Regular playing partner | 3+ rounds completed | Block/remove |

## Transition Validation Rules

### Allowed Transitions

| From State | To State | Trigger | Validation |
|------------|----------|---------|------------|
| discovered → saved | `saveMember()` | User saves member | Same tier check |
| saved → invited | `requestIntroduction()` | Request warm intro | Mutual connection exists, 48h timeout set |
| saved → discovered | `removeSavedMember()` | User unsaves | - |
| invited → connected | `respondToIntroduction('accept')` | Target accepts | Same tier check, within timeout |
| invited → saved | `respondToIntroduction('decline')` | Target declines | - |
| invited → saved | `expireIntroduction()` | 48h timeout | Auto-cleanup |
| connected → played_together | `completeRound()` | Round completed | Both in round, round reviewed |
| played_together → trusted_connection | `promoteToTrusted()` | 3+ rounds | Auto-promotion |
| played_together → connected | `demoteConnection()` | Manual action | - |
| *any* → *removed* | `blockConnection()` | User blocks | Cleanup saved state |

### Forbidden Transitions (Prevented)

| Attempted Transition | Reason Blocked |
|---------------------|----------------|
| discovered → connected | Must go through saved + invited |
| discovered → played_together | Must establish connection first |
| saved → played_together | Must establish connection first |
| saved → trusted_connection | Must establish connection and play |
| invited → trusted_connection | Must accept and play first |
| connected → trusted_connection | Must play together first |

## State Validation Function

```typescript
// packages/types/src/networking.ts

/**
 * Validates if a state transition is allowed
 * @param fromState Current relationship state
 * @param toState Desired new state
 * @param context Optional context (roundsCount, etc.)
 * @returns boolean indicating if transition is valid
 */
export function isValidStateTransition(
  fromState: RelationshipState,
  toState: RelationshipState,
  context?: { roundsCount?: number }
): boolean {
  const transitions: Record<RelationshipState, RelationshipState[]> = {
    'matched': ['invited'],  // Initial match can invite
    'invited': ['played_together', 'matched'],  // Decline goes back to matched
    'played_together': ['regular_partner', 'invited'],
    'regular_partner': ['played_together'],
  };
  
  // Special case: regular_partner requires 3+ rounds
  if (toState === 'regular_partner' && (!context?.roundsCount || context.roundsCount < 3)) {
    return false;
  }
  
  return transitions[fromState]?.includes(toState) ?? false;
}
```

## Same-Tier Enforcement

All state transitions enforce same-tier membership:

```typescript
// All connection states require same tier
const canTransition = await checkSameTier(requesterId, targetId);
if (!canTransition) {
  throw new Error('Cross-tier connections are not allowed');
}
```

## Timeout Handling

| State | Timeout | Action on Expiry |
|-------|---------|------------------|
| invited | 48 hours | Auto-decline, return to saved |
| connected | None | - |
| played_together | 30 days inactivity | Decay strength score |

## Database Schema

```sql
-- Current state stored in user_connections
ALTER TABLE user_connections ADD COLUMN relationship_state 
  relationship_state DEFAULT 'matched';

-- Transition history (optional audit)
CREATE TABLE connection_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES user_connections(id),
  from_state relationship_state,
  to_state relationship_state,
  triggered_by UUID REFERENCES users(id),
  triggered_by_event TEXT, -- 'round_completed', 'manual', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Integration Points

### Rounds Integration
```typescript
// After round completion
await updateConnectionOnRound(userA, userB);
// Automatically: invited → played_together
// Or: played_together → regular_partner (if 3+ rounds)
```

### Notifications
- **State: invited** → Notify connector
- **State: connected** → Notify both parties  
- **State: played_together** → Congratulatory message
- **State: trusted_connection** → Achievement unlocked

## Visual Indicators

| State | Icon | Color | Badge Text |
|-------|------|-------|------------|
| discovered | 🔍 | Gray | "Discover" |
| saved | ★ | Blue | "Saved" |
| invited | 📨 | Amber | "Pending" |
| connected | 🤝 | Blue | "Connected" |
| played_together | ⛳ | Green | "Played" |
| trusted_connection | 🏆 | Purple | "Trusted" |
