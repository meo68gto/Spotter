# Testing Guide

How to run tests for the Spotter platform.

## Overview

Spotter testing strategy:
- **Unit Tests** - Individual functions/components
- **Integration Tests** - API endpoints
- **E2E Tests** - Full user flows (mobile)
- **Smoke Tests** - Critical path verification

## Test Structure

```
spotter/
├── apps/
│   ├── mobile/
│   │   ├── src/
│   │   │   ├── __tests__/        # Unit tests
│   │   │   └── e2e/              # E2E tests
│   │   └── package.json
│   │
│   └── functions/
│       └── supabase/
│           └── functions/
│               └── [name]/
│                   └── __tests__/ # Function tests
│
├── packages/
│   └── types/
│       └── src/
│           └── __tests__/         # Type tests
│
└── scripts/
    └── smoke/                     # Smoke tests
```

## Prerequisites

### Local Development Setup

```bash
# Install dependencies
pnpm install

# Start local Supabase
pnpm local:up

# Verify local stack
pnpm local:status
```

### Environment Variables

Create `.env.test` in root:

```bash
# Supabase (local)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Test database
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Misc
TEST_USER_EMAIL=test@spotter.golf
TEST_USER_PASSWORD=Test123!
```

## Running Tests

### Smoke Tests

Quick verification that local stack is working:

```bash
# Run all smoke tests
pnpm smoke:local

# Test specific service
pnpm smoke:local -- --service=db
pnpm smoke:local -- --service=auth
pnpm smoke:local -- --service=functions
```

**Smoke tests verify:**
- Database connectivity
- Auth endpoints responding
- Edge functions deployed
- Realtime subscriptions working

### Unit Tests

#### Mobile App

```bash
cd apps/mobile

# Run all tests
pnpm test

# Run with coverage
pnpm test --coverage

# Watch mode
pnpm test --watch

# Specific file
pnpm test -- Profile.test.tsx
```

#### Types Package

```bash
cd packages/types

# Run type tests
pnpm test

# Type checking
pnpm typecheck
```

### Integration Tests

#### Edge Functions

```bash
# Test all functions
pnpm functions:test

# Test specific function
pnpm functions:test -- tier-assignment

# With coverage
pnpm functions:test --coverage
```

#### Database Tests

```bash
# Run migration tests
pnpm db:test:migrations

# Run RLS policy tests
pnpm db:test:policies

# Full database test suite
pnpm db:test
```

### E2E Tests

```bash
cd apps/mobile

# Start app
pnpm dev

# Run E2E tests
pnpm e2e

# Run specific test
pnpm e2e -- onboarding.spec.ts

# Run on device
pnpm e2e:device
```

## Writing Tests

### Unit Test Example (Mobile)

```typescript
// src/components/__tests__/Button.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <Button title="Test" onPress={() => {}} />
    );
    expect(getByText('Test')).toBeTruthy();
  });

  it('handles press', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Test" onPress={onPress} />
    );
    fireEvent.press(getByText('Test'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

### Edge Function Test Example

```typescript
// supabase/functions/tier-assignment/__tests__/index.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("assign default tier", async () => {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/tier-assignment`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'assign-default',
        userId: 'test-user-id'
      })
    }
  );
  
  const data = await response.json();
  assertEquals(data.success, true);
  assertEquals(data.tier, 'free');
});
```

### Database Policy Test

```typescript
// Test RLS policies
Deno.test("same-tier visibility", async () => {
  // Create two users in different tiers
  const freeUser = await createUser('free');
  const selectUser = await createUser('select');
  
  // Free user tries to see select user
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', selectUser.id)
    .single();
  
  // Should return empty (RLS blocks)
  assertEquals(data, null);
});
```

### E2E Test Example

```typescript
// e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test';

test('complete onboarding flow', async ({ page }) => {
  // Start app
  await page.goto('http://localhost:8081');
  
  // Splash screen
  await expect(page.locator('text=Spotter')).toBeVisible();
  await page.locator('text=Get Started').click();
  
  // Email input
  await page.fill('[placeholder="Email"]', 'test@example.com');
  await page.locator('text=Continue').click();
  
  // OTP screen
  await expect(page.locator('text=Enter code')).toBeVisible();
  
  // Enter test OTP
  await page.fill('[placeholder="Code"]', '123456');
  await page.locator('text=Verify').click();
  
  // Home screen
  await expect(page.locator('text=Home')).toBeVisible();
});
```

## Test Data

### Seed Data

```bash
# Seed test database
pnpm db:seed:test

# Reset and reseed
pnpm db:reset:test && pnpm db:seed:test
```

### Test Fixtures

```typescript
// fixtures/users.ts
export const testUsers = {
  free: {
    email: 'free@spotter.test',
    password: 'Test123!',
    tier: 'free'
  },
  select: {
    email: 'select@spotter.test',
    password: 'Test123!',
    tier: 'select'
  },
  summit: {
    email: 'summit@spotter.test',
    password: 'Test123!',
    tier: 'summit'
  }
};

export const testCourses = [
  {
    name: 'TPC Scottsdale',
    city: 'Scottsdale',
    state: 'AZ',
    par_total: 71
  }
];
```

## Mocking

### API Mocks

```typescript
// __mocks__/supabase.ts
export const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: mockUser })
  }))
};
```

### Stripe Mocks

```typescript
// __mocks__/stripe.ts
export const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        id: 'cs_test_...',
        url: 'https://checkout.stripe.com/test'
      })
    }
  }
};
```

## CI/CD Testing

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run smoke tests
        run: pnpm smoke:local
      
      - name: Run unit tests
        run: pnpm test:coverage
      
      - name: Run integration tests
        run: pnpm functions:test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Test Checklist

### Before Committing

- [ ] Unit tests pass
- [ ] No TypeScript errors
- [ ] Lint checks pass
- [ ] Smoke tests pass locally

### Before PR

- [ ] All tests pass in CI
- [ ] New features have tests
- [ ] Edge cases covered
- [ ] Documentation updated

### Before Release

- [ ] Full test suite passes
- [ ] E2E tests pass
- [ ] Smoke tests on staging
- [ ] Performance tests pass

## Debugging Tests

### Verbose Output

```bash
# Debug mode
DEBUG=true pnpm test

# Verbose
pnpm test --verbose

# Specific test with logs
pnpm test -- --grep "tier assignment" --verbose
```

### Test Database Inspection

```bash
# Connect to test database
psql $TEST_DATABASE_URL

# Check test data
SELECT * FROM users WHERE email LIKE '%@spotter.test';
```

### Common Issues

**Test timeouts:**
```bash
# Increase timeout
pnpm test -- --testTimeout=30000
```

**Database connection errors:**
```bash
# Restart local stack
pnpm local:restart

# Verify database is up
pnpm local:status
```

**Edge function not found:**
```bash
# Redeploy functions
pnpm functions:deploy

# Check function status
supabase functions list
```

## Performance Testing

### Load Testing

```bash
# Install k6
brew install k6

# Run load test
k6 run scripts/load-test.js
```

### Mobile Performance

```bash
# Bundle analysis
cd apps/mobile
pnpm bundle:analyze

# Memory profiling
pnpm test --profile
```

## Coverage Reports

Generate coverage reports:

```bash
# Full coverage
pnpm test:coverage

# Coverage threshold check
pnpm test:coverage --threshold=80

# Open HTML report
open coverage/lcov-report/index.html
```

## Related Documentation

- [Architecture](./architecture.md)
- [Database Schema](./database.md)
- [Contributing](./contributing.md)
