# Authentication

Spotter uses **OTP-based authentication** with Supabase Auth. No passwords required.

## Overview

- **Primary Method**: Magic link + OTP via email
- **Session Management**: JWT tokens with refresh
- **Security**: Automatic account locking after failed attempts
- **Tiers**: Users are automatically assigned FREE tier on signup

## Authentication Flow

```
┌─────────────┐     Request OTP      ┌─────────────┐
│   Client    │ ─────────────────────→ │    API      │
│             │                        │             │
│             │ ←───────────────────── │   Supabase  │
│             │   OTP sent to email    │    Auth     │
│             │                        │             │
│             │    Verify OTP          │             │
│             │ ─────────────────────→ │             │
│             │                        │             │
│             │ ←───────────────────── │             │
│             │   JWT + User Data      │             │
└─────────────┘                        └─────────────┘
```

## Endpoints

### Request OTP

Send a one-time password to the user's email.

```http
POST /functions/v1/auth-otp
Content-Type: application/json
```

**Request Body:**

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
  "message": "Check your email for the login code",
  "email": "user@example.com"
}
```

**cURL Example:**

```bash
curl -X POST https://api.spotter.golf/functions/v1/auth-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "action": "signup"
  }'
```

### Verify OTP

Verify the OTP and receive session tokens.

```http
POST /functions/v1/auth-otp
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "token": "123456",
  "action": "verify"
}
```

**Success Response:**

```json
{
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "-Jx3zE0rR2q7Yl9...",
    "expires_at": 1710807600
  },
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "display_name": "User 550e84",
    "tier": {
      "slug": "free",
      "name": "Free",
      "card_color": "#94A3B8"
    }
  }
}
```

**Error Response:**

```json
{
  "error": "Invalid token",
  "code": "otp_verification_failed"
}
```

**cURL Example:**

```bash
curl -X POST https://api.spotter.golf/functions/v1/auth-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "token": "123456",
    "action": "verify"
  }'
```

## Session Management

### Using the Access Token

Include the access token in all authenticated requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Token Expiration

- **Access Token**: Expires after 1 hour
- **Refresh Token**: Valid for 7 days

### Refreshing Tokens

```http
POST /auth/v1/token?grant_type=refresh_token
Content-Type: application/json
apikey: <anon_key>

{
  "refresh_token": "-Jx3zE0rR2q7Yl9..."
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "new-refresh-token...",
  "expires_at": 1710811200
}
```

## Tier-Based Authentication

### Automatic Tier Assignment

New users are automatically assigned the **FREE** tier:

```javascript
// On signup, the system:
1. Creates auth.users record
2. Creates public.users record
3. Calls tier-assignment with action: 'assign-default'
4. Returns user with tier info
```

### Tier Features in Auth Response

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "tier": {
      "id": "uuid",
      "name": "Select",
      "slug": "select",
      "card_color": "#F59E0B",
      "features": {
        "maxConnections": 500,
        "maxRoundsPerMonth": 4,
        "canCreateRounds": true,
        "canSendIntros": true
      }
    },
    "tier_status": "active",
    "tier_expires_at": "2025-03-18T00:00:00Z"
  }
}
```

## Security Features

### Account Locking

After 5 failed login attempts:

```json
{
  "error": "Account temporarily locked",
  "code": "account_locked",
  "locked_until": "2024-03-18T21:00:00Z"
}
```

### Rate Limiting

- **OTP Requests**: Max 3 per email per hour
- **Verification Attempts**: Max 5 per token

### Device Tracking

Sessions include device info:

```json
{
  "session": {
    "device_info": {
      "browser": "Chrome 122.0",
      "os": "iOS 17.4",
      "device": "iPhone"
    },
    "ip_address": "192.168.1.1"
  }
}
```

## Testing Credentials

For development, these test accounts are available:

| Email | Password | Tier | Status |
|-------|----------|------|--------|
| `admin@spotter.test` | Admin123! | Summit | Active |
| `test1@spotter.test` | Test123! | Select | Active |
| `test2@spotter.test` | Test123! | Free | Active |
| `locked@spotter.test` | Test123! | Free | Locked |
| `inactive@spotter.test` | Test123! | Free | Inactive |

## Environment Variables

Required for authentication:

```bash
# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# SMTP (for OTP emails)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid_api_key>
SMTP_FROM=noreply@spotter.golf
```

## Error Reference

| Code | Description | Resolution |
|------|-------------|------------|
| `otp_verification_failed` | Invalid OTP | Request new OTP |
| `otp_expired` | OTP expired | Request new OTP |
| `account_locked` | Too many failed attempts | Wait for lock to expire |
| `account_inactive` | Account disabled | Contact support |
| `email_not_confirmed` | Email not verified | Check email for verification |
| `tier_assignment_failed` | Failed to assign tier | Contact support |

## Next Steps

- [View all endpoints](./endpoints.md)
- [Learn about tiers](./../guides/tier-upgrade.md)
- [Read error handling](./errors.md)
