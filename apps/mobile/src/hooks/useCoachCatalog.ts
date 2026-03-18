import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export type EngagementMode = 'text_answer' | 'video_answer' | 'video_call';

export type CoachPricing = {
  mode: EngagementMode;
  priceCents: number;
  currency: string;
};

export type CoachCatalogItem = {
  coachId: string;
  displayName: string;
  headline: string;
  bio: string;
  city: string;
  specialties: string[];
  ratingAvg: number | null;
  ratingCount: number;
  avgResponseMinutes: number | null;
  pricing: CoachPricing[];
  minPrice: number;
  maxPrice: number;
};

export type FilterOptions = {
  specialty?: string;
  minPrice?: number;
  maxPrice?: number;
  mode?: EngagementMode;
  minRating?: number;
};

export function useCoachCatalog(search: string, filters: FilterOptions = {}) {
  const [items, setItems] = useState<CoachCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    const query = search.trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build the query with all necessary joins
    let builder = supabase
      .from('expert_profiles')
      .select(`
        coach_id, 
        headline, 
        bio, 
        avg_response_minutes,
        coaches!inner(
          id,
          specialties,
          rating_avg,
          rating_count,
          users!inner(display_name, home_location)
        ),
        expert_pricing(engagement_mode, price_cents, currency, active)
      `)
      .eq('discoverable', true)
      .eq('is_dnd', false)
      .eq('expert_pricing.active', true)
      .order('updated_at', { ascending: false })
      .range(from, to);

    // Apply search across multiple fields
    if (query) {
      builder = builder.or(
        `headline.ilike.%${query}%,bio.ilike.%${query}%,coaches.users.display_name.ilike.%${query}%`
      );
    }

    // Apply specialty filter
    if (filters.specialty) {
      builder = builder.contains('coaches.specialties', [filters.specialty]);
    }

    // Apply minimum rating filter
    if (filters.minRating) {
      builder = builder.gte('coaches.rating_avg', filters.minRating);
    }

    const { data, error } = await builder;

    if (error) {
      console.error('Error loading coach catalog:', error);
      setItems([]);
      setLoading(false);
      return;
    }

    const mapped: CoachCatalogItem[] = ((data ?? []) as any[]).map((row) => {
      const coachData = row.coaches?.[0];
      const userData = coachData?.users?.[0];
      
      // Parse pricing data
      const pricing: CoachPricing[] = (row.expert_pricing ?? [])
        .filter((p: any) => p.active)
        .map((p: any) => ({
          mode: p.engagement_mode as EngagementMode,
          priceCents: p.price_cents,
          currency: p.currency || 'usd'
        }));

      const prices = pricing.map(p => p.priceCents);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      // Extract city from home_location if available
      let city = 'Remote';
      if (userData?.home_location) {
        // home_location is a GeoJSON point, we'd need to geocode or store city separately
        // For now, show as "Available" if location exists
        city = 'Available';
      }

      return {
        coachId: row.coach_id,
        displayName: userData?.display_name ?? 'Coach',
        headline: row.headline ?? 'General coaching',
        bio: row.bio ?? 'No bio yet.',
        city,
        specialties: coachData?.specialties ?? [],
        ratingAvg: coachData?.rating_avg ?? null,
        ratingCount: coachData?.rating_count ?? 0,
        avgResponseMinutes: row.avg_response_minutes ?? null,
        pricing,
        minPrice,
        maxPrice
      };
    });

    // Apply price filters client-side (since we need to calculate min/max per coach)
    let filtered = mapped;
    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(c => c.maxPrice >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(c => c.minPrice <= filters.maxPrice!);
    }
    if (filters.mode) {
      filtered = filtered.filter(c => c.pricing.some(p => p.mode === filters.mode));
    }

    setItems(filtered);
    setLoading(false);
  }, [page, search, filters.specialty, filters.minPrice, filters.maxPrice, filters.mode, filters.minRating]);

  useEffect(() => {
    setPage(1); // Reset to page 1 when search/filters change
  }, [search, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const hasNextPage = useMemo(() => items.length === pageSize, [items.length]);

  // Get all unique specialties from current results for filter dropdown
  const availableSpecialties = useMemo(() => {
    const all = items.flatMap(c => c.specialties);
    return [...new Set(all)].sort();
  }, [items]);

  return {
    items,
    loading,
    page,
    hasNextPage,
    availableSpecialties,
    refresh: load,
    nextPage: () => setPage((prev) => prev + 1),
    prevPage: () => setPage((prev) => Math.max(1, prev - 1))
  };
}
