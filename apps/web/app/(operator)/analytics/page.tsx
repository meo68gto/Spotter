'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsData {
  totalTournaments: number;
  totalRegistrations: number;
  totalWaitlist: number;
  totalSponsors: number;
  totalSponsorRevenueCents: number;
  byTournamentStatus: Record<string, number>;
  registrationTrend: { labels: string[]; data: number[] };
  topTournaments: { id: string; status: string; registrations: number }[];
  registrationsByStatus: Record<string, number>;
  paymentsByStatus: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  draft:              'bg-gray-400',
  registration_open:  'bg-blue-400',
  published:          'bg-green-400',
  live:              'bg-emerald-400',
  completed:          'bg-slate-400',
  cancelled:          'bg-red-400',
};

const REG_STATUS_LABELS: Record<string, string> = {
  registered:   'Registered',
  waitlisted:   'Waitlisted',
  confirmed:    'Confirmed',
  checked_in:   'Checked In',
  no_show:      'No Show',
  cancelled:    'Cancelled',
};

const PAY_STATUS_LABELS: Record<string, string> = {
  pending:  'Pending',
  paid:     'Paid',
  waived:  'Waived',
  refunded:'Refunded',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

// Simple bar chart (CSS only)
function BarChart({ labels, data }: { labels: string[]; data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {labels.map((label, i) => {
        const pct = (data[i] / max) * 100;
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col items-center justify-end h-24">
              <div
                className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                style={{ height: `${pct}%`, minHeight: data[i] > 0 ? '4px' : '0' }}
                title={`${data[i]} registrations`}
              />
            </div>
            <span className="text-xs text-gray-400 text-center leading-tight">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Horizontal bar
function HBar({ label, value, max, color = 'bg-indigo-500' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-28 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/operator/analytics');
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const json = await res.json();
      setData(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
          </div>
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500">{error}</p>
        <button onClick={fetchAnalytics} className="text-indigo-600 hover:underline">Retry</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">No analytics data available.</p>
        <button onClick={fetchAnalytics} className="text-indigo-600 hover:underline">Retry</button>
      </div>
    );
  }

  const totalPaid = data.paymentsByStatus['paid'] ?? 0;
  const totalPending = data.paymentsByStatus['pending'] ?? 0;
  const totalRegs = Object.values(data.registrationsByStatus).reduce((s, v) => s + v, 0);

  const regMax = Math.max(...Object.values(data.registrationsByStatus), 1);
  const tourneyMax = Math.max(...Object.values(data.byTournamentStatus), 1);

  return (
    <div className="space-y-6 p-8 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1 text-sm">Tournament performance and revenue overview</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="inline-flex items-center px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Top-level KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Tournaments</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{fmtNum(data.totalTournaments)}</p>
          <p className="text-xs text-gray-500 mt-1">{Object.values(data.byTournamentStatus).reduce((s, v) => s + v, 0)} total events</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Registrations</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{fmtNum(data.totalRegistrations)}</p>
          <p className="text-xs text-gray-500 mt-1">{fmtNum(data.totalWaitlist)} on waitlist</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Sponsor Revenue</p>
          <p className="text-3xl font-bold text-indigo-700 mt-1">{fmtCents(data.totalSponsorRevenueCents)}</p>
          <p className="text-xs text-gray-500 mt-1">{data.totalSponsors} active sponsors</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Active Sponsors</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{fmtNum(data.totalSponsors)}</p>
          <p className="text-xs text-gray-500 mt-1">across all tournaments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Registration Trend</h2>
          <p className="text-xs text-gray-400 mb-4">Last 12 months</p>
          <BarChart labels={data.registrationTrend.labels} data={data.registrationTrend.data} />
          <p className="text-xs text-gray-400 mt-2 text-center">
            Total: {fmtNum(data.registrationTrend.data.reduce((s, v) => s + v, 0))} registrations
          </p>
        </div>

        {/* Registrations by status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Registrations by Status</h2>
          <p className="text-xs text-gray-400 mb-4">{totalRegs} total registrations</p>
          <div className="space-y-2.5">
            {Object.entries(data.registrationsByStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <HBar
                  key={status}
                  label={REG_STATUS_LABELS[status] ?? status}
                  value={count}
                  max={regMax}
                  color={status === 'checked_in' ? 'bg-green-500' : status === 'waitlisted' ? 'bg-amber-400' : 'bg-indigo-500'}
                />
              ))}
          </div>
        </div>

        {/* Tournament status breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Tournaments by Status</h2>
          <p className="text-xs text-gray-400 mb-4">{data.totalTournaments} total</p>
          <div className="space-y-2.5">
            {Object.entries(data.byTournamentStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <HBar
                  key={status}
                  label={status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  value={count}
                  max={tourneyMax}
                  color={STATUS_COLORS[status] ?? 'bg-gray-400'}
                />
              ))}
          </div>
        </div>

        {/* Payment status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Payments</h2>
          <p className="text-xs text-gray-400 mb-4">{totalPaid + totalPending} total</p>
          <div className="space-y-3">
            {Object.entries(data.paymentsByStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const pct = (totalPaid + totalPending) > 0 ? (count / (totalPaid + totalPending)) * 100 : 0;
                const color = status === 'paid' ? 'text-green-600 bg-green-50 border-green-200' :
                              status === 'pending' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                              'text-gray-600 bg-gray-50 border-gray-200';
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${color}`}>
                        {PAY_STATUS_LABELS[status] ?? status}
                      </span>
                      <div className="w-24 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${status === 'paid' ? 'bg-green-500' : status === 'pending' ? 'bg-amber-400' : 'bg-gray-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Top tournaments by registrations */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Top Tournaments</h2>
          <p className="text-xs text-gray-400 mb-4">By total registrations</p>
          {data.topTournaments.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No tournament data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">#</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Tournament</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Status</th>
                    <th className="text-right text-xs text-gray-500 font-medium pb-2">Registrations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.topTournaments.map((t, i) => {
                    const st = STATUS_COLORS[t.status] ?? 'bg-gray-400';
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="py-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 font-medium text-gray-900">Tournament</td>
                        <td className="py-2">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-gray-600`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st}`} />
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2 text-right font-bold text-gray-900">{t.registrations}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
