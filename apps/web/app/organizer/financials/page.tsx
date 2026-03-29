"use client";

import { Component, ReactNode, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface TournamentFinancials {
  tournament_id: string;
  tournament_name: string;
  event_date: string;
  paid_registrations: number;
  registration_revenue_cents: number;
  sponsor_revenue_cents: number;
  platform_fees_cents: number;
  net_revenue_cents: number;
  payouts_cents: number;
  pending_payout_cents: number;
}

interface Tournament {
  id: string;
  name: string;
  event_date: string;
  price_cents: number;
  max_participants: number;
  current_participants: number;
}

const mockFinancials: TournamentFinancials[] = [
  {
    tournament_id: "evt-1",
    tournament_name: "Spring Championship Tournament",
    event_date: "2024-04-15",
    paid_registrations: 89,
    registration_revenue_cents: 445000,
    sponsor_revenue_cents: 500000,
    platform_fees_cents: 44500,
    net_revenue_cents: 900500,
    payouts_cents: 0,
    pending_payout_cents: 0,
  },
  {
    tournament_id: "evt-2",
    tournament_name: "Corporate Team Building Scramble",
    event_date: "2024-04-22",
    paid_registrations: 0,
    registration_revenue_cents: 0,
    sponsor_revenue_cents: 250000,
    platform_fees_cents: 0,
    net_revenue_cents: 250000,
    payouts_cents: 0,
    pending_payout_cents: 0,
  },
];

const mockTournaments: Tournament[] = [
  { id: "evt-1", name: "Spring Championship Tournament", event_date: "2024-04-15", price_cents: 5000, max_participants: 120, current_participants: 89 },
  { id: "evt-2", name: "Corporate Team Building Scramble", event_date: "2024-04-22", price_cents: 7500, max_participants: 80, current_participants: 0 },
  { id: "evt-3", name: "Charity Golf Fundraiser", event_date: "2024-05-10", price_cents: 15000, max_participants: 144, current_participants: 0 },
];

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

class FinancialsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorMessage: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">Failed to load financials data.</p>
          <p className="text-red-500 text-sm mt-1">{this.state.errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function FinancialsPage() {
  const [financials, setFinancials] = useState<TournamentFinancials[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // Real Supabase fetch
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Try fetching from the operator_financials view
        const { data: finData, error: finError } = supabase
          ? await supabase.from("operator_financials").select("*").limit(50)
          : { data: null, error: null };

        if (finError) throw finError;

        if (finData && finData.length > 0) {
          setFinancials(finData);
        }

        // Also fetch tournaments for the dropdown
        const { data: tourData, error: tourError } = supabase
          ? await supabase.from("organizer_events").select("id, name, event_date, price_cents, max_participants, current_participants").order("event_date", { ascending: false }).limit(20)
          : { data: null, error: null };

        if (tourError) throw tourError;

        if (tourData && tourData.length > 0) {
          setTournaments(tourData);
        }
      } catch (err) {
        throw err; // Re-throw so error boundary catches it
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredFinancials = selectedEvent === "all"
    ? financials
    : financials.filter((f) => f.tournament_id === selectedEvent);

  const ytdRevenue = financials.reduce((sum, f) => sum + f.registration_revenue_cents + f.sponsor_revenue_cents, 0);
  const ytdFees = financials.reduce((sum, f) => sum + f.platform_fees_cents, 0);
  const ytdNet = financials.reduce((sum, f) => sum + f.net_revenue_cents, 0);
  const ytdPayouts = financials.reduce((sum, f) => sum + f.payouts_cents, 0);

  return (
    <FinancialsErrorBoundary>
      {isLoading ? (
        <div className="space-y-6">
          <div className="h-16 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financials</h1>
        <p className="text-gray-600">P&L summary and payout tracking.</p>
      </div>

      {/* YTD Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">YTD Revenue</p>
          <p className="text-2xl font-bold text-gray-900">{formatCents(ytdRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Registrations + Sponsors</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">YTD Platform Fees</p>
          <p className="text-2xl font-bold text-red-600">{formatCents(ytdFees)}</p>
          <p className="text-xs text-gray-400 mt-1">10% of registration revenue</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">YTD Net Revenue</p>
          <p className="text-2xl font-bold text-green-600">{formatCents(ytdNet)}</p>
          <p className="text-xs text-gray-400 mt-1">After platform fees</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">YTD Payouts</p>
          <p className="text-2xl font-bold text-gray-900">{formatCents(ytdPayouts)}</p>
          <p className="text-xs text-gray-400 mt-1">Transferred to you</p>
        </div>
      </div>

      {/* Event Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Event:</label>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm border p-2 text-sm"
        >
          <option value="all">All Events</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {isLoading && <span className="text-sm text-gray-400">Loading...</span>}
      </div>

      {/* Per-Event P&L Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Registrations</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reg. Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sponsor Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Platform Fee</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Payouts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredFinancials.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No financial data available. Create an event to get started.
                </td>
              </tr>
            ) : (
              filteredFinancials.map((f) => (
                <tr key={f.tournament_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{f.tournament_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{f.event_date}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{f.paid_registrations}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCents(f.registration_revenue_cents)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCents(f.sponsor_revenue_cents)}</td>
                  <td className="px-6 py-4 text-sm text-red-600 text-right">-{formatCents(f.platform_fees_cents)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-green-600 text-right">{formatCents(f.net_revenue_cents)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 text-right">{formatCents(f.payouts_cents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Revenue Breakdown */}
      {filteredFinancials.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Revenue Breakdown</h3>
            {filteredFinancials.map((f) => (
              <div key={f.tournament_id} className="mb-3 last:mb-0">
                <p className="text-xs text-gray-500">{f.tournament_name}</p>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-600">Players</span>
                  <span>{formatCents(f.registration_revenue_cents)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-600">Sponsors</span>
                  <span>{formatCents(f.sponsor_revenue_cents)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Cost Breakdown</h3>
            {filteredFinancials.map((f) => (
              <div key={f.tournament_id} className="mb-3 last:mb-0">
                <p className="text-xs text-gray-500">{f.tournament_name}</p>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-600">Platform Fee (10%)</span>
                  <span className="text-red-500">-{formatCents(f.platform_fees_cents)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Net Margin</h3>
            {filteredFinancials.map((f) => {
              const total = f.registration_revenue_cents + f.sponsor_revenue_cents;
              const margin = total > 0 ? ((f.net_revenue_cents / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={f.tournament_id} className="mb-3 last:mb-0">
                  <p className="text-xs text-gray-500">{f.tournament_name}</p>
                  <p className="text-lg font-bold text-green-600 mt-1">{margin}%</p>
                  <p className="text-xs text-gray-400">of total revenue</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
      )}
    </FinancialsErrorBoundary>
  );
}
