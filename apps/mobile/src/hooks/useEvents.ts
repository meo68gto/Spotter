import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { invokeFunction } from '../../lib/api';

export interface SpotterEvent {
  id: string;
  title: string;
  sport: string;
  date: string;
  startTime: string;
  location: string;
  rsvpCount: number;
  isFeatured?: boolean;
  imageUri?: string | null;
  isFree?: boolean;
}

interface UseEventsOptions {
  timeFilter?: 'This Week' | 'This Month';
  sportFilters?: string[];
}

interface UseEventsResult {
  events: SpotterEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function formatShortDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return isoDate; }
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function getMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return { start, end };
}

const MOCK_EVENTS: SpotterEvent[] = [
  { id: 'mock-event-1', title: 'Spotter Open: Local Golf Day', sport: 'Golf', date: formatShortDate(new Date(Date.now() + 3 * 86400000).toISOString()), startTime: new Date(Date.now() + 3 * 86400000).toISOString(), location: 'Scottsdale', rsvpCount: 18, isFeatured: true, isFree: false },
  { id: 'mock-event-2', title: 'City Pickleball Ladder', sport: 'Pickleball', date: formatShortDate(new Date(Date.now() + 7 * 86400000).toISOString()), startTime: new Date(Date.now() + 7 * 86400000).toISOString(), location: 'Austin', rsvpCount: 27, isFree: false },
  { id: 'mock-event-3', title: 'Sunday Morning Tennis Social', sport: 'Tennis', date: formatShortDate(new Date(Date.now() + 5 * 86400000).toISOString()), startTime: new Date(Date.now() + 5 * 86400000).toISOString(), location: 'San Diego', rsvpCount: 12, isFree: true },
  { id: 'mock-event-4', title: 'Padel Doubles Night', sport: 'Padel', date: formatShortDate(new Date(Date.now() + 9 * 86400000).toISOString()), startTime: new Date(Date.now() + 9 * 86400000).toISOString(), location: 'Phoenix', rsvpCount: 8, isFree: false },
  { id: 'mock-event-5', title: '5-on-5 Soccer Tournament', sport: 'Soccer', date: formatShortDate(new Date(Date.now() + 14 * 86400000).toISOString()), startTime: new Date(Date.now() + 14 * 86400000).toISOString(), location: 'Denver', rsvpCount: 34, isFree: false },
];

export function useEvents({ timeFilter = 'This Week', sportFilters = [] }: UseEventsOptions = {}): UseEventsResult {
  const [events, setEvents] = useState<SpotterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latestOptions = useRef({ timeFilter, sportFilters });
  latestOptions.current = { timeFilter, sportFilters };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bounds = latestOptions.current.timeFilter === 'This Week' ? getWeekBounds() : getMonthBounds();
      const { data, error: dbError } = await supabase
        .from('sponsor_events')
        .select('id, title, start_time, city, venue_name, registration_count, status, price_cents, activity:activity_id (name)')
        .eq('status', 'published')
        .gte('start_time', bounds.start.toISOString())
        .lte('start_time', bounds.end.toISOString())
        .order('start_time', { ascending: true })
        .limit(50);

      if (dbError || !data) throw new Error(dbError?.message ?? 'No data returned');

      let mapped: SpotterEvent[] = (data as any[]).map((row, i) => ({
        id: row.id, title: row.title ?? 'Untitled Event', sport: row.activity?.name ?? 'Sport',
        date: formatShortDate(row.start_time), startTime: row.start_time,
        location: row.venue_name ?? row.city ?? 'Local', rsvpCount: row.registration_count ?? 0,
        isFeatured: i === 0, isFree: row.price_cents === 0 || row.price_cents == null,
      }));

      const sports = latestOptions.current.sportFilters;
      if (sports.length > 0) { mapped = mapped.filter((e) => sports.some((s) => e.sport.toLowerCase().includes(s.toLowerCase()))); }
      setEvents(mapped);
    } catch (primaryError) {
      try {
        const fnData = await invokeFunction<any[]>('sponsors-event-list', { method: 'POST', body: { includeAll: true } });
        if (!Array.isArray(fnData)) throw new Error('Invalid response format');
        let mapped: SpotterEvent[] = fnData.map((row: any, i) => ({
          id: row.id ?? `fn-event-${i}`, title: row.title ?? 'Untitled Event',
          sport: row.sport ?? row.activity_name ?? 'Sport',
          date: formatShortDate(row.start_time ?? new Date().toISOString()),
          startTime: row.start_time ?? new Date().toISOString(),
          location: row.venue_name ?? row.city ?? 'Local', rsvpCount: row.registration_count ?? 0,
          isFeatured: i === 0, isFree: row.price_cents === 0 || row.price_cents == null,
        }));
        const sports = latestOptions.current.sportFilters;
        if (sports.length > 0) { mapped = mapped.filter((e) => sports.some((s) => e.sport.toLowerCase().includes(s.toLowerCase()))); }
        setEvents(mapped.length > 0 ? mapped : MOCK_EVENTS);
      } catch (fallbackError) {
        let filtered = MOCK_EVENTS;
        const sports = latestOptions.current.sportFilters;
        if (sports.length > 0) { filtered = MOCK_EVENTS.filter((e) => sports.some((s) => e.sport.toLowerCase().includes(s.toLowerCase()))); }
        setEvents(filtered);
        if (filtered.length === 0) { setError(fallbackError instanceof Error ? fallbackError.message : 'Failed to load events'); }
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents, timeFilter, sportFilters.join(',')]);

  const refresh = useCallback(async () => { await fetchEvents(); }, [fetchEvents]);

  return { events, loading, error, refresh };
}

export default useEvents;
