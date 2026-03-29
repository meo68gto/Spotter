'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tournament {
  id: string;
  title: string;
  name: string;
  status: string;
  type: string | null;
  course_name: string | null;
  start_time: string | null;
  end_time: string | null;
  max_participants: number | null;
  registration_count: number | null;
  waitlist_count: number | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  draft:           { label: 'Draft',           bg: 'bg-gray-50',    text: 'text-gray-600',   dot: 'bg-gray-400' },
  registration_open: { label: 'Reg. Open',     bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  published:       { label: 'Published',       bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-400' },
  live:            { label: 'Live',            bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  completed:       { label: 'Completed',       bg: 'bg-slate-50',   text: 'text-slate-600',  dot: 'bg-slate-400' },
  cancelled:       { label: 'Cancelled',       bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-400' },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter !== 'all'
        ? `/api/operator/tournaments?status=${statusFilter}`
        : '/api/operator/tournaments';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data = await res.json();
      setTournaments(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const filtered = tournaments.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (t.title ?? t.name ?? '').toLowerCase().includes(q) ||
      (t.course_name ?? '').toLowerCase().includes(q)
    );
  });

  const statusCounts = tournaments.reduce<Record<string, number>>((acc, t) => {
    const s = t.status ?? 'draft';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const totalCount = tournaments.length;

  return (
    <div className="space-y-6 p-8 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {loading ? 'Loading...' : `${totalCount} tournament${totalCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/tournaments/new"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Tournament
        </Link>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search by name or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2">
          {[['all', 'All', totalCount], ...Object.entries(statusCounts)].map(([status, label, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(String(status))}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                statusFilter === status ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchTournaments} className="text-xs text-red-600 hover:underline">Retry</button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Tournament grid */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 font-medium">No tournaments found</p>
          <Link href="/tournaments/new" className="mt-3 text-indigo-600 text-sm font-medium hover:underline inline-block">
            + Create your first tournament
          </Link>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((tournament) => {
            const st = getStatusConfig(tournament.status);
            const spotsLeft = tournament.max_participants != null
              ? Math.max(0, tournament.max_participants - (tournament.registration_count ?? 0))
              : null;
            const isFull = spotsLeft === 0;

            return (
              <button
                key={tournament.id}
                onClick={() => router.push(`/tournaments/${tournament.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md hover:border-indigo-300 transition-all group"
              >
                {/* Top row: title + status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors line-clamp-1">
                    {tournament.title ?? tournament.name ?? 'Untitled Tournament'}
                  </h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${st.bg} ${st.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot} mr-1`} />
                    {st.label}
                  </span>
                </div>

                {/* Course */}
                {tournament.course_name && (
                  <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {tournament.course_name}
                  </p>
                )}

                {/* Date/time */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {fmtDate(tournament.start_time)}
                  {tournament.start_time && <span className="text-gray-400">·</span>}
                  {tournament.start_time && <span>{fmtTime(tournament.start_time)}</span>}
                </div>

                {/* Registration stats */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    {tournament.max_participants != null ? (
                      <>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">
                            {tournament.registration_count ?? 0} / {tournament.max_participants}
                          </span>
                          {isFull && (
                            <span className="text-red-500 font-medium text-xs">Full</span>
                          )}
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              isFull ? 'bg-red-400' : (tournament.registration_count ?? 0) / tournament.max_participants > 0.8 ? 'bg-amber-400' : 'bg-indigo-400'
                            }`}
                            style={{ width: `${Math.min(((tournament.registration_count ?? 0) / tournament.max_participants) * 100, 100)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">
                        {tournament.registration_count ?? 0} registered
                      </p>
                    )}
                  </div>
                  {tournament.waitlist_count != null && tournament.waitlist_count > 0 && (
                    <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                      +{tournament.waitlist_count} waitlist
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
