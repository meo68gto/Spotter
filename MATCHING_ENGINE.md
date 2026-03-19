# Spotter Matching Engine - Phase 2

## Overview

The Spotter Matching Engine provides intelligent golf partner recommendations based on compatibility scoring. It uses PostgreSQL functions for high-performance calculations and a Supabase Edge Function for API access.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Matching Engine                           │
├─────────────────────────────────────────────────────────────┤
│  Edge Function                    PostgreSQL Functions       │
│  ─────────────                  ────────────────────       │
│  matching-suggestions/            calculate_match_score()    │
│  ├─ GET /matching/suggestions     get_top_matches()          │
│  └─ POST /matching/calculate      calculate_handicap_similarity() │
│                                   calculate_intent_compatibility() │
│                                   calculate_location_score()     │
│                                   calculate_group_size_compatibility() │
└─────────────────────────────────────────────────────────────┘
```

## Compatibility Scoring Algorithm

### Score Weights (sum to 1.0)

| Factor | Weight | Description |
|--------|--------|-------------|
| Handicap Similarity | 30% | How close the golfers' handicaps are |
| Networking Intent | 25% | Alignment of business/social/competitive goals |
| Location Proximity | 20% | Geographic distance between users |
| Availability | 15% | Schedule overlap (reserved for future) |
| Group Size Preference | 10% | Preferred playing group size |

### Scoring Logic

#### Handicap Similarity
- Within 5 strokes: 100%
- Within 10 strokes: 75%
- Within 15 strokes: 50%
- Beyond 15 strokes: 25%

#### Networking Intent Compatibility
| | business | social | competitive | business_social |
|---|:---:|:---:|:---:|:---:|
| business | 100% | 25% | 50% | 75% |
| social | 25% | 100% | 50% | 75% |
| competitive | 50% | 50% | 100% | 50% |
| business_social | 75% | 75% | 50% | 100% |

#### Location Proximity
- Same area (< 10km): 100%
- Nearby (10-50km): 75%
- Different area (> 50km): 25%

#### Group Size Compatibility
| | 2 | 3 | 4 | any |
|---|:---:|:---:|:---:|:---:|
| 2 | 100% | 50% | 25% | 100% |
| 3 | 50% | 100% | 50% | 100% |
| 4 | 25% | 50% | 100% | 100% |
| any | 100% | 100% | 100% | 100% |

## PostgreSQL Functions

### `calculate_match_score(user_id_1 UUID, user_id_2 UUID)`
Returns comprehensive match score with individual factor breakdowns.

**Returns:**
- `match_score` (numeric): Overall compatibility score (0-100)
- `handicap_score` (numeric): Handicap similarity score
- `networking_intent_score` (numeric): Intent alignment score
- `location_score` (numeric): Location proximity score
- `group_size_score` (numeric): Group size compatibility score
- `distance_km` (numeric): Distance between users
- Plus raw user data for each factor

### `get_top_matches(p_user_id UUID, p_limit INTEGER, p_min_score NUMERIC)`
Returns ranked list of compatible golfers in the same tier.

**Parameters:**
- `p_user_id`: User to find matches for
- `p_limit`: Maximum number of results (default: 10)
- `p_min_score`: Minimum match score threshold (default: 0)

**Returns:** Ranked list with user details and match scores.

## API Endpoints

### GET /matching/suggestions
Returns top 10 compatible golf partners for the authenticated user.

**Query Parameters:**
- `limit` (number, optional): Maximum results to return (default: 10, max: 50)
- `minScore` (number, optional): Minimum match score threshold (default: 0)

**Response:**
```json
{
  "userId": "uuid",
  "totalMatches": 10,
  "limit": 10,
  "matches": [
    {
      "matchScore": {
        "targetUserId": "uuid",
        "targetDisplayName": "John Doe",
        "targetAvatarUrl": "https://...",
        "overallScore": 87,
        "tier": "excellent",
        "factors": [...],
        "reasoning": "Strong compatibility in handicap similarity and 2 other areas."
      },
      "user": { ... },
      "golf": { ... },
      "professional": { ... },
      "networking": { ... },
      "mutualConnections": 3,
      "sharedCourses": 0,
      "distanceKm": 8.5
    }
  ],
  "metadata": {
    "calculationTimeMs": 245,
    "filtersApplied": ["same_tier", "open_to_intros"],
    "candidatePoolSize": 150
  }
}
```

### POST /matching/calculate
Calculate match score with a specific user.

**Request Body:**
```json
{
  "targetUserId": "uuid"
}
```

**Response:**
```json
{
  "userId": "uuid",
  "targetUserId": "uuid",
  "matchScore": {
    "targetUserId": "uuid",
    "targetDisplayName": "John Doe",
    "overallScore": 87,
    "tier": "excellent",
    "factors": [...],
    "reasoning": "...",
    "calculatedAt": "2024-..."
  }
}
```

## TypeScript Types

Located in `packages/types/src/matching.ts`:

- `CompatibilityFactor`: Individual factor scoring
- `MatchScore`: Complete match score with breakdown
- `MatchSuggestion`: User profile + match score
- `TopMatchesResponse`: API response for top matches
- `CalculateMatchRequest/Response`: Single user match calculation
- Plus configuration constants and helper functions

## Security

### Same-Tier Visibility
Matches are filtered to only include users in the same membership tier:
- Free tier users only see Free tier matches
- Select tier users only see Select tier matches
- Summit tier users only see Summit tier matches

### Privacy Controls
Users can opt out of matching via `user_networking_preferences.open_to_intros = false`.

### RLS Policies
- `match_candidates` view respects user visibility policies
- Edge functions validate authentication
- PostgreSQL functions use `SECURITY DEFINER` for controlled access

## Database Migration

File: `supabase/migrations/0020_matching_engine.sql`

Contains:
1. Helper functions for individual factor calculations
2. Distance calculation using PostGIS geography
3. Main `calculate_match_score` function
4. Main `get_top_matches` function
5. `match_candidates` view for efficient querying
6. Index on `users(tier_id)` for performance

## Verification

Run the verification script:

```bash
./scripts/verify-matching.sh
```

Tests:
- PostgreSQL function existence
- Handicap similarity calculation
- Networking intent compatibility
- Location proximity scoring
- Group size compatibility
- Complete match score calculation
- Edge function compilation
- Type exports

## Deployment

### PostgreSQL Functions
```bash
supabase db push
# or
psql $DATABASE_URL < supabase/migrations/0020_matching_engine.sql
```

### Edge Function
```bash
supabase functions deploy matching-suggestions
```

## Future Enhancements

1. **Availability Scoring**: Currently returns neutral score (50%). Implement actual availability overlap calculation.

2. **Course Preferences**: Factor in shared favorite courses or home course proximity.

3. **Reputation Scoring**: Integrate with reputation system to weight matches by user reliability.

4. **Machine Learning**: Learn from successful connections to improve scoring over time.

5. **Real-time Updates**: Use Supabase Realtime to update matches as user preferences change.

## Testing

### Unit Tests
Add to `apps/functions/tests/` for edge function testing.

### Integration Tests
Use verification script to validate database functions.

### Manual Testing
```sql
-- Test match calculation
SELECT * FROM calculate_match_score('user-uuid-1', 'user-uuid-2');

-- Test top matches
SELECT * FROM get_top_matches('user-uuid-1', 10, 0);

-- Check match candidates
SELECT * FROM match_candidates WHERE tier_id = 'tier-uuid';
```

## Files Delivered

| File | Description |
|------|-------------|
| `supabase/migrations/0020_matching_engine.sql` | PostgreSQL functions and views |
| `apps/functions/supabase/functions/matching-suggestions/index.ts` | Edge function API |
| `packages/types/src/matching.ts` | TypeScript type definitions |
| `packages/types/src/index.ts` | Updated exports |
| `scripts/verify-matching.sh` | Verification script |
| `MATCHING_ENGINE.md` | This documentation |

## Dependencies

- PostgreSQL 15+ with PostGIS extension
- Supabase Edge Functions runtime
- Existing tables: `users`, `user_golf_identities`, `user_networking_preferences`, `user_professional_identities`, `golf_courses`
