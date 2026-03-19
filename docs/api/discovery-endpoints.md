# Discovery Endpoints API

API reference for member discovery and search functionality in Spotter.

## Overview

The discovery system enables members to find and connect with other golfers in their tier. Same-tier visibility is enforced at the database level via RLS policies.

---

## Search Members

Discover members matching specific criteria.

### Endpoint

```http
POST /functions/v1/search/members
```

### Authentication

Requires valid JWT token.

### Request Body

```typescript
{
  // Optional filters
  filters?: {
    location?: {
      city?: string;
      state?: string;
      country?: string;
    };
    professional?: {
      industry?: string;
      company?: string;
      yearsExperienceMin?: number;
      yearsExperienceMax?: number;
    };
    golf?: {
      handicapMin?: number;
      handicapMax?: number;
      homeCourseId?: string;
      playFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'occasionally';
    };
  };
  
  // Sorting
  sort?: {
    field: 'reputation' | 'joinedAt' | 'handicap' | 'connectionsCount';
    order: 'asc' | 'desc';
  };
  
  // Pagination
  pagination?: {
    page: number;
    perPage: number; // Max: 100
  };
}
```

### Response

```typescript
{
  data: {
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      tier: {
        slug: 'free' | 'select' | 'summit';
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
        playFrequency: string | null;
      } | null;
      reputation: {
        overallScore: number;
        networkSize: number;
      };
      joinedAt: string;
      isConnected: boolean;
      connectionPending: boolean;
    }>;
    
    meta: {
      total: number;
      page: number;
      perPage: number;
      totalPages: number;
    };
    
    // Tier-specific limits
    limits: {
      maxResults: number | null; // null = unlimited
      currentResults: number;
      remaining: number | null;
    };
  };
}
```

### Example Request

```bash
curl -X POST https://<project>.supabase.co/functions/v1/search/members \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "location": {
        "city": "Scottsdale",
        "state": "AZ"
      },
      "golf": {
        "handicapMin": 5,
        "handicapMax": 20,
        "playFrequency": "weekly"
      }
    },
    "sort": {
      "field": "reputation",
      "order": "desc"
    },
    "pagination": {
      "page": 1,
      "perPage": 20
    }
  }'
```

### Tier Restrictions

| Tier | Max Results | Notes |
|------|-------------|-------|
| FREE | 20 | Hard limit per search |
| SELECT | Unlimited | Full access |
| SUMMIT | Unlimited | Includes priority results |

---

## Get Recommended Connections

Get AI-powered connection recommendations based on profile similarity and mutual connections.

### Endpoint

```http
GET /functions/v1/discovery/recommendations
```

### Query Parameters

```typescript
{
  limit?: number; // Default: 10, Max: 50
}
```

### Response

```typescript
{
  data: {
    recommendations: Array<{
      user: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        tier: {
          slug: string;
          name: string;
        };
      };
      reasons: Array<{
        type: 'similar_handicap' | 'same_city' | 'mutual_connection' | 'similar_professional' | 'played_same_course';
        description: string;
        strength: 'high' | 'medium' | 'low';
      }>;
      matchScore: number; // 0-100
    }>;
  };
}
```

---

## Get Trending Members

Discover active members in your network/tier.

### Endpoint

```http
GET /functions/v1/discovery/trending
```

### Query Parameters

```typescript
{
  period?: 'day' | 'week' | 'month'; // Default: week
  limit?: number; // Default: 20, Max: 100
}
```

### Response

```typescript
{
  data: {
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      tier: {
        slug: string;
        name: string;
      };
      activity: {
        roundsCreated: number;
        roundsJoined: number;
        connectionsMade: number;
        eventsAttended: number;
      };
      trendScore: number;
    }>;
    period: string;
    generatedAt: string;
  };
}
```

---

## Get New Members

See recently joined members in your tier.

### Endpoint

```http
GET /functions/v1/discovery/new-members
```

### Query Parameters

```typescript
{
  since?: string; // ISO date, default: 7 days ago
  limit?: number; // Default: 20, Max: 50
}
```

### Response

```typescript
{
  data: {
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      tier: {
        slug: string;
        name: string;
      };
      professional: {
        company: string | null;
        title: string | null;
        industry: string | null;
      } | null;
      joinedAt: string;
      profileCompleteness: number;
    }>;
    totalNew: number;
  };
}
```

---

## Get Members by Location

Find members near a specific location.

### Endpoint

```http
GET /functions/v1/discovery/nearby
```

### Query Parameters

```typescript
{
  lat: number; // Required: Latitude
  lng: number; // Required: Longitude
  radius?: number; // Optional: Radius in miles, default: 25, max: 100
  limit?: number; // Default: 50, Max: 100
}
```

### Response

```typescript
{
  data: {
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      distance: number; // Miles
      city: string;
      state: string;
      handicap: number | null;
      homeCourse: string | null;
    }>;
    search: {
      center: {
        lat: number;
        lng: number;
      };
      radius: number;
      totalFound: number;
    };
  };
}
```

---

## Get Members by Course

Find members who play at a specific golf course.

### Endpoint

```http
GET /functions/v1/discovery/by-course/:courseId
```

### Query Parameters

```typescript
{
  limit?: number; // Default: 50, Max: 100
}
```

### Response

```typescript
{
  data: {
    course: {
      id: string;
      name: string;
      city: string;
      state: string;
    };
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      handicap: number | null;
      playFrequency: string | null;
      joinedAt: string;
    }>;
    totalMembers: number;
  };
}
```

---

## Get Members by Industry

Find members in specific professional industries.

### Endpoint

```http
GET /functions/v1/discovery/by-industry
```

### Query Parameters

```typescript
{
  industry: string; // Required
  limit?: number; // Default: 50, Max: 100
}
```

### Supported Industries

- Technology
- Finance
- Healthcare
- Real Estate
- Legal
- Marketing
- Consulting
- Manufacturing
- Retail
- Other

### Response

```typescript
{
  data: {
    industry: string;
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      company: string | null;
      title: string | null;
      yearsExperience: number | null;
      handicap: number | null;
      joinedAt: string;
    }>;
    totalMembers: number;
  };
}
```

---

## Error Responses

### Common Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `invalid_filters` | Invalid filter parameters |
| 401 | `unauthorized` | Invalid or expired token |
| 403 | `tier_restricted` | Feature not available in current tier |
| 429 | `rate_limited` | Too many requests |

### Example Error

```json
{
  "error": {
    "code": "tier_restricted",
    "message": "Advanced search filters require SELECT tier or higher",
    "currentTier": "free",
    "requiredTier": "select"
  }
}
```

---

## Rate Limits

| Tier | Requests per minute | Notes |
|------|---------------------|-------|
| FREE | 30 | Basic discovery |
| SELECT | 100 | Full search capabilities |
| SUMMIT | 200 | Priority with burst |

---

## Related Documentation

- [Matching Endpoints](./matching-endpoints.md) - Connection matching
- [Member Guide](../guides/member-guide.md) - User guide
- [Discovery Guide](../guides/discovery-guide.md) - How to find golf partners
