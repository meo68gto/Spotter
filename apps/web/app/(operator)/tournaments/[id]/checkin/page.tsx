'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Registrant {
  id: string;
  eventId: string;
  userId: string | null;
  displayName: string;
  email: string;
  status: string;
  paymentStatus: string;
  amountPaidCents: number | null;
  registeredAt: string;
  checkedInAt: string | null;
  checkedInByUserId: string | null;
  notes: string;
  dietaryRestrictions: string;
  teamName: string;
  handicapAtRegistration: number | null;
  marketingOptIn: boolean;
  eventTitle: string;
  eventStartTime: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  registered:    { label: 'Registered',    badge: 'bg-indigo-50 text-indigo-700' },
  waitlisted:    { label: 'Waitlisted',    badge: 'bg-yellow-50 text-yellow-700' },
  confirmed:     { label: 'Confirmed',     badge: 'bg-green-50 text-green-700' },
  checked_in:    { label: 'Checked In',   badge: 'bg-indigo-50 text-indigo-700' },
  no_show:       { label: 'No Show',       badge: 'bg-red-50 text-red-700' },
  cancelled:     { label: 'Cancelled',    badge: 'bg-gray-100 text-gray-500' },
};

const PAYMENT_LABELS: Record<string, { label: string; dot: string }> = {
  pending:  { label: 'Pending',  dot: 'bg-yellow-400' },
  paid:     { label: 'Paid',      dot: 'bg-green-400' },
  waived:   { label: 'Waived',    dot: 'bg-blue-400' },
  refunded: { label: 'Refunded',  dot: 'bg-gray-400' },
};

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CheckinPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'arrived' | 'not_arrived'>('all');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesEditing, setNotesEditing] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchRegistrants = useCallback(async () => {
    try {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/checkin`);
      if (!res.ok) throw new Error('Failed to load registrants');
      const data = await res.json();
      setRegistrants(data.registrations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchRegistrants();
    // Poll every 15 seconds for live updates
    pollIntervalRef.current = setInterval(fetchRegistrants, 15_000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchRegistrants]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleAction = async (registrationId: string, action: string, extra?: Record<string, unknown>) => {
    setSavingId(registrationId);
    try {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Action failed');
      }
      // Optimistic update
      setRegistrants((prev) =>
        prev.map((r) => {
          if (r.id !== registrationId) return r;
          if (action === 'check_in') {
            return {
              ...r,
              status: 'checked_in',
              checkedInAt: new Date().toISOString(),
            };
          }
          if (action === 'undo_check_in') {
            return { ...r, status: 'confirmed', checkedInAt: null };
          }
          if (action === 'no_show') {
            return { ...r, status: 'no_show' };
          }
          return r;
        }),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveNotes = async (registrationId: string) => {
    const notes = notesDraft[registrationId] ?? '';
    setNotesEditing(null);
    await handleAction(registrationId, 'update_notes', { notes });
    setRegistrants((prev) =>
      prev.map((r) => (r.id === registrationId ? { ...r, notes } : r)),
    );
  };

  // ---------------------------------------------------------------------------
  // Filtered list
  // ---------------------------------------------------------------------------

  const arrived = registrants.filter((r) => r.status === 'checked_in');
  const notArrived = registrants.filter((r) => r.status !== 'checked_in' && r.status !== 'no_show' && r.status !== 'cancelled');

  const filtered = (() => {
    let list = registrants;
    if (filter === 'arrived') list = arrived;
    else if (filter === 'not_arrived') list = notArrived;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.displayName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.teamName.toLowerCase().includes(q),
      );
    }
    return list;
  })();

  const arrivedCount = arrived.length;
  const totalActive = registrants.filter((r) => r.status !== 'cancelled').length;
  const progressPct = totalActive > 0 ? Math.round((arrivedCount / totalActive) * 100) : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/tournaments" className="hover:text-gray-700">Tournaments</Link>
        <span>/</span>
        <span className="text-gray-900">Check-In</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Day-of Check-In</h1>
          <p className="text-gray-500 mt-1">
            {registrants[0]?.eventTitle ?? 'Tournament'} · {registrants[0]?.eventStartTime ? fmtDate(registrants[0].eventStartTime) : ''}
          </p>
        </div>
        <button
          onClick={fetchRegistrants}
          className="inline-flex items-center px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Check-In Progress
          </h2>
          <span className="text-sm font-bold text-indigo-700">
            {arrivedCount} / {totalActive} arrived
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{progressPct}% arrived</span>
          <span>{totalActive - arrivedCount} pending</span>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex items-center space-x-4">
        {/* Filter tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {([
            ['all', `All (${registrants.length})`],
            ['arrived', `Arrived (${arrivedCount})`],
            ['not_arrived', `Not Arrived (${totalActive - arrivedCount})`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="h-6 w-20 bg-gray-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Registrant list */}
      {!isLoading && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p>No registrants found</p>
            </div>
          )}

          {filtered.map((r) => {
            const isSaving = savingId === r.id;
            const isNotesOpen = notesEditing === r.id;
            const s = STATUS_LABELS[r.status] ?? STATUS_LABELS.registered;
            const p = PAYMENT_LABELS[r.paymentStatus] ?? PAYMENT_LABELS.pending;
            const isArrived = r.status === 'checked_in';

            return (
              <div
                key={r.id}
                className={`bg-white rounded-xl border ${
                  isArrived ? 'border-indigo-200' : 'border-gray-200'
                } shadow-sm hover:shadow transition-shadow`}
              >
                <div className="px-6 py-5 flex items-center gap-4">
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${
                    isArrived ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {r.displayName.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.displayName}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
                        {s.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                        {p.label}
                      </span>
                      {r.teamName && (
                        <span className="text-xs text-gray-400">· {r.teamName}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{r.email}</p>
                    {r.dietaryRestrictions && (
                      <p className="text-xs text-orange-600 mt-0.5">🥛 {r.dietaryRestrictions}</p>
                    )}
                    {r.handicapAtRegistration != null && (
                      <p className="text-xs text-gray-400 mt-0.5">Handicap: {r.handicapAtRegistration}</p>
                    )}
                    {/* Notes preview */}
                    {!isNotesOpen && r.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic truncate">
                        📝 {r.notes}
                      </p>
                    )}
                  </div>

                  {/* Right: check-in time + actions */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {isArrived && r.checkedInAt && (
                      <p className="text-xs text-indigo-600 font-medium">
                        ✓ Checked in at {fmtTime(r.checkedInAt)}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {/* Notes toggle */}
                      <button
                        onClick={() => {
                          if (isNotesOpen) {
                            setNotesEditing(null);
                          } else {
                            setNotesDraft((prev) => ({ ...prev, [r.id]: r.notes }));
                            setNotesEditing(r.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Notes"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {!isArrived && r.status !== 'no_show' && (
                        <button
                          onClick={() => handleAction(r.id, 'check_in')}
                          disabled={isSaving}
                          className="inline-flex items-center px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSaving ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Check In
                            </>
                          )}
                        </button>
                      )}

                      {isArrived && (
                        <button
                          onClick={() => handleAction(r.id, 'undo_check_in')}
                          disabled={isSaving}
                          className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Undo
                        </button>
                      )}

                      {!isArrived && r.status !== 'no_show' && (
                        <button
                          onClick={() => handleAction(r.id, 'no_show')}
                          disabled={isSaving}
                          className="inline-flex items-center px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          No Show
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline notes editor */}
                {isNotesOpen && (
                  <div className="px-6 pb-5 border-t border-gray-100 pt-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          Notes <span className="text-gray-400">(cart #, dietary, special requests)</span>
                        </label>
                        <input
                          type="text"
                          value={notesDraft[r.id] ?? ''}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          placeholder="e.g. Cart #14, vegetarian, needs accommodation..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNotes(r.id);
                            if (e.key === 'Escape') setNotesEditing(null);
                          }}
                        />
                      </div>
                      <div className="flex-shrink-0 flex gap-2 mt-6">
                        <button
                          onClick={() => handleSaveNotes(r.id)}
                          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setNotesEditing(null)}
                          className="px-4 py-2 text-gray-600 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
