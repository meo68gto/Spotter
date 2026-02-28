import { describe, expect, it } from 'vitest';
import { sortRecommendationsStable } from '../supabase/functions/_shared/mcp';

describe('sortRecommendationsStable', () => {
  it('sorts by score desc then deterministic tiebreakers', () => {
    const rows = [
      {
        recommendation_type: 'event' as const,
        candidate_user_id: null,
        event_id: 'event-b',
        score: 90,
        distance_km: 12,
        skill_delta: null,
        availability_overlap_minutes: null,
        reasons: []
      },
      {
        recommendation_type: 'pairing' as const,
        candidate_user_id: 'user-b',
        event_id: null,
        score: 90,
        distance_km: 7,
        skill_delta: 1,
        availability_overlap_minutes: 45,
        reasons: []
      },
      {
        recommendation_type: 'pairing' as const,
        candidate_user_id: 'user-a',
        event_id: null,
        score: 90,
        distance_km: 7,
        skill_delta: 1,
        availability_overlap_minutes: 45,
        reasons: []
      },
      {
        recommendation_type: 'pairing' as const,
        candidate_user_id: 'user-c',
        event_id: null,
        score: 95,
        distance_km: 25,
        skill_delta: 1,
        availability_overlap_minutes: 30,
        reasons: []
      }
    ];

    const sorted = sortRecommendationsStable(rows);
    expect(sorted.map((row) => row.score)).toEqual([95, 90, 90, 90]);
    expect(sorted[0].candidate_user_id).toBe('user-c');
    expect(sorted[1].candidate_user_id).toBe('user-a');
    expect(sorted[2].candidate_user_id).toBe('user-b');
    expect(sorted[3].event_id).toBe('event-b');
  });
});
