import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export type CoachCatalogItem = {
  coachId: string;
  displayName: string;
  headline: string;
  bio: string;
  city: string;
};

export function useCoachCatalog(search: string) {
  const [items, setItems] = useState<CoachCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    const query = search.trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = supabase
      .from('expert_profiles')
      .select('coach_id, headline, bio, coaches(users(display_name, home_location))')
      .eq('discoverable', true)
      .eq('is_dnd', false)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (query) builder = builder.ilike('headline', `%${query}%`);

    const { data } = await builder;

    const mapped: CoachCatalogItem[] = ((data ?? []) as any[]).map((row) => ({
      coachId: row.coach_id,
      displayName: row.coaches?.[0]?.users?.[0]?.display_name ?? 'Coach',
      headline: row.headline ?? 'General coaching',
      bio: row.bio ?? 'No bio yet.',
      city: row.coaches?.[0]?.users?.[0]?.home_location ? 'Local' : 'Remote'
    }));

    setItems(mapped);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const hasNextPage = useMemo(() => items.length === pageSize, [items.length]);

  return {
    items,
    loading,
    page,
    hasNextPage,
    refresh: load,
    nextPage: () => setPage((prev) => prev + 1),
    prevPage: () => setPage((prev) => Math.max(1, prev - 1))
  };
}
