# Error Codes and Handling

Complete reference for Spotter API error codes, their meanings, and resolution steps.

## Error Response Format

All errors follow this structure:

```json
{
  "error": "Human-readable error message",
  "code": "machine_error_code",
  "details": {
    "field": "Additional context",
    "suggestion": "How to fix"
  }
}
```

## HTTP Status Codes

| Code | Meaning | When Returned |
|------|---------|---------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not permitted (tier visibility) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists or state conflict |
| 422 | Unprocessable | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |

## Authentication Errors

### otp_verification_failed

**HTTP Status:** 400

**Meaning:** The OTP code is incorrect or expired.

**Response:**
```json
{
  "error": "Invalid verification code",
  "code": "otp_verification_failed",
  "details": {
    "message": "The code you entered is incorrect or has expired",
    "remaining_attempts": 4
  }
}
```

**Resolution:** Request a new OTP code.

### account_locked

**HTTP Status:** 403

**Meaning:** Account temporarily locked due to failed login attempts.

**Response:**
```json
{
  "error": "Account temporarily locked",
  "code": "account_locked",
  "details": {
    "locked_until": "2024-03-18T21:00:00Z",
    "reason": "Too many failed login attempts"
  }
}
```

**Resolution:** Wait until the lock expires, then try again.

### missing_auth_header

**HTTP Status:** 401

**Meaning:** No Authorization header provided.

**Response:**
```json
{
  "error": "Authorization header required",
  "code": "missing_auth_header",
  "details": {
    "suggestion": "Include 'Authorization: Bearer <token>' header"
  }
}
```

**Resolution:** Include the Authorization header with a valid JWT.

### invalid_token

**HTTP Status:** 401

**Meaning:** JWT token is expired or invalid.

**Response:**
```json
{
  "error": "Invalid or expired token",
  "code": "invalid_token",
  "details": {
    "suggestion": "Refresh your session or log in again"
  }
}
```

**Resolution:** Use refresh token to get a new access token.

### account_inactive

**HTTP Status:** 403

**Meaning:** Account has been disabled.

**Resolution:** Contact support at api-support@spotter.golf.

## Tier Visibility Errors

### tier_visibility_restricted

**HTTP Status:** 403

**Meaning:** Cannot view user profile due to tier visibility rules.

**Response:**
```json
{
  "error": "Profile not visible",
  "code": "tier_visibility_restricted",
  "message": "You can only view profiles from users in your tier or higher tiers",
  "details": {
    "your_tier": "free",
    "target_tier": "summit"
  }
}
```

**Resolution:** Upgrade to a higher tier or contact the user through other means.

### tier_feature_not_available

**HTTP Status:** 403

**Meaning:** Attempting to use a feature not available in current tier.

**Response:**
```json
{
  "error": "Feature not available",
  "code": "tier_feature_not_available",
  "details": {
    "feature": "create_rounds",
    "your_tier": "free",
    "required_tier": "select",
    "upgrade_url": "https://spotter.golf/upgrade"
  }
}
```

**Resolution:** Upgrade to the required tier.

### tier_limit_exceeded

**HTTP Status:** 403

**Meaning:** Exceeded tier limit (connections, rounds, etc.).

**Response:**
```json
{
  "error": "Tier limit exceeded",
  "code": "tier_limit_exceeded",
  "details": {
    "limit_type": "connections",
    "limit": 50,
    "current": 50,
    "suggestion": "Upgrade to Select for unlimited connections"
  }
}
```

## Validation Errors

### validation_failed

**HTTP Status:** 422

**Meaning:** Request data failed validation.

**Response:**
```json
{
  "error": "Validation failed",
  "code": "validation_failed",
  "details": {
    "errors": [
      {
        "field": "email",
        "message": "Invalid email format",
        "value": "not-an-email"
      },
      {
        "field": "handicap",
        "message": "Must be between 0 and 54",
        "value": 100
      }
    ]
  }
}
```

**Resolution:** Fix the validation errors and retry.

### missing_required_field

**HTTP Status:** 400

**Response:**
```json
{
  "error": "Missing required field",
  "code": "missing_required_field",
  "details": {
    "field": "courseId",
    "message": "courseId is required to create a round"
  }
}
```

### invalid_format

**HTTP Status:** 400

**Response:**
```json
{
  "error": "Invalid data format",
  "code": "invalid_format",
  "details": {
    "field": "roundDate",
    "expected": "YYYY-MM-DD",
    "received": "03-18-2024"
  }
}
```

## Resource Errors

### user_not_found

**HTTP Status:** 404

**Response:**
```json
{
  "error": "User not found",
  "code": "user_not_found",
  "details": {
    "userId": "uuid",
    "suggestion": "Verify the user ID is correct"
  }
}
```

### course_not_found

**HTTP Status:** 404

**Response:**
```json
{
  "error": "Golf course not found",
  "code": "course_not_found",
  "details": {
    "courseId": "uuid"
  }
}
```

### round_not_found

**HTTP Status:** 404

**Response:**
```json
{
  "error": "Golf round not found",
  "code": "round_not_found",
  "details": {
    "roundId": "uuid",
    "suggestion": "Round may have been cancelled or removed"
  }
}
```

### event_not_found

**HTTP Status:** 404

**Response:**
```json
{
  "error": "Event not found",
  "code": "event_not_found",
  "details": {
    "eventId": "uuid"
  }
}
```

## Business Logic Errors

### round_full

**HTTP Status:** 409

**Meaning:** Cannot join round because it's full.

**Response:**
```json
{
  "error": "Round is full",
  "code": "round_full",
  "details": {
    "roundId": "uuid",
    "total_spots": 4,
    "confirmed_spots": 4
  }
}
```

### already_registered

**HTTP Status:** 409

**Meaning:** User already registered for event.

**Response:**
```json
{
  "error": "Already registered",
  "code": "already_registered",
  "details": {
    "eventId": "uuid",
    "registrationId": "uuid"
  }
}
```

### duplicate_connection

**HTTP Status:** 409

**Meaning:** Connection request already exists.

**Response:**
```json
{
  "error": "Connection already exists",
  "code": "duplicate_connection",
  "details": {
    "userId": "uuid",
    "status": "pending"
  }
}
```

### cannot_upgrade

**HTTP Status:** 400

**Meaning:** Invalid tier upgrade path.

**Response:**
```json
{
  "error": "Cannot upgrade to this tier",
  "code": "cannot_upgrade",
  "details": {
    "current_tier": "summit",
    "target_tier": "select",
    "reason": "Cannot downgrade tiers"
  }
}
```

## Rate Limit Errors

### rate_limit_exceeded

**HTTP Status:** 429

**Response:**
```json
{
  "error": "Rate limit exceeded",
  "code": "rate_limit_exceeded",
  "details": {
    "limit": 100,
    "window": "60 seconds",
    "retry_after": 45
  }
}
```

**Response Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710807645
Retry-After: 45
```

**Resolution:** Wait before retrying. Implement exponential backoff.

### otp_rate_limit

**HTTP Status:** 429

**Meaning:** Too many OTP requests.

**Response:**
```json
{
  "error": "Too many OTP requests",
  "code": "otp_rate_limit",
  "details": {
    "max_per_hour": 3,
    "retry_after": 1800
  }
}
```

## Server Errors

### internal_error

**HTTP Status:** 500

**Meaning:** Unexpected server error.

**Response:**
```json
{
  "error": "Internal server error",
  "code": "internal_error",
  "details": {
    "message": "An unexpected error occurred",
    "request_id": "req_...",
    "suggestion": "Contact support with request ID"
  }
}
```

**Resolution:** Retry with exponential backoff. If persists, contact support.

### database_error

**HTTP Status:** 500

**Meaning:** Database operation failed.

**Response:**
```json
{
  "error": "Database error",
  "code": "database_error",
  "details": {
    "message": "Failed to complete operation",
    "suggestion": "Retry the request"
  }
}
```

### stripe_error

**HTTP Status:** 500

**Meaning:** Stripe API error.

**Response:**
```json
{
  "error": "Payment processing error",
  "code": "stripe_error",
  "details": {
    "stripe_code": "card_declined",
    "message": "Your card was declined"
  }
}
```

## Error Handling Best Practices

### Client-Side Error Handling

```typescript
async function apiRequest(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      switch (error.code) {
        case 'invalid_token':
          // Refresh token and retry
          await refreshToken();
          return apiRequest(url, options);
          
        case 'rate_limit_exceeded':
          // Wait and retry with backoff
          const retryAfter = error.details.retry_after;
          await delay(retryAfter * 1000);
          return apiRequest(url, options);
          
        case 'tier_visibility_restricted':
          // Show upgrade prompt
          showUpgradeModal(error.details);
          throw error;
          
        default:
          throw error;
      }
    }
    
    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

### Exponential Backoff

```typescript
async function withRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'rate_limit_exceeded' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}
```

## Error Monitoring

Log errors for monitoring:

```json
{
  "timestamp": "2024-03-18T20:00:00Z",
  "level": "error",
  "code": "database_error",
  "endpoint": "/functions/v1/round-create",
  "userId": "uuid",
  "requestId": "req_...",
  "message": "..."
}
```

## Support

For unresolved errors:
- Include `request_id` from error response
- Email: api-support@spotter.golf
- Status: https://status.spotter.golf
