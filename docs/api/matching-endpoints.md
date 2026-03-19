# Matching Endpoints API

API reference for connection matching and introduction requests in Spotter.

## Overview

The matching system facilitates connections between members within the same tier. It includes direct connection requests, introduction requests (via mutual connections), and connection management.

---

## Send Connection Request

Send a connection request to another member.

### Endpoint

```http
POST /functions/v1/connection-request
```

### Authentication

Requires valid JWT token.

### Request Body

```typescript
{
  receiverId: string; // UUID of target member
  connectionType: 'played_together' | 'business' | 'social' | 'coaching' | 'other';
  message?: string; // Optional: Personal note (max 500 chars)
}
```

### Response - Success (201)

```typescript
{
  success: true;
  data: {
    id: string; // Connection request ID
    status: 'pending';
    receiver: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
    connectionType: string;
    message: string | null;
    requestedAt: string;
    expiresAt: string; // 7 days from request
  };
}
```

### Response - Already Connected

```typescript
{
  success: false;
  error: {
    code: 'already_connected';
    message: 'You are already connected with this member';
    connectionId: string;
  };
}
```

### Response - Request Pending

```typescript
{
  success: false;
  error: {
    code: 'request_pending';
    message: 'A connection request is already pending';
    requestId: string;
    sentAt: string;
  };
}
```

### Response - Tier Mismatch

```typescript
{
  success: false;
  error: {
    code: 'tier_mismatch';
    message: 'You can only connect with members in your tier';
    yourTier: string;
    theirTier: string;
  };
}
```

---

## List Connection Requests

View incoming and outgoing connection requests.

### Endpoint

```http
GET /functions/v1/connections/requests
```

### Query Parameters

```typescript
{
  direction?: 'incoming' | 'outgoing' | 'all'; // Default: all
  status?: 'pending' | 'accepted' | 'declined' | 'expired'; // Default: pending
  page?: number; // Default: 1
  per_page?: number; // Default: 20, Max: 50
}
```

### Response

```typescript
{
  data: {
    requests: Array<{
      id: string;
      direction: 'incoming' | 'outgoing';
      status: string;
      otherUser: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        professional: {
          company: string | null;
          title: string | null;
        } | null;
      };
      connectionType: string;
      message: string | null;
      requestedAt: string;
      respondedAt: string | null;
      expiresAt: string;
    }>;
    
    meta: {
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    };
    
    summary: {
      incomingPending: number;
      outgoingPending: number;
    };
  };
}
```

---

## Respond to Connection Request

Accept or decline a connection request.

### Endpoint

```http
POST /functions/v1/connection-respond
```

### Request Body

```typescript
{
  requestId: string; // Connection request ID
  action: 'accept' | 'decline';
  message?: string; // Optional: Response message
}
```

### Response - Accepted

```typescript
{
  success: true;
  data: {
    connection: {
      id: string;
      status: 'accepted';
      connectedUser: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
      connectionType: string;
      acceptedAt: string;
    };
    reputationUpdate: {
      previousScore: number;
      newScore: number;
      pointsGained: number;
    };
  };
}
```

### Response - Declined

```typescript
{
  success: true;
  data: {
    requestId: string;
    status: 'declined';
    declinedAt: string;
    canRequestAgainAfter: string; // 30 days from decline
  };
}
```

---

## List Connections

View your current connections.

### Endpoint

```http
GET /functions/v1/connections
```

### Query Parameters

```typescript
{
  status?: 'accepted' | 'blocked'; // Default: accepted
  connectionType?: string; // Filter by type
  search?: string; // Search by name
  page?: number; // Default: 1
  per_page?: number; // Default: 20, Max: 100
  sort?: 'connected_at' | 'name' | 'recent_activity'; // Default: connected_at
  order?: 'asc' | 'desc'; // Default: desc
}
```

### Response

```typescript
{
  data: {
    connections: Array<{
      id: string;
      connectedUser: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        bio: string | null;
        tier: {
          slug: string;
          name: string;
        };
        professional: {
          company: string | null;
          title: string | null;
          industry: string | null;
        } | null;
        golf: {
          handicap: number | null;
          homeCourseName: string | null;
        } | null;
        reputation: {
          overallScore: number;
        };
      };
      connectionType: string;
      connectedAt: string;
      lastInteractionAt: string | null;
      roundsPlayedTogether: number;
      notes: string | null; // Private notes about connection
    }>;
    
    meta: {
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    };
    
    limits: {
      maxConnections: number | null;
      currentConnections: number;
      remaining: number | null;
    };
  };
}
```

### Tier Limits

| Tier | Max Connections |
|------|-----------------|
| FREE | 50 |
| SELECT | 500 |
| SUMMIT | Unlimited |

---

## Get Connection Details

View details of a specific connection.

### Endpoint

```http
GET /functions/v1/connections/:connectionId
```

### Response

```typescript
{
  data: {
    connection: {
      id: string;
      status: string;
      connectedUser: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        email: string | null; // Only if shared
        phone: string | null; // Only if shared
        tier: {
          slug: string;
          name: string;
        };
        professional: object | null;
        golf: object | null;
        joinedAt: string;
      };
      connectionType: string;
      connectedAt: string;
      
      // Activity with this connection
      activity: {
        roundsTogether: Array<{
          roundId: string;
          courseName: string;
          date: string;
          format: string;
        }>;
        messagesExchanged: number;
        lastMessageAt: string | null;
      };
      
      // Mutual connections
      mutualConnections: Array<{
        id: string;
        displayName: string;
        avatarUrl: string | null;
      }>;
      mutualCount: number;
    };
  };
}
```

---

## Remove Connection

Remove a connection (unfriend).

### Endpoint

```http
DELETE /functions/v1/connections/:connectionId
```

### Response

```typescript
{
  success: true;
  data: {
    removed: true;
    removedAt: string;
    reputationUpdate: {
      previousScore: number;
      newScore: number;
      pointsLost: number;
    };
  };
}
```

---

## Request Introduction (SELECT+)

Request an introduction to a member through a mutual connection.

### Endpoint

```http
POST /functions/v1/connections/introduction-request
```

### Request Body

```typescript
{
  targetUserId: string; // Who you want to meet
  connectorUserId: string; // Mutual connection who will introduce
  reason: string; // Why you want to connect (required)
  message?: string; // Additional context
}
```

### Response

```typescript
{
  success: true;
  data: {
    introductionRequest: {
      id: string;
      status: 'pending_connector';
      targetUser: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
      connectorUser: {
        id: string;
        displayName: string;
      };
      reason: string;
      requestedAt: string;
    };
  };
}
```

### Tier Requirement

Introduction requests require **SELECT** tier or higher.

---

## Respond to Introduction Request (Connector)

As a mutual connection, approve or decline an introduction request.

### Endpoint

```http
POST /functions/v1/connections/introduction-respond
```

### Request Body

```typescript
{
  introductionRequestId: string;
  action: 'approve' | 'decline';
  message?: string; // Context for both parties
}
```

### Response - Approved

```typescript
{
  success: true;
  data: {
    status: 'approved';
    approvedAt: string;
    introduction: {
      introMessage: string; // Combined context
      requestor: { /* user */ };
      target: { /* user */ };
    };
    // Both parties can now connect
    canConnect: true;
  };
}
```

---

## Get Introduction Requests

View introduction requests as requestor or connector.

### Endpoint

```http
GET /functions/v1/connections/introduction-requests
```

### Query Parameters

```typescript
{
  role?: 'requestor' | 'connector' | 'all'; // Default: all
  status?: 'pending' | 'approved' | 'declined'; // Default: pending
}
```

### Response

```typescript
{
  data: {
    requests: Array<{
      id: string;
      role: 'requestor' | 'connector';
      status: string;
      targetUser: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
      };
      connectorUser: {
        id: string;
        displayName: string;
      };
      reason: string;
      requestedAt: string;
      respondedAt: string | null;
    }>;
  };
}
```

---

## Block Member

Block a member from connecting with you.

### Endpoint

```http
POST /functions/v1/connections/block
```

### Request Body

```typescript
{
  userId: string; // Member to block
  reason?: string; // Optional: for internal review
}
```

### Response

```typescript
{
  success: true;
  data: {
    blocked: true;
    blockedAt: string;
    // If they were a connection, they're removed
    previousConnectionRemoved: boolean;
  };
}
```

---

## Unblock Member

Remove a block.

### Endpoint

```http
DELETE /functions/v1/connections/block/:userId
```

### Response

```typescript
{
  success: true;
  data: {
    unblocked: true;
    unblockedAt: string;
  };
}
```

---

## Get Blocked List

View members you've blocked.

### Endpoint

```http
GET /functions/v1/connections/blocked
```

### Response

```typescript
{
  data: {
    blocked: Array<{
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      blockedAt: string;
      reason: string | null;
    }>;
    total: number;
  };
}
```

---

## Connection Analytics

Get insights about your network.

### Endpoint

```http
GET /functions/v1/connections/analytics
```

### Response

```typescript
{
  data: {
    overview: {
      totalConnections: number;
      connectionsThisMonth: number;
      averageResponseTime: number; // Hours
      acceptanceRate: number; // Percentage
    };
    
    byIndustry: Array<{
      industry: string;
      count: number;
    }>;
    
    byLocation: Array<{
      city: string;
      state: string;
      count: number;
    }>;
    
    byHandicap: {
      average: number;
      range: string;
    };
    
    recentActivity: Array<{
      type: 'new_connection' | 'round_together' | 'message';
      user: object;
      occurredAt: string;
    }>;
  };
}
```

---

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `invalid_user_id` | Target user not found |
| 400 | `self_connection` | Cannot connect to yourself |
| 401 | `unauthorized` | Invalid token |
| 403 | `tier_mismatch` | Different tier connection blocked |
| 403 | `limit_reached` | Connection limit reached |
| 403 | `blocked` | You've blocked or been blocked |
| 403 | `introduction_required` | SELECT+ tier needed for intro requests |
| 404 | `connection_not_found` | Connection doesn't exist |
| 409 | `already_connected` | Already connected |
| 409 | `request_pending` | Request already sent |

---

## Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Send connection requests | 20 | per day |
| Send introduction requests | 5 | per day |
| List connections | 100 | per minute |

---

## Webhooks

Connection events trigger webhooks:

```typescript
// connection.requested
{
  type: 'connection.requested';
  data: {
    requestId: string;
    requestor: object;
    receiver: object;
    connectionType: string;
  };
}

// connection.accepted
{
  type: 'connection.accepted';
  data: {
    connectionId: string;
    users: [object, object];
    connectionType: string;
  };
}

// connection.introduction_approved
{
  type: 'connection.introduction_approved';
  data: {
    introductionId: string;
    requestor: object;
    target: object;
    connector: object;
  };
}
```

---

## Related Documentation

- [Discovery Endpoints](./discovery-endpoints.md) - Find members
- [Member Guide](../guides/member-guide.md) - User guide
- [Matching Guide](../guides/matching-guide.md) - Understanding compatibility
