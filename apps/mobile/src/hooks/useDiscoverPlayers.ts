import { useEffect, useState, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { invokeFunction } from '../../lib/api';
import { useSession } from '../../contexts/SessionContext';

export type SkillBand = 'beginner' | 'intermediate' | 'advanced' | 'pro';

export type PlayerCandidate = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  activity_id: string;
  activity_name: string;
  skill_band: SkillBand;
  distance_km: number;
  is_online: boolean;
  mutual_connections: number;
};

export type DiscoverFilters = {
  activityId: string | null;
  radiusKm: number;
  skillLevel: SkillBand | null;
};

export type DiscoverPlayersData = {
  players: PlayerCandidate[];
  loading: boolean;
  error: string | null;
  locationPermission: 'granted' | 'denied' | 'undetermined';
  filters: DiscoverFilters;
  setFilters: (filters: Partial<DiscoverFilters>) => void;
  refresh: () => Promise<void>;
};

const DEFAULT_FILTERS: DiscoverFilters = {
  activityId: null,
  radiusKm: 16,
  skillLevel: null,
};

export function useDiscoverPlayers(): DiscoverPlayersData {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [players, setPlayers] = useState<PlayerCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const filtersRef = useRef<DiscoverFilters>(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission('granted');
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      } else {
        setLocationPermission('denied');
        return null;
      }
    } catch {
      setLocationPermission('denied');
      return null;
    }
  }, []);

  const fetchUserSkillProfile = useCallback(async (activityId: string | null) => {
    if (!userId) return null;
    let query = supabase.from('skill_profiles').select('activity_id, skill_band').eq('user_id', userId);
    if (activityId) { query = query.eq('activity_id', activityId); }
    const { data, error: err } = await query.limit(1).single();
    if (err || !data) return null;
    return data as { activity_id: string; skill_band: SkillBand };
  }, [userId]);

  const fetchPlayers = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let location = userLocation;
      if (!location) { location = await requestLocation(); }
      const currentFilters = filtersRef.current;
      const skillProfile = await fetchUserSkillProfile(currentFilters.activityId);
      const payload: Record<string, unknown> = { radius_km: currentFilters.radiusKm };
      if (location) { payload.latitude = location.latitude; payload.longitude = location.longitude; }
      if (currentFilters.activityId) { payload.activity_id = currentFilters.activityId; }
      if (currentFilters.skillLevel) { payload.skill_band = currentFilters.skillLevel; }
      else if (skillProfile?.skill_band) { payload.skill_band = skillProfile.skill_band; }
      const result = await invokeFunction('matching-candidates', payload);
      if (result?.candidates) { setPlayers(result.candidates as PlayerCandidate[]); }
      else { setPlayers([]); }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load nearby players';
      setError(message);
      setPlayers([]);
    } finally { setLoading(false); }
  }, [userId, userLocation, requestLocation, fetchUserSkillProfile]);

  const setFilters = useCallback((partial: Partial<DiscoverFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    void fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.activityId, filters.radiusKm, filters.skillLevel, userId]);

  useEffect(() => {
    if (locationPermission === 'undetermined') { void requestLocation(); }
  }, [locationPermission, requestLocation]);

  return { players, loading, error, locationPermission, filters, setFilters, refresh: fetchPlayers };
}
