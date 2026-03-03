import { useState, useCallback } from 'react';
import { invokeFunction } from '../../lib/api';
import { useSession } from '../../contexts/SessionContext';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro' | 'any';
export type DistanceOption = 1 | 5 | 10 | 'any';
export type AvailabilityOption = 'now' | 'scheduled';

export type QuickMatchFilters = {
  sport: string | null;
  distance: DistanceOption;
  availability: AvailabilityOption;
  skillLevel: SkillLevel;
};

export type QuickMatchCandidate = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  activity_id: string;
  activity_name: string;
  skill_band: string;
  distance_km: number;
  is_online: boolean;
  available_now: boolean;
  next_available_time: string | null;
  match_score: number;
  mutual_connections: number;
};

export type QuickMatchData = {
  results: QuickMatchCandidate[];
  loading: boolean;
  error: string | null;
  search: (filters: Partial<QuickMatchFilters>) => Promise<void>;
};

function distanceToKm(distance: DistanceOption): number | null {
  if (distance === 'any') return null;
  return Math.round(distance * 1.60934);
}

export function useQuickMatch(): QuickMatchData {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [results, setResults] = useState<QuickMatchCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (filters: Partial<QuickMatchFilters>) => {
    if (!userId) { setError('Must be signed in to find a match'); return; }
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { requester_user_id: userId, context: 'quick_match' };
      const radiusKm = distanceToKm(filters.distance ?? 'any');
      if (radiusKm !== null) { payload.radius_km = radiusKm; }
      if (filters.sport) { payload.activity_id = filters.sport; }
      if (filters.skillLevel && filters.skillLevel !== 'any') { payload.skill_band = filters.skillLevel; }
      if (filters.availability === 'now') { payload.available_now = true; }
      else if (filters.availability === 'scheduled') { payload.available_now = false; }
      const result = await invokeFunction('matching-candidates', payload);
      if (result?.candidates) {
        const sorted = [...(result.candidates as QuickMatchCandidate[])].sort((a, b) => {
          if (b.match_score !== a.match_score) return b.match_score - a.match_score;
          if (a.available_now !== b.available_now) return a.available_now ? -1 : 1;
          return a.distance_km - b.distance_km;
        });
        setResults(sorted);
      } else { setResults([]); }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      setResults([]);
    } finally { setLoading(false); }
  }, [userId]);

  return { results, loading, error, search };
}
