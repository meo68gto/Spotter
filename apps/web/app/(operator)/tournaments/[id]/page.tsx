'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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
  location_address: string | null;
  registration_deadline: string | null;
  description: string | null;
  created_at: string;
}

interface NavItem {
  label: string;
  href: string;
  description: string;
  icon: React.ReactNode;
  badge?: string | number;
  accent?: 'default' | 'new';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  draft:            { label: 'Draft',            bg: 'bg-gray-50',    text: 'text-gray-600',   dot: 'bg-gray-400' },
  registration_open: { label: 'Reg. Open',      bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-400' },
  published:       { label: 'Published',          bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-400' },
  live:            { label: 'Live',               bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  completed:       { label: 'Completed',          bg: 'bg-slate-50',   text: 'text-slate-600', dot: 'bg-slate-400' },
  cancelled:       { label: 'Cancelled',          bg: 'bg-red-50',     text: 'text-red-700',   dot: 'bg-red-400' },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return `${fmtDate(iso)} at ${fmtTime(iso)}`;
}

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function IconCheckin() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function IconPairings() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function IconBroadcast() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconFulfillment() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  );
}

function IconUpsells() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconVendors() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function IconProspectus() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTournament = useCallback(async () => {
    try {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}`);
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data = await res.json();
      // Handle wrapped response: { data: [...] } or direct array
      setTournament(Array.isArray(data) ? data[0] : (data.data?.[0] ?? data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { fetchTournament(); }, [fetchTournament]);

  if (loading) {
    return (
      <div className="space-y-6 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500">{error ?? 'Tournament not found'}</p>
        <button onClick={fetchTournament} className="text-indigo-600 hover:underline">Retry</button>
        <Link href="/tournaments" className="text-gray-500 hover:underline">← Back to Tournaments</Link>
      </div>
    );
  }

  const st = getStatusConfig(tournament.status);
  const spotsLeft = tournament.max_participants != null
    ? Math.max(0, tournament.max_participants - (tournament.registration_count ?? 0))
    : null;
  const fillPct = tournament.max_participants != null && tournament.max_participants > 0
    ? ((tournament.registration_count ?? 0) / tournament.max_participants) * 100
    : null;

  // Build nav items
  const navItems: NavItem[] = [
    {
      label: 'Check-In',
      href: `/tournaments/${tournamentId}/checkin`,
      description: 'Manage player check-in and registration',
      icon: <IconCheckin />,
    },
    {
      label: 'Pairings & Flights',
      href: `/tournaments/${tournamentId}/pairings`,
      description: 'Tee times, flight groups, and starting holes',
      icon: <IconPairings />,
    },
    {
      label: 'Leaderboard',
      href: `/tournaments/${tournamentId}/leaderboard`,
      description: 'Live and final scoring results',
      icon: <IconPairings />,
    },
    {
      label: 'Broadcast',
      href: `/tournaments/${tournamentId}/broadcast`,
      description: 'Send emails and announcements to registrants',
      icon: <IconBroadcast />,
    },
    {
      label: 'Fulfillment',
      href: `/tournaments/${tournamentId}/fulfillment`,
      description: 'Track sponsor deliverables and wrap report',
      icon: <IconFulfillment />,
    },
    {
      label: 'Upsells',
      href: `/tournaments/${tournamentId}/upsells`,
      description: 'Registration add-ons, contests, and merch',
      icon: <IconUpsells />,
    },
    {
      label: 'Vendors',
      href: `/tournaments/${tournamentId}/vendors`,
      description: 'Vendor coordination and contact info',
      icon: <IconVendors />,
    },
    {
      label: 'Prospectus',
      href: `/tournaments/${tournamentId}/prospectus`,
      description: 'Sponsorship prospectus and packages',
      icon: <IconProspectus />,
      accent: 'new',
    },
  ];

  return (
    <div className="space-y-6 p-8 min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/tournaments" className="hover:text-gray-700">Tournaments</Link>
        <span>/</span>
        <span className="text-gray-900">{tournament.title ?? tournament.name}</span>
      </div>

      {/* Tournament header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {tournament.title ?? tournament.name ?? 'Untitled Tournament'}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot} mr-1.5`} />
                {st.label}
              </span>
              {tournament.type && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  {tournament.type}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-gray-600">
              {tournament.course_name && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{tournament.course_name}</span>
                </div>
              )}
              {tournament.start_time && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{fmtDate(tournament.start_time)}</span>
                  {tournament.start_time && <span className="text-gray-400">at</span>}
                  <span>{fmtTime(tournament.start_time)}</span>
                </div>
              )}
              {tournament.registration_deadline && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Reg. deadline: {fmtDate(tournament.registration_deadline)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-6 flex-shrink-0">
            {/* Registration */}
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{tournament.registration_count ?? 0}</p>
              <p className="text-xs text-gray-500">Registered</p>
            </div>
            {spotsLeft !== null && (
              <div className="text-center">
                <p className={`text-2xl font-bold ${spotsLeft === 0 ? 'text-red-600' : 'text-gray-900'}`}>{spotsLeft}</p>
                <p className="text-xs text-gray-500">Spots Left</p>
              </div>
            )}
            {tournament.waitlist_count != null && tournament.waitlist_count > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{tournament.waitlist_count}</p>
                <p className="text-xs text-gray-500">Waitlist</p>
              </div>
            )}
          </div>
        </div>

        {/* Capacity bar */}
        {fillPct !== null && tournament.max_participants != null && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Capacity</span>
              <span>{tournament.registration_count ?? 0} / {tournament.max_participants}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  fillPct >= 100 ? 'bg-red-500' : fillPct >= 80 ? 'bg-amber-400' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(fillPct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sub-page navigation grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider px-1">
          Tournament Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-indigo-300 transition-all flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                    {item.label}
                  </p>
                  {item.accent === 'new' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      New
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
              </div>
              <svg
                className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Description (if any) */}
      {tournament.description && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">About</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{tournament.description}</p>
        </div>
      )}
    </div>
  );
}
