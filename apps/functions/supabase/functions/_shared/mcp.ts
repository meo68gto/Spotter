export type RecommendationRow = {
  recommendation_type: 'pairing' | 'event';
  candidate_user_id: string | null;
  event_id: string | null;
  score: number;
  distance_km: number | null;
  skill_delta: number | null;
  availability_overlap_minutes: number | null;
  reasons: unknown;
};

const stringOrZ = (value: string | null) => value ?? 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz';

export const sortRecommendationsStable = (rows: RecommendationRow[]): RecommendationRow[] => {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.recommendation_type !== b.recommendation_type) {
      const priority = (type: RecommendationRow['recommendation_type']) => (type === 'pairing' ? 0 : 1);
      return priority(a.recommendation_type) - priority(b.recommendation_type);
    }
    if ((a.distance_km ?? Number.POSITIVE_INFINITY) !== (b.distance_km ?? Number.POSITIVE_INFINITY)) {
      return (a.distance_km ?? Number.POSITIVE_INFINITY) - (b.distance_km ?? Number.POSITIVE_INFINITY);
    }
    const aKey = `${stringOrZ(a.candidate_user_id)}:${stringOrZ(a.event_id)}`;
    const bKey = `${stringOrZ(b.candidate_user_id)}:${stringOrZ(b.event_id)}`;
    return aKey.localeCompare(bKey);
  });
};
