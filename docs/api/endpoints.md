# API Endpoints Reference

Complete reference for all Spotter API endpoints organized by domain.

## Table of Contents

- [Authentication](#authentication)
- [User Profiles](#user-profiles)
- [Tiers](#tiers)
- [Golf](#golf)
- [Connections](#connections)
- [Rounds](#rounds)
- [Organizers](#organizers)
- [Events](#events)
- [Inbox](#inbox)
- [Admin](#admin)

---

## Authentication

### Request OTP

Send a one-time password to user's email.

```http
POST /functions/v1/auth-otp
```

**Request:**
```json
{
  "email": "user@example.com",
  "action": "signup"  // or "signin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Check your email for the login code"
}
```

### Verify OTP

Verify the OTP code and receive session.

```http
POST /functions/v1/auth-otp
```

**Request:**
```json
{
  "email": "user@example.com",
  "token": "123456",
  "action": "verify"
}
```

**Response:**
```json
{
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "-Jx...",
    "expires_at": 1710807600
  },
  "user": { ... }
}
```

---

## User Profiles

### Get Current User Profile

```http
GET /functions/v1/profile/get
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "avatarUrl": "https://...",
    "bio": "Avid golfer...",
    "professionalIdentity": {
      "company": "Acme Inc",
      "title": "CEO",
      "industry": "Technology",
      "yearsExperience": 10
    },
    "golfIdentity": {
      "handicap": 12.4,
      "homeCourseId": "uuid",
      "homeCourseName": "TPC Scottsdale",
      "playingFrequency": "weekly",
      "yearsPlaying": 15
    },
    "tier": {
      "slug": "select",
      "name": "Select",
      "cardColor": "#F59E0B"
    },
    "reputation": {
      "overallScore": 85,
      "networkSize": 42
    },
    "profileCompleteness": 75
  }
}
```

### Get Another User's Profile

```http
GET /functions/v1/profile/get/:userId
Authorization: Bearer <token>
```

**Note**: Same-tier visibility enforced. Returns 403 if user is in different tier.

### Update Profile

```http
POST /functions/v1/profile/update
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "displayName": "John Doe",
  "bio": "Avid golfer and entrepreneur",
  "professional": {
    "company": "Acme Inc",
    "title": "CEO",
    "industry": "Technology",
    "yearsExperience": 10
  },
  "golf": {
    "handicap": 12.4,
    "homeCourseId": "uuid",
    "playFrequency": "weekly",
    "yearsPlaying": 15
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": { ...updated profile... }
}
```

---

## Tiers

### Get All Tiers

```http
GET /functions/v1/tier-assignment
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Free",
      "slug": "free",
      "price_cents": 0,
      "billing_interval": "annual",
      "features": {
        "maxSearchResults": 20,
        "maxConnections": 50,
        "canCreateRounds": false
      }
    },
    {
      "id": "uuid",
      "name": "Select",
      "slug": "select",
      "price_cents": 100000,
      "billing_interval": "annual",
      "features": {
        "maxSearchResults": null,
        "maxConnections": 500,
        "canCreateRounds": true,
        "maxRoundsPerMonth": 4
      }
    },
    {
      "id": "uuid",
      "name": "Summit",
      "slug": "summit",
      "price_cents": 1000000,
      "billing_interval": "lifetime",
      "features": {
        "maxSearchResults": null,
        "maxConnections": null,
        "canCreateRounds": true,
        "priorityBoosts": true
      }
    }
  ]
}
```

### Initiate Tier Upgrade

Creates a Stripe Checkout session for tier upgrade.

```http
POST /functions/v1/tier-upgrade
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "targetTier": "select",
  "successUrl": "https://spotter.golf/tier/success",
  "cancelUrl": "https://spotter.golf/tier/cancel"
}
```

**Response:**
```json
{
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/...",
    "sessionId": "cs_..."
  }
}
```

### Get Tier History

```http
GET /functions/v1/tier-history
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "previous_tier": "free",
      "new_tier": "select",
      "change_reason": "stripe_checkout_completed",
      "changed_at": "2024-03-18T20:00:00Z",
      "stripe_checkout_session_id": "cs_..."
    }
  ]
}
```

---

## Golf

### List Golf Courses

```http
GET /functions/v1/golf-courses?city=Scottsdale&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "TPC Scottsdale",
      "city": "Scottsdale",
      "state": "AZ",
      "par_total": 71,
      "course_rating": 74.6,
      "slope_rating": 135,
      "difficulty": "expert",
      "amenities": {
        "driving_range": true,
        "pro_shop": true
      },
      "images": ["https://..."]
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "per_page": 20
  }
}
```

### Get Course Details

```http
GET /functions/v1/golf-courses/:courseId
Authorization: Bearer <token>
```

---

## Connections

### Send Connection Request

```http
POST /functions/v1/connection-request
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "receiverId": "uuid",
  "connectionType": "played_together",
  "message": "Great playing with you today!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending",
    "requestedAt": "2024-03-18T20:00:00Z"
  }
}
```

### List Connections

```http
GET /functions/v1/connections?status=accepted
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "displayName": "Jane Smith",
      "avatarUrl": "https://...",
      "professional": {
        "company": "Tech Corp",
        "title": "VP Sales"
      },
      "connectionType": "played_together",
      "connectedAt": "2024-03-10T15:30:00Z"
    }
  ]
}
```

### Respond to Connection Request

```http
POST /functions/v1/connection-respond
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "connectionId": "uuid",
  "action": "accept"  // or "decline"
}
```

---

## Rounds

### Create Golf Round

```http
POST /functions/v1/round-create
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "courseId": "uuid",
  "roundDate": "2024-03-25",
  "teeTime": "08:00",
  "format": "stroke_play",
  "totalSpots": 4,
  "isPrivate": false,
  "notes": "Looking for competitive players"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "open",
    "spotsAvailable": 3,
    "inviteCode": "ABCD1234"
  }
}
```

### List Available Rounds

```http
GET /functions/v1/rounds?city=Scottsdale&date_from=2024-03-25
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "course": {
        "id": "uuid",
        "name": "TPC Scottsdale"
      },
      "roundDate": "2024-03-25",
      "teeTime": "08:00",
      "format": "stroke_play",
      "spotsAvailable": 2,
      "organizer": {
        "id": "uuid",
        "displayName": "John Doe"
      }
    }
  ]
}
```

### Join Round

```http
POST /functions/v1/round-join
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "roundId": "uuid",
  "inviteCode": "ABCD1234"  // optional for private rounds
}
```

---

## Organizers

### Create Organizer Account

```http
POST /functions/v1/organizer-create
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Phoenix Golf Association",
  "slug": "phoenix-golf-assoc",
  "description": "Organizing tournaments since 2020",
  "website": "https://phoenixgolf.example.com",
  "email": "contact@phoenixgolf.example.com",
  "tier": "bronze",  // or "silver", "gold"
  "address": {
    "city": "Phoenix",
    "state": "AZ",
    "country": "US"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending",
    "tier": "bronze"
  }
}
```

### Get Organizer Dashboard

```http
GET /functions/v1/organizer-dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "organizer": { ... },
    "stats": {
      "totalEvents": 12,
      "totalRegistrations": 450,
      "activeEvents": 3
    },
    "quotas": {
      "eventsUsed": 3,
      "eventsLimit": 5,
      "registrationsUsed": 180,
      "registrationsLimit": 500
    }
  }
}
```

---

## Events

### Create Event (Organizer Only)

```http
POST /functions/v1/organizer-event-create
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "title": "Spring Championship",
  "description": "Annual spring tournament",
  "type": "tournament",
  "courseId": "uuid",
  "startTime": "2024-04-15T08:00:00Z",
  "endTime": "2024-04-15T16:00:00Z",
  "maxParticipants": 144,
  "entryFeeCents": 15000,
  "isPublic": true,
  "targetTiers": ["select", "summit"]
}
```

### Register for Event

```http
POST /functions/v1/event-register
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "eventId": "uuid",
  "marketingOptIn": true,
  "customFields": {
    "handicap": 12.4,
    "dietaryRestrictions": "Vegetarian"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "registrationId": "uuid",
    "status": "pending",  // or "confirmed" if free
    "paymentUrl": "https://checkout.stripe.com/..."  // if paid
  }
}
```

### List My Event Registrations

```http
GET /functions/v1/event-registrations
Authorization: Bearer <token>
```

---

## Inbox

### List Conversations

```http
GET /functions/v1/inbox-list
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "threadType": "session",
      "threadId": "uuid",
      "title": "Round at TPC Scottsdale",
      "status": "open",
      "lastMessage": "See you at 8am!",
      "lastMessageAt": "2024-03-18T20:00:00Z",
      "unreadCount": 2
    }
  ]
}
```

### Send Message

```http
POST /functions/v1/inbox-send
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "threadType": "session",
  "threadId": "uuid",
  "message": "Looking forward to playing!",
  "clientMessageId": "msg-123"  // for deduplication
}
```

### Get Thread Messages

```http
GET /functions/v1/inbox-messages/:threadType/:threadId
Authorization: Bearer <token>
```

---

## Admin

### Assign Default Tier (Service Only)

```http
POST /functions/v1/tier-assignment
Authorization: Bearer <service_role_key>
Content-Type: application/json
```

**Request:**
```json
{
  "action": "assign-default",
  "userId": "uuid"
}
```

### Manual Tier Upgrade (Admin)

```http
POST /functions/v1/tier-assignment
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "action": "upgrade",
  "userId": "uuid",
  "targetTier": "select"
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden (tier visibility) |
| 404 | Not Found |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Server Error |

## Pagination

List endpoints support pagination via query parameters:

```http
GET /functions/v1/golf-courses?page=2&per_page=20
```

**Response includes:**
```json
{
  "meta": {
    "total": 150,
    "page": 2,
    "per_page": 20,
    "total_pages": 8
  }
}
```

## Filtering

Most list endpoints support filtering:

```http
GET /functions/v1/rounds?city=Scottsdale&format=stroke_play&spots_min=1
GET /functions/v1/connections?status=pending&direction=incoming
GET /functions/v1/events?type=tournament&status=registration_open
```

## Common Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (default: 20, max: 100) |
| `sort` | string | Sort field |
| `order` | string | `asc` or `desc` |
| `include` | string | Related data to include |

## Related Documentation

- [Authentication](./authentication.md) - Login flows
- [Errors](./errors.md) - Error handling
- [Webhooks](./webhooks.md) - Stripe webhooks
