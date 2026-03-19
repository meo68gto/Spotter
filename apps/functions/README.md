# Spotter Edge Functions

Supabase Edge Functions for Spotter API.

## Overview

Deno-based edge functions providing:
- Authentication (OTP)
- Profile management
- Tier assignment
- Golf rounds
- Connections
- Events
- Organizer operations
- Stripe webhooks

## Project Structure

```
apps/functions/supabase/functions/
├── _shared/                    # Shared utilities
│   ├── cors.ts                # CORS headers
│   ├── tier-gate.ts           # Tier validation
│   ├── errors.ts              # Error handling
│   └── supabase.ts            # Client initialization
│
├── auth-otp/                  # OTP authentication
│   └── index.ts
│
├── profile-get/               # Get user profile
│   └── index.ts
│
├── profile-update/            # Update profile
│   └── index.ts
│
├── tier-assignment/           # Tier management
│   └── index.ts
│
├── tier-upgrade/              # Stripe checkout
│   └── index.ts
│
├── round-create/              # Create golf round
│   └── index.ts
│
├── round-join/                # Join round
│   └── index.ts
│
├── connection-request/         # Send connection
│   └── index.ts
│
├── connection-respond/         # Accept/decline
│   └── index.ts
│
├── event-register/            # Register for event
│   └── index.ts
│
├── organizer-create/          # Create organizer
│   └── index.ts
│
├── organizer-event-create/    # Create event
│   └── index.ts
│
├── inbox-send/                # Send message
│   └── index.ts
│
├── inbox-list/                # List threads
│   └── index.ts
│
└── stripe-webhook/            # Stripe events
    └── index.ts
```

## Development

### Prerequisites

- Supabase CLI installed
- Deno installed (for local testing)

### Local Development

```bash
# Start functions server
pnpm functions:serve

# Deploy to local
pnpm functions:deploy:local

# Deploy specific function
supabase functions deploy auth-otp
```

### Testing

```bash
# Test all functions
pnpm functions:test

# Test specific function
pnpm functions:test -- auth-otp

# With coverage
pnpm functions:test --coverage
```

## Function Development

### Template

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    
    // Implementation
    
    return new Response(
      JSON.stringify({ data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

### Environment Variables

```bash
# Required
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Stripe (for payment functions)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email (for auth)
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
```

Set secrets:
```bash
supabase secrets set --env-file .env.local
```

## Key Functions

### auth-otp

- Request OTP (signup/signin)
- Verify OTP
- Automatic FREE tier assignment

### profile-get

- Get current user profile
- Get other user profile (same-tier visibility)
- Aggregate profile data

### tier-assignment

- Assign FREE tier to new users
- Upgrade user tiers
- Handle Stripe webhook events

### stripe-webhook

- Process Stripe events
- Update tier on payment
- Handle subscription changes

## Deployment

```bash
# Deploy all
supabase functions deploy

# Deploy specific
supabase functions deploy tier-assignment

# Deploy with project
supabase functions deploy --project-ref <ref>
```

## Monitoring

```bash
# View logs
supabase functions logs auth-otp --tail

# Check status
supabase functions list
```

## Error Handling

Always return proper error responses:

```typescript
return new Response(
  JSON.stringify({ 
    error: 'Error message',
    code: 'error_code'
  }),
  { 
    status: 400,
    headers: corsHeaders 
  }
);
```

## Related

- [API Documentation](../../docs/api/)
- [Architecture](../../docs/dev/architecture.md)
- [Root README](../../README.md)
