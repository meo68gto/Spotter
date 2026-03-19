# Spotter API Documentation

Complete API reference for the Spotter Golf Networking platform.

## Overview

Spotter is a mobile-first golf networking platform with a tier-based membership system. The API provides endpoints for:

- **Authentication** - OTP-based login and session management
- **User Profiles** - Extended profiles with professional and golf identity
- **Tiers** - Membership tier management and Stripe integration
- **Golf** - Course discovery, round creation, and participant management
- **Networking** - Connections, introductions, and reputation
- **Organizers** - Tournament management portal (Bronze/Silver/Gold tiers)
- **Events** - Registration and invite management
- **Inbox** - Threaded messaging system

## Base URL

```
Production:  https://<project>.supabase.co/functions/v1/
Local:       http://localhost:54321/functions/v1/
```

## Authentication

All API requests require authentication via Bearer token:

```http
Authorization: Bearer <supabase_jwt_token>
```

See [Authentication](./authentication.md) for detailed flows.

## Response Format

All responses are JSON with the following structure:

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-03-18T20:00:00Z",
    "requestId": "uuid"
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "error_code",
  "details": { ... }
}
```

See [Errors](./errors.md) for complete error reference.

## Rate Limiting

- **Authenticated requests**: 100 requests per minute
- **Public endpoints**: 20 requests per minute

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1710807600
```

## Tier Visibility

Spotter enforces **same-tier visibility** at the database level via RLS policies:

- Users can only see other users in their tier or higher tiers
- Connections can only be made within the same tier
- Golf rounds are visible only to same-tier members (unless private)

This is enforced automatically by the API and database.

## Edge Functions

| Function | Description | Auth Required |
|----------|-------------|---------------|
| `auth-otp` | OTP authentication | No |
| `profile-get` | Get user profile | Yes |
| `profile-update` | Update profile | Yes |
| `tier-assignment` | Tier management | Yes (admin/service) |
| `stripe-webhook` | Stripe events | No (webhook) |
| `connection-request` | Send connection request | Yes |
| `connection-respond` | Accept/decline connection | Yes |
| `round-create` | Create golf round | Yes |
| `round-join` | Join a round | Yes |
| `event-register` | Register for event | Yes |
| `inbox-send` | Send message | Yes |
| `organizer-create` | Create organizer account | Yes |
| `organizer-event-create` | Create tournament event | Yes |

## Quick Start

```bash
# 1. Request OTP
curl -X POST https://api.spotter.golf/functions/v1/auth-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "action": "signup"}'

# 2. Verify OTP
curl -X POST https://api.spotter.golf/functions/v1/auth-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "token": "123456", "action": "verify"}'

# 3. Use the returned session token
curl https://api.spotter.golf/functions/v1/profile/get \
  -H "Authorization: Bearer <session_token>"
```

## Documentation Sections

- [Authentication](./authentication.md) - Login flows and session management
- [Endpoints](./endpoints.md) - Complete API endpoint reference
- [Webhooks](./webhooks.md) - Stripe webhook handling
- [Errors](./errors.md) - Error codes and handling
- [OpenAPI Spec](./openapi.yml) - Machine-readable API specification

## Support

For API support:
- Documentation: https://docs.spotter.golf
- Status: https://status.spotter.golf
- Support: api-support@spotter.golf
