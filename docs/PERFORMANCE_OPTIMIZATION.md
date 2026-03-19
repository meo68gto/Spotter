# Performance Optimization Guide

## Overview

This document covers performance optimization strategies for Spotter production deployment, including database indexing, query optimization, and caching.

## Database Index Verification

### Critical Indexes

The following indexes should be present in production:

#### Users Table

```sql
-- Primary lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- Discovery queries
CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);
```

#### Profiles Table

```sql
-- Profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_type ON profiles(type);

-- Discovery queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_profiles_sport ON profiles(sport);
CREATE INDEX IF NOT EXISTS idx_profiles_skill_level ON profiles(skill_level);

-- Availability queries
CREATE INDEX IF NOT EXISTS idx_profiles_available ON profiles(is_available) WHERE is_available = true;
```

#### Sessions Table

```sql
-- Session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_coach_id ON sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_sessions_coach_status ON sessions(coach_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_player_status ON sessions(player_id, status);
```

#### Bookings Table

```sql
-- Booking lookups
CREATE INDEX IF NOT EXISTS idx_bookings_session_id ON bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Payment queries
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent ON bookings(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_transfer ON bookings(stripe_transfer_id);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
```

#### Chat Messages Table

```sql
-- Message lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Composite index for chat history
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);
```

#### Matching Table

```sql
-- Match lookups
CREATE INDEX IF NOT EXISTS idx_matching_player_id ON matching(player_id);
CREATE INDEX IF NOT EXISTS idx_matching_coach_id ON matching(coach_id);
CREATE INDEX IF NOT EXISTS idx_matching_status ON matching(status);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_matching_created_at ON matching(created_at);
CREATE INDEX IF NOT EXISTS idx_matching_expires_at ON matching(expires_at);
```

### Index Verification Script

Run this script to verify indexes exist:

```sql
-- Check if critical indexes exist
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('users', 'profiles', 'sessions', 'bookings', 'chat_messages', 'matching')
ORDER BY tablename, indexname;
```

### Index Maintenance

```sql
-- Reindex tables if needed (run during low traffic)
REINDEX TABLE users;
REINDEX TABLE profiles;
REINDEX TABLE sessions;
REINDEX TABLE bookings;

-- Analyze tables for query planner
ANALYZE users;
ANALYZE profiles;
ANALYZE sessions;
ANALYZE bookings;
```

## Query Optimization

### N+1 Query Prevention

**Problem:**
```typescript
// BAD: N+1 queries
const users = await db.getUsers();
for (const user of users) {
    const profile = await db.getProfile(user.id); // N queries!
}
```

**Solution:**
```typescript
// GOOD: Single query with join
const usersWithProfiles = await db.query(`
    SELECT u.*, p.*
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.is_active = true
`);
```

### Pagination Optimization

**Offset-based (for small datasets):**
```sql
SELECT * FROM sessions
WHERE status = 'confirmed'
ORDER BY scheduled_at DESC
LIMIT 20 OFFSET 100;
```

**Cursor-based (for large datasets):**
```sql
SELECT * FROM sessions
WHERE status = 'confirmed'
AND scheduled_at < $last_seen_timestamp
ORDER BY scheduled_at DESC
LIMIT 20;
```

### Query Performance Checklist

- [ ] Use `EXPLAIN ANALYZE` to check query plans
- [ ] Avoid `SELECT *` - specify only needed columns
- [ ] Use appropriate indexes for WHERE clauses
- [ ] Limit result sets with pagination
- [ ] Use `EXISTS` instead of `COUNT` for existence checks
- [ ] Batch inserts/updates instead of individual queries

## Caching Strategy

### Supabase Cache Configuration

```typescript
// Client-side caching with Supabase
const supabase = createClient(url, key, {
    db: {
        schema: 'public',
    },
    global: {
        headers: {
            'Cache-Control': 'max-age=300', // 5 minutes
        },
    },
});

// Enable caching for specific queries
const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_available', true)
    .cacheEq(300); // Cache for 5 minutes
```

### Application-Level Caching

#### Static Data Cache

```typescript
// Cache lookup tables
const SPORTS_CACHE_TTL = 3600; // 1 hour
const sportsCache = new Map();

async function getSports() {
    if (sportsCache.has('data') && !isExpired(sportsCache.get('timestamp'))) {
        return sportsCache.get('data');
    }
    
    const sports = await db.query('SELECT * FROM sports ORDER BY name');
    sportsCache.set('data', sports);
    sportsCache.set('timestamp', Date.now());
    return sports;
}
```

#### User Session Cache

```typescript
// Cache user profile in memory
const userProfileCache = new Map();
const PROFILE_CACHE_TTL = 300; // 5 minutes

async function getUserProfile(userId: string) {
    const cached = userProfileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL * 1000) {
        return cached.data;
    }
    
    const profile = await db.getProfile(userId);
    userProfileCache.set(userId, {
        data: profile,
        timestamp: Date.now(),
    });
    return profile;
}
```

### Edge Function Caching

```typescript
// Cache responses at edge
export default async function handler(req: Request) {
    const cacheKey = new URL(req.url).pathname + new URL(req.url).search;
    
    // Check cache first
    const cached = await caches.open('spotter-cache').match(cacheKey);
    if (cached) {
        return cached;
    }
    
    // Process request
    const response = await processRequest(req);
    
    // Cache successful responses
    if (response.status === 200) {
        const cacheResponse = response.clone();
        cacheResponse.headers.set('Cache-Control', 'public, max-age=300');
        await caches.open('spotter-cache').put(cacheKey, cacheResponse);
    }
    
    return response;
}
```

## CDN Configuration

### Static Assets

Configure Vercel CDN for optimal caching:

```json
// vercel.json headers
{
    "headers": [
        {
            "source": "/_next/static/(.*)",
            "headers": [
                {
                    "key": "Cache-Control",
                    "value": "public, max-age=31536000, immutable"
                }
            ]
        },
        {
            "source": "/images/(.*)",
            "headers": [
                {
                    "key": "Cache-Control",
                    "value": "public, max-age=86400"
                }
            ]
        }
    ]
}
```

### Video Assets

- Use Supabase Storage CDN for video delivery
- Configure signed URLs with appropriate expiry
- Enable HTTP/2 for multiplexing

## Database Connection Pooling

### Supabase Connection Pooling

```typescript
// Configure connection pooling
const supabase = createClient(url, key, {
    db: {
        schema: 'public',
    },
    auth: {
        autoRefreshToken: true,
        persistSession: true,
    },
});
```

### Pool Size Recommendations

| Environment | Pool Size | Notes |
|-------------|-----------|-------|
| Development | 10 | Local development only |
| Staging | 20 | Testing environment |
| Production | 50-100 | Scale based on traffic |

## Performance Monitoring

### Key Metrics to Track

1. **Database Query Time**
   - p50, p95, p99 query durations
   - Slow query log analysis

2. **API Response Time**
   - Endpoint-level timing
   - Cold start vs warm start

3. **Cache Hit Rate**
   - Application cache effectiveness
   - CDN cache hit rate

4. **Resource Utilization**
   - CPU usage
   - Memory usage
   - Connection pool usage

### Performance Budgets

| Metric | Budget | Alert |
|--------|--------|-------|
| Page Load Time | < 3s | > 5s |
| API Response (p95) | < 500ms | > 1000ms |
| Database Query (p95) | < 100ms | > 300ms |
| First Contentful Paint | < 1.8s | > 3s |

## Optimization Checklist

### Pre-Deployment

- [ ] All critical indexes created
- [ ] Slow query log reviewed
- [ ] N+1 queries eliminated
- [ ] Caching strategy implemented
- [ ] CDN configured
- [ ] Connection pooling set up

### Post-Deployment

- [ ] Query performance monitored
- [ ] Cache hit rates verified
- [ ] API response times within budget
- [ ] Database connection pool utilization checked
- [ ] CDN cache hit rates verified

### Regular Maintenance

- [ ] Weekly query performance review
- [ ] Monthly index analysis
- [ ] Quarterly cache strategy review
- [ ] Annual capacity planning
