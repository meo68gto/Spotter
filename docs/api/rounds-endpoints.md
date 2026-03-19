# Rounds Endpoints API

API reference for golf rounds - creating, joining, and managing rounds in Spotter.

## Overview

The rounds system enables members to create and join golf rounds. Round creation is a SELECT+ feature, while joining is available to all tiers.

---

## Create Round (SELECT+)

Create a new golf round.

### Endpoint

```http
POST /functions/v1/round-create
```

### Authentication

Requires valid JWT token and SELECT or SUMMIT tier.

### Request Body

```typescript
{
  courseId: string; // Required: UUID of golf course
  roundDate: string; // Required: ISO date (YYYY-MM-DD)
  teeTime: string; // Required: HH:MM format
  format: 'stroke_play' | 'match_play' | 'scramble' | 'shamble' | 'best_ball';
  totalSpots: number; // Required: 2-24
  isPrivate: boolean; // Default: false
  notes?: string; // Optional: Public notes about the round
  targetTiers?: string[]; // Optional: Limit to specific tiers (default: all)
  requireApproval?: boolean; // Optional: Require organizer approval to join
}
```

### Response - Success (201)

```typescript
{
  success: true;
  data: {
    round: {
      id: string;
      course: {
        id: string;
        name: string;
        city: string;
        state: string;
      };
      roundDate: string;
      teeTime: string;
      format: string;
      totalSpots: number;
      spotsAvailable: number;
      spotsFilled: number;
      isPrivate: boolean;
      inviteCode: string | null; // Only if private
      notes: string | null;
      status: 'open' | 'full' | 'cancelled' | 'completed';
      organizer: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
      participants: Array<{
        userId: string;
        displayName: string;
        avatarUrl: string | null;
        joinedAt: string;
      }>;
      createdAt: string;
    };
    
    limits: {
      roundsThisMonth: number;
      roundsLimit: number | null;
      remainingThisMonth: number | null;
    };
  };
}
```

### Response - Tier Restriction

```typescript
{
  success: false;
  error: {
    code: 'tier_upgrade_required';
    message: 'Round creation requires SELECT tier or higher';
    currentTier: 'free';
    requiredTier: 'select';
    upgradeUrl: 'https://checkout.stripe.com/...';
  };
}
```

### Response - Monthly Limit Reached (SELECT)

```typescript
{
  success: false;
  error: {
    code: 'monthly_limit_reached';
    message: 'You have reached your monthly round creation limit';
    roundsCreated: 4;
    roundsLimit: 4;
    resetsOn: '2024-04-01';
    upgradeUrl: 'https://checkout.stripe.com/...';
  };
}
```

---

## List Available Rounds

Browse rounds available to join.

### Endpoint

```http
GET /functions/v1/rounds
```

### Query Parameters

```typescript
{
  // Location filters
  city?: string;
  state?: string;
  lat?: number; // Latitude
  lng?: number; // Longitude
  radius?: number; // Miles from lat/lng
  
  // Date filters
  dateFrom?: string; // ISO date
  dateTo?: string; // ISO date
  
  // Round filters
  courseId?: string;
  format?: string;
  spotsMin?: number;
  spotsAvailable?: boolean; // Only show rounds with spots
  
  // Tier filters (for organizers)
  myRounds?: boolean; // Only rounds I created
  joinedRounds?: boolean; // Only rounds I've joined
  
  // Pagination
  page?: number; // Default: 1
  per_page?: number; // Default: 20, Max: 50
  
  // Sorting
  sort?: 'date' | 'created' | 'spots' | 'distance'; // Default: date
  order?: 'asc' | 'desc'; // Default: asc
}
```

### Response

```typescript
{
  data: {
    rounds: Array<{
      id: string;
      course: {
        id: string;
        name: string;
        city: string;
        state: string;
        imageUrl: string | null;
      };
      roundDate: string;
      teeTime: string;
      format: string;
      spotsAvailable: number;
      spotsFilled: number;
      totalSpots: number;
      isPrivate: boolean;
      status: string;
      organizer: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        reputationScore: number;
      };
      targetTiers: string[];
      createdAt: string;
      
      // If user has joined
      userJoined?: boolean;
      userJoinedAt?: string;
      
      // Distance if lat/lng provided
      distanceMiles?: number;
    }>;
    
    meta: {
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    };
  };
}
```

---

## Get Round Details

View detailed information about a specific round.

### Endpoint

```http
GET /functions/v1/rounds/:roundId
```

### Response

```typescript
{
  data: {
    round: {
      id: string;
      course: {
        id: string;
        name: string;
        address: string;
        city: string;
        state: string;
        zipCode: string;
        phone: string | null;
        website: string | null;
        amenities: {
          drivingRange: boolean;
          proShop: boolean;
          restaurant: boolean;
          bar: boolean;
        };
        difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
        parTotal: number;
        courseRating: number | null;
        slopeRating: number | null;
        images: string[];
      };
      roundDate: string;
      teeTime: string;
      format: string;
      totalSpots: number;
      spotsAvailable: number;
      spotsFilled: number;
      isPrivate: boolean;
      notes: string | null;
      status: string;
      targetTiers: string[];
      requireApproval: boolean;
      createdAt: string;
      updatedAt: string;
      
      organizer: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        bio: string | null;
        handicap: number | null;
        reputationScore: number;
        tier: {
          slug: string;
          name: string;
        };
      };
      
      participants: Array<{
        userId: string;
        displayName: string;
        avatarUrl: string | null;
        handicap: number | null;
        joinedAt: string;
        isOrganizer: boolean;
      }>;
      
      // User's relationship to this round
      userStatus: 'none' | 'joined' | 'pending' | 'organizer';
      
      // If private and user is organizer
      inviteCode?: string;
    };
  };
}
```

---

## Join Round

Join an available round.

### Endpoint

```http
POST /functions/v1/round-join
```

### Request Body

```typescript
{
  roundId: string; // Required
  inviteCode?: string; // Required if round is private
  message?: string; // Optional: Message to organizer if approval required
}
```

### Response - Success (Joined)

```typescript
{
  success: true;
  data: {
    status: 'joined';
    round: {
      id: string;
      courseName: string;
      roundDate: string;
      teeTime: string;
    };
    joinedAt: string;
    spotsRemaining: number;
    
    // Create inbox thread for round chat
    threadId: string;
    message: 'You have joined the round. Check your inbox for the group chat.';
  };
}
```

### Response - Pending Approval

```typescript
{
  success: true;
  data: {
    status: 'pending';
    round: {
      id: string;
      courseName: string;
    };
    requestedAt: string;
    message: 'Your request to join has been sent to the organizer for approval.';
  };
}
```

### Response - Round Full

```typescript
{
  success: false;
  error: {
    code: 'round_full';
    message: 'This round is full';
    totalSpots: 4;
    spotsFilled: 4;
  };
}
```

### Response - Already Joined

```typescript
{
  success: false;
  error: {
    code: 'already_joined';
    message: 'You have already joined this round';
  };
}
```

### Response - Invalid Invite Code

```typescript
{
  success: false;
  error: {
    code: 'invalid_invite_code';
    message: 'Invalid or expired invite code';
  };
}
```

---

## Leave Round

Remove yourself from a round.

### Endpoint

```http
DELETE /functions/v1/rounds/:roundId/participation
```

### Response

```typescript
{
  success: true;
  data: {
    left: true;
    leftAt: string;
    spotsRemaining: number;
    
    // If organizer left, round may be cancelled
    roundStatus: 'open' | 'cancelled';
    roundCancelled: boolean;
  };
}
```

### Notes

- Organizers cannot leave their own round (must cancel instead)
- Leaving within 24 hours of tee time may affect reputation
- Affects completion rate metrics

---

## Cancel Round (Organizer Only)

Cancel a round you created.

### Endpoint

```http
POST /functions/v1/rounds/:roundId/cancel
```

### Request Body

```typescript
{
  reason?: string; // Optional: Reason for cancellation
  notifyParticipants?: boolean; // Default: true
}
```

### Response

```typescript
{
  success: true;
  data: {
    roundId: string;
    status: 'cancelled';
    cancelledAt: string;
    participantsNotified: number;
    refundsProcessed: number; // If paid rounds
  };
}
```

---

## Update Round (Organizer Only)

Modify round details.

### Endpoint

```http
PATCH /functions/v1/rounds/:roundId
```

### Request Body

```typescript
{
  // Only these fields can be updated
  teeTime?: string;
  notes?: string;
  isPrivate?: boolean;
  requireApproval?: boolean;
}
```

### Response

```typescript
{
  success: true;
  data: {
    round: {
      id: string;
      // Updated fields
    };
    updatedAt: string;
    participantsNotified: boolean;
  };
}
```

---

## Manage Join Requests (Organizer Only)

Approve or decline join requests for rounds requiring approval.

### Endpoint

```http
POST /functions/v1/rounds/:roundId/join-requests/:requestId/respond
```

### Request Body

```typescript
{
  action: 'approve' | 'decline';
  message?: string; // Optional: Response message
}
```

### Response

```typescript
{
  success: true;
  data: {
    requestId: string;
    action: 'approved' | 'declined';
    user: {
      id: string;
      displayName: string;
    };
    processedAt: string;
  };
}
```

---

## Get Join Requests (Organizer Only)

List pending join requests for your round.

### Endpoint

```http
GET /functions/v1/rounds/:roundId/join-requests
```

### Response

```typescript
{
  data: {
    requests: Array<{
      id: string;
      user: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        handicap: number | null;
        reputationScore: number;
        joinedAt: string; // Platform join date
      };
      message: string | null;
      requestedAt: string;
    }>;
    totalPending: number;
  };
}
```

---

## Get My Rounds

Get all rounds the user is participating in or organizing.

### Endpoint

```http
GET /functions/v1/rounds/my-rounds
```

### Query Parameters

```typescript
{
  status?: 'upcoming' | 'past' | 'all'; // Default: upcoming
  role?: 'organizer' | 'participant' | 'all'; // Default: all
  page?: number;
  per_page?: number; // Default: 20, Max: 50
}
```

### Response

```typescript
{
  data: {
    rounds: Array<{
      id: string;
      course: {
        id: string;
        name: string;
        city: string;
        state: string;
        imageUrl: string | null;
      };
      roundDate: string;
      teeTime: string;
      format: string;
      status: string;
      isOrganizer: boolean;
      participantCount: number;
      totalSpots: number;
      
      // Round statistics
      stats: {
        roundsPlayed?: number;
        averageScore?: number;
        bestScore?: number;
      } | null;
    }>;
    
    meta: {
      total: number;
      page: number;
      per_page: number;
    };
    
    // Rounds statistics
    summary: {
      totalRounds: number;
      roundsAsOrganizer: number;
      roundsAsParticipant: number;
      completionRate: number; // Percentage
    };
  };
}
```

---

## Get Round Invites

Get invite code and shareable link for private rounds.

### Endpoint

```http
GET /functions/v1/rounds/:roundId/invite
```

### Response

```typescript
{
  data: {
    roundId: string;
    inviteCode: string;
    inviteUrl: string; // spotter://round/join?code=XXX
    shareMessage: string; // Pre-formatted share text
    expiresAt: string | null;
    usesRemaining: number | null; // If limited
  };
}
```

---

## Regenerate Invite Code

Generate a new invite code (invalidates old one).

### Endpoint

```http
POST /functions/v1/rounds/:roundId/invite/regenerate
```

### Response

```typescript
{
  success: true;
  data: {
    previousCode: string;
    newCode: string;
    inviteUrl: string;
    regeneratedAt: string;
  };
}
```

---

## Record Round Results

Submit scores after a round is completed.

### Endpoint

```http
POST /functions/v1/rounds/:roundId/results
```

### Request Body

```typescript
{
  scores: Array<{
    userId: string; // Can only submit own or all if organizer
    grossScore: number;
    netScore?: number; // Optional with handicap
    putts?: number;
    fairwaysHit?: number;
    greensInRegulation?: number;
  }>;
  notes?: string;
}
```

### Response

```typescript
{
  success: true;
  data: {
    roundId: string;
    resultsRecorded: boolean;
    stats: {
      winner?: {
        userId: string;
        displayName: string;
        score: number;
      };
    };
    reputationUpdates: Array<{
      userId: string;
      pointsGained: number;
    }>;
  };
}
```

---

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `invalid_date` | Round date is in the past |
| 400 | `invalid_time` | Invalid tee time format |
| 400 | `course_not_found` | Course ID doesn't exist |
| 401 | `unauthorized` | Invalid token |
| 403 | `not_organizer` | Only organizer can perform this action |
| 403 | `tier_upgrade_required` | Need SELECT+ to create rounds |
| 403 | `monthly_limit_reached` | SELECT monthly limit reached |
| 404 | `round_not_found` | Round doesn't exist |
| 409 | `already_joined` | Already in this round |
| 409 | `round_full` | No spots available |
| 409 | `round_cancelled` | Round has been cancelled |
| 409 | `round_completed` | Round already played |

---

## Round Statuses

| Status | Description |
|--------|-------------|
| `open` | Accepting participants |
| `full` | All spots filled |
| `in_progress` | Round is happening now |
| `completed` | Round finished, results recorded |
| `cancelled` | Cancelled by organizer |

---

## Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Create round | Per tier limits | Monthly |
| Join round | 50 | per day |
| List rounds | 100 | per minute |
| Cancel round | 5 | per day |

---

## Webhooks

Round events trigger webhooks:

```typescript
// round.created
{
  type: 'round.created';
  data: {
    roundId: string;
    organizer: object;
    course: object;
    roundDate: string;
    spotsAvailable: number;
  };
}

// round.joined
{
  type: 'round.joined';
  data: {
    roundId: string;
    user: object;
    spotsRemaining: number;
  };
}

// round.cancelled
{
  type: 'round.cancelled';
  data: {
    roundId: string;
    organizer: object;
    reason: string | null;
    affectedUsers: number;
  };
}

// round.completed
{
  type: 'round.completed';
  data: {
    roundId: string;
    course: object;
    participants: object[];
    results: object;
  };
}
```

---

## Related Documentation

- [Member Guide](../guides/member-guide.md) - User guide
- [Rounds Guide](../guides/rounds-guide.md) - Scheduling games
- [Discovery Endpoints](./discovery-endpoints.md) - Find members
