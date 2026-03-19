# Phase 2: Round Coordination & Scheduling System

## Overview

This implementation provides a complete foursome/round coordination system for the Spotter golf networking platform with same-tier enforcement and tier-based feature gating.

## Deliverables

### 1. Database Schema (PostgreSQL)

#### Tables Created

**`rounds`** - Core round coordination table
- `id` (uuid, primary key)
- `creator_id` (uuid, references users)
- `course_id` (uuid, references golf_courses)
- `scheduled_at` (timestamptz) - Round date and time
- `max_players` (integer) - 2, 3, or 4 players
- `cart_preference` (enum) - walking/cart/either
- `tier_id` (uuid, references membership_tiers) - Same-tier enforcement
- `status` (enum) - draft/open/full/confirmed/in_progress/completed/cancelled
- `notes` (text) - Optional notes from creator
- `created_at`, `updated_at` (timestamptz)

**`round_invitations`** - Invitation management
- `id` (uuid, primary key)
- `round_id` (uuid, references rounds)
- `invitee_id` (uuid, references users)
- `status` (enum) - pending/accepted/declined/expired
- `message` (text) - Optional message from inviter
- `invited_at`, `responded_at` (timestamptz)

**`round_participants_v2`** - Confirmed participants
- `id` (uuid, primary key)
- `round_id` (uuid, references rounds)
- `user_id` (uuid, references users)
- `is_creator` (boolean)
- `joined_at` (timestamptz)

#### Enums Created

- `round_status`: draft, open, full, confirmed, in_progress, completed, cancelled
- `invitation_status`: pending, accepted, declined, expired
- `cart_preference`: walking, cart, either (reused from Phase 1)

#### Database Triggers

1. **`trg_add_creator_as_participant`** - Auto-adds creator as participant when round is created
2. **`trg_update_round_status_on_participants`** - Updates round status when participant count changes
3. **`trg_add_participant_on_invite_accept`** - Auto-adds user to participants when invitation is accepted

#### RLS Policies

**rounds table:**
- `rounds_select_visible` - Users can see: own rounds, invited rounds, open rounds in same tier
- `rounds_insert_creator` - Only creator can insert
- `rounds_update_creator` - Only creator can update
- `rounds_delete_creator` - Only creator can delete (if not in progress)

**round_invitations table:**
- `invitations_select_involved` - Inviter and invitee can see
- `invitations_insert_creator` - Only round creator can invite
- `invitations_update_involved` - Both parties can update (accept/decline)
- `invitations_delete_creator` - Only creator can delete

**round_participants_v2 table:**
- `participants_v2_select_visible` - Round participants can see each other
- `participants_v2_insert_system` - Insert via trigger only
- `participants_v2_update_creator` - Only creator can update
- `participants_v2_delete_creator` - Only creator can remove participants

### 2. Edge Functions

#### `rounds-create`
**Endpoint:** `POST /functions/v1/rounds-create`

Creates a new round with tier validation and same-tier enforcement.

**Request Body:**
```json
{
  "courseId": "uuid",
  "scheduledAt": "2024-01-15T09:00:00Z",
  "maxPlayers": 4,
  "cartPreference": "either",
  "notes": "Optional notes"
}
```

**Features:**
- Validates user tier (Free cannot create rounds)
- Enforces tier round limits (Select: 4/month)
- Sets tier_id from creator's tier
- Auto-adds creator as participant via trigger

#### `rounds-invite`
**Endpoint:** `POST /functions/v1/rounds-invite`

Invites a user to join a round.

**Request Body:**
```json
{
  "roundId": "uuid",
  "userId": "uuid",
  "message": "Hey, want to join?"
}
```

**Features:**
- Same-tier enforcement: Can only invite users in same tier
- Validates round is open
- Checks spots available
- Sends email notification to invitee
- Prevents duplicate invitations

#### `rounds-respond`
**Endpoint:** `POST /functions/v1/rounds-respond`

Responds to a round invitation.

**Request Body:**
```json
{
  "invitationId": "uuid",
  "action": "accept" // or "decline"
}
```

**Features:**
- Accept: Adds user to participants (via trigger), notifies creator
- Decline: Updates status, notifies creator
- Validates invitation is pending
- Validates round is open

#### `rounds-list`
**Endpoint:** `GET /functions/v1/rounds-list`

Lists rounds visible to the user.

**Query Parameters:**
- `my_rounds=true` - List user's created/participating rounds
- `status=open` - Filter by status
- `date_from=2024-01-01` - Filter start date
- `date_to=2024-12-31` - Filter end date
- `limit=20` - Results per page
- `offset=0` - Pagination offset

**Features:**
- Same-tier visibility for open rounds
- Shows user's role (creator/participant/invited)
- Includes confirmed participant counts

### 3. TypeScript Types

**File:** `packages/types/src/rounds.ts`

#### Core Interfaces

```typescript
interface Round {
  id: UUID;
  creatorId: UUID;
  courseId: UUID;
  scheduledAt: string;
  maxPlayers: number;
  cartPreference: CartPreference;
  tierId: UUID;
  status: RoundStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface RoundInvitation {
  id: UUID;
  roundId: UUID;
  inviteeId: UUID;
  status: InvitationStatus;
  message?: string;
  invitedAt: string;
  respondedAt?: string;
}

interface RoundParticipant {
  id: UUID;
  roundId: UUID;
  userId: UUID;
  isCreator: boolean;
  joinedAt: string;
}
```

#### Input Types

```typescript
interface CreateRoundInput {
  courseId: UUID;
  scheduledAt: string;
  maxPlayers?: number;
  cartPreference?: CartPreference;
  notes?: string;
}

interface InviteToRoundInput {
  roundId: UUID;
  userId: UUID;
  message?: string;
}

interface RespondToRoundInput {
  invitationId: UUID;
  action: 'accept' | 'decline';
}
```

#### Constants & Helpers

```typescript
const ROUND_STATUS_META = { /* status metadata */ };
const INVITATION_STATUS_META = { /* status metadata */ };
const CART_PREFERENCE_OPTIONS = { /* preference labels */ };
const VALID_MAX_PLAYERS = [2, 3, 4];

// Type guards
isValidRoundStatus(status: string): boolean;
isValidInvitationStatus(status: string): boolean;
isValidCartPreference(pref: string): boolean;

// Business logic helpers
canJoinRound(round: Round): boolean;
canEditRound(round: Round, userId: UUID): boolean;
canCancelRound(round: Round, userId: UUID): boolean;
```

## Business Rules Implemented

### Same-Tier Enforcement

1. **Round Creation**: `rounds.tier_id` is automatically set to the creator's tier
2. **Invitations**: Can only invite users with matching `tier_id`
3. **Visibility**: Users can only see open rounds in their tier
4. **RLS Policies**: Database-level enforcement ensures same-tier visibility

### Tier-Based Limits

| Tier | Create Rounds | Max/Month | Can Invite |
|------|--------------|-----------|------------|
| Free | ❌ | 0 | N/A |
| Select | ✅ | 4 | ✅ |
| Summit | ✅ | Unlimited | ✅ |

### Round Status Flow

```
draft → open → full → confirmed → in_progress → completed
                ↓       ↓
            cancelled  cancelled
```

### Participant Management

- Creator is automatically added as first participant
- Accepting invitation adds user to participants
- Round status updates automatically based on participant count
- Max participants: 2, 3, or 4 (set at creation)

## Files Created

```
supabase/migrations/
└── 0020_rounds_coordination.sql    # Database schema

apps/functions/supabase/functions/
├── rounds-create/index.ts         # Create rounds
├── rounds-invite/index.ts         # Send invitations
├── rounds-respond/index.ts        # Accept/decline invites
└── rounds-list/index.ts           # List visible rounds

packages/types/src/
└── rounds.ts                      # Type definitions

scripts/
└── verify-rounds.sh               # Verification script

docs/
└── PHASE2_ROUNDS_IMPLEMENTATION.md # This document
```

## Verification

Run the verification script to confirm all components are in place:

```bash
./scripts/verify-rounds.sh
```

Expected output: 30 tests passed

## API Usage Examples

### Create a Round

```bash
curl -X POST "$SUPABASE_URL/functions/v1/rounds-create" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "uuid-here",
    "scheduledAt": "2024-01-15T09:00:00Z",
    "maxPlayers": 4,
    "cartPreference": "cart",
    "notes": "Early morning round"
  }'
```

### Invite a User

```bash
curl -X POST "$SUPABASE_URL/functions/v1/rounds-invite" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roundId": "round-uuid",
    "userId": "user-uuid",
    "message": "Join us for a round!"
  }'
```

### Respond to Invitation

```bash
curl -X POST "$SUPABASE_URL/functions/v1/rounds-respond" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invitationId": "invite-uuid",
    "action": "accept"
  }'
```

### List Open Rounds

```bash
curl "$SUPABASE_URL/functions/v1/rounds-list" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### List My Rounds

```bash
curl "$SUPABASE_URL/functions/v1/rounds-list?my_rounds=true" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Deployment Steps

1. **Apply Database Migration:**
   ```bash
   supabase db reset
   # or
   supabase db push
   ```

2. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy rounds-create
   supabase functions deploy rounds-invite
   supabase functions deploy rounds-respond
   supabase functions deploy rounds-list
   ```

3. **Verify Deployment:**
   ```bash
   ./scripts/verify-rounds.sh
   ```

## Integration Points

### Phase 1 Integration
- Reuses `cart_preference` enum from networking preferences
- Integrates with existing `golf_courses` table
- Uses existing `membership_tiers` table for same-tier enforcement

### Future Enhancements
- Real-time updates via Supabase Realtime
- Round chat/messaging
- Score tracking integration
- Calendar integration (iCal export)
- Push notifications (mobile)

## Security Considerations

1. **RLS Policies**: Row-level security enforces same-tier visibility at database level
2. **Tier Validation**: Edge functions validate tier before operations
3. **Creator Authorization**: Only round creator can modify/delete round
4. **Invitation Validation**: Only invited users can accept/decline
5. **Input Validation**: All inputs validated with clear error codes
