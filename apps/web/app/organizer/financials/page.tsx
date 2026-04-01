"use client";

import { useEffect, useState } from "react";

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

interface FinancialsResponse {
  data: TournamentFinancials[];
  tournaments: Tournament[];
  source: "live" | "mock";
  warning?: string;
  error?: string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function FinancialsErrorState({ errorMessage }: { errorMessage: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-medium text-red-700">Failed to load financials data.</p>
      <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  );
}

export default function FinancialsPage() {
  const [financials, setFinancials] = useState<TournamentFinancials[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setWarningMessage(null);

      try {
        const response = await fetch("/api/operator/financials", {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json()) as FinancialsResponse;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load financial reporting.");
        }

        setFinancials(payload.data ?? []);
        setTournaments(payload.tournaments ?? []);
        setWarningMessage(payload.source === "mock" ? payload.warning ?? "Showing demo financial data." : null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load financial reporting.";
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);

  const filteredFinancials =
    selectedEvent === "all" ? financials : financials.filter((row) => row.tournament_id === selectedEvent);

  const ytdRevenue = financials.reduce((sum, row) => sum + row.registration_revenue_cents + row.sponsor_revenue_cents, 0);
  const ytdFees = financials.reduce((sum, row) => sum + row.platform_fees_cents, 0);
  const ytdNet = financials.reduce((sum, row) => sum + row.net_revenue_cents, 0);
  const ytdPayouts = financials.reduce((sum, row) => sum + row.payouts_cents, 0);

  if (errorMessage) {
    return <FinancialsErrorState errorMessage={errorMessage} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-16 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
        <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {warningMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          {warningMessage}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financials</h1>
        <p className="text-gray-600">P&amp;L summary and payout tracking.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">YTD Revenue</p>
          <p className="text-2xl font-bold text-gray-900">{formatCents(ytdRevenue)}</p>
          <p className="mt-1 text-xs text-gray-400">Registrations + Sponsors</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">YTD Platform Fees</p>
          <p className="text-2xl font-bold text-red-600">{formatCents(ytdFees)}</p>
          <p className="mt-1 text-xs text-gray-400">10% of registration revenue</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">YTD Net Revenue</p>
          <p className="text-2xl font-bold text-green-600">{formatCents(ytdNet)}</p>
          <p className="mt-1 text-xs text-gray-400">After platform fees</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">YTD Payouts</p>
          <p className="text-2xl font-bold text-gray-900">{formatCents(ytdPayouts)}</p>
          <p className="mt-1 text-xs text-gray-400">Transferred to you</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="financials-event-filter" className="text-sm font-medium text-gray-700">
          Event:
        </label>
        <select
          id="financials-event-filter"
          value={selectedEvent}
          onChange={(event) => setSelectedEvent(event.target.value)}
          className="rounded-md border border-gray-300 p-2 text-sm shadow-sm sm:min-w-64"
        >
          <option value="all">All Events</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-[56rem] divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Event</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Registrations</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Reg. Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Sponsor Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Platform Fee</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Net Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Payouts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredFinancials.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No financial data is available for this selection yet.
                </td>
              </tr>
            ) : (
              filteredFinancials.map((row) => (
                <tr key={row.tournament_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.tournament_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{row.event_date}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">{row.paid_registrations}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">{formatCents(row.registration_revenue_cents)}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">{formatCents(row.sponsor_revenue_cents)}</td>
                  <td className="px-6 py-4 text-right text-sm text-red-600">-{formatCents(row.platform_fees_cents)}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-green-600">{formatCents(row.net_revenue_cents)}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500">{formatCents(row.payouts_cents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredFinancials.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Revenue Breakdown</h3>
            {filteredFinancials.map((row) => (
              <div key={row.tournament_id} className="mb-3 last:mb-0">
                <p className="text-xs text-gray-500">{row.tournament_name}</p>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-gray-600">Players</span>
                  <span>{formatCents(row.registration_revenue_cents)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-gray-600">Sponsors</span>
                  <span>{formatCents(row.sponsor_revenue_cents)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Cost Breakdown</h3>
            {filteredFinancials.map((row) => (
              <div key={row.tournament_id} className="mb-3 last:mb-0">
                <p className="text-xs text-gray-500">{row.tournament_name}</p>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-gray-600">Platform Fee (10%)</span>
                  <span className="text-red-500">-{formatCents(row.platform_fees_cents)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Net Margin</h3>
            {filteredFinancials.map((row) => {
              const total = row.registration_revenue_cents + row.sponsor_revenue_cents;
              const margin = total > 0 ? ((row.net_revenue_cents / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={row.tournament_id} className="mb-3 last:mb-0">
                  <p className="text-xs text-gray-500">{row.tournament_name}</p>
                  <p className="mt-1 text-lg font-bold text-green-600">{margin}%</p>
                  <p className="text-xs text-gray-400">of total revenue</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
