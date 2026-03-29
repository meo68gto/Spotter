'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FulfillmentStatus = 'pending' | 'in_progress' | 'completed' | 'missed';

interface Deliverable {
  id: string;
  description: string;
  status: FulfillmentStatus;
  deliveryDate?: string;
  notes?: string;
}

interface SponsorFulfillment {
  id: string;
  sponsorName: string;
  tier: 'bronze' | 'silver' | 'gold';
  contractValueCents: number;
  contractName: string;
  deliverables: Deliverable[];
}

// ---------------------------------------------------------------------------
// Mock data (matches pattern of existing organizer pages)
// ---------------------------------------------------------------------------

const mockTournament = {
  id: 'evt-1',
  name: 'Spring Championship Tournament',
  startTime: '2024-04-15T08:00:00Z',
};

const mockSponsors: SponsorFulfillment[] = [
  {
    id: 'sp-1',
    sponsorName: 'Acme Golf Balls',
    tier: 'gold',
    contractValueCents: 500000,
    contractName: 'Gold Sponsorship Agreement',
    deliverables: [
      { id: 'd1', description: 'Logo on all event signage', status: 'completed', deliveryDate: '2024-03-15' },
      { id: 'd2', description: 'Banner at registration table', status: 'completed', deliveryDate: '2024-03-20' },
      { id: 'd3', description: 'Logo on tournament website', status: 'completed', deliveryDate: '2024-03-01' },
      { id: 'd4', description: 'Social media mention (10 posts)', status: 'in_progress', notes: '8 of 10 posts done' },
      { id: 'd5', description: 'Product sample bags (200 units)', status: 'pending', deliveryDate: '2024-04-10' },
    ],
  },
  {
    id: 'sp-2',
    sponsorName: 'Scottsdale Pro Shop',
    tier: 'silver',
    contractValueCents: 250000,
    contractName: 'Silver Sponsorship Agreement',
    deliverables: [
      { id: 'd6', description: 'Logo on scorecards', status: 'completed', deliveryDate: '2024-03-25' },
      { id: 'd7', description: 'Logo on golf cart signs', status: 'in_progress', notes: 'Printing in progress' },
      { id: 'd8', description: 'Prize donation (golf clubs)', status: 'pending' },
    ],
  },
  {
    id: 'sp-3',
    sponsorName: 'Desert Springs Water',
    tier: 'bronze',
    contractValueCents: 75000,
    contractName: 'Bronze Sponsorship Agreement',
    deliverables: [
      { id: 'd9', description: 'Logo on beverage stations', status: 'pending', deliveryDate: '2024-04-14' },
      { id: 'd10', description: 'Water bottles for players (100)', status: 'pending', deliveryDate: '2024-04-14' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<FulfillmentStatus, { bg: string; text: string; dot: string; label: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-800', dot: 'bg-yellow-400', label: 'Pending' },
  in_progress: { bg: 'bg-indigo-50', text: 'text-indigo-800', dot: 'bg-indigo-400', label: 'In Progress' },
  completed: { bg: 'bg-green-50', text: 'text-green-800', dot: 'bg-green-400', label: 'Fulfilled' },
  missed: { bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-400', label: 'Missed' },
};

const TIER_STYLES: Record<string, { bg: string; text: string }> = {
  gold: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  silver: { bg: 'bg-gray-100', text: 'text-gray-700' },
  bronze: { bg: 'bg-orange-100', text: 'text-orange-800' },
};

function fmtCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FulfillmentPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const [sponsors, setSponsors] = useState<SponsorFulfillment[]>(mockSponsors);
  const [selectedStatus, setSelectedStatus] = useState<FulfillmentStatus>('pending');
  const [expandedSponsor, setExpandedSponsor] = useState<string | null>('sp-1');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const handleStatusChange = (sponsorId: string, deliverableId: string, status: FulfillmentStatus) => {
    setSponsors((prev) =>
      prev.map((sp) =>
        sp.id === sponsorId
          ? {
              ...sp,
              deliverables: sp.deliverables.map((d) =>
                d.id === deliverableId ? { ...d, status } : d,
              ),
            }
          : sp,
      ),
    );
  };

  const overallProgress = sponsors.map((sp) => ({
    ...sp,
    completed: sp.deliverables.filter((d) => d.status === 'completed').length,
    total: sp.deliverables.length,
  }));

  const totalDeliverables = overallProgress.reduce((sum, sp) => sum + sp.total, 0);
  const completedDeliverables = overallProgress.reduce((sum, sp) => sum + sp.completed, 0);
  const progressPercent = totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0;

  const statusCounts = {
    pending: sponsors.flatMap((sp) => sp.deliverables).filter((d) => d.status === 'pending').length,
    in_progress: sponsors.flatMap((sp) => sp.deliverables).filter((d) => d.status === 'in_progress').length,
    completed: sponsors.flatMap((sp) => sp.deliverables).filter((d) => d.status === 'completed').length,
    missed: sponsors.flatMap((sp) => sp.deliverables).filter((d) => d.status === 'missed').length,
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/organizer/events" className="hover:text-gray-700">Events</Link>
        <span>/</span>
        <Link href={`/organizer/events/${tournamentId}`} className="hover:text-gray-700">{mockTournament.name}</Link>
        <span>/</span>
        <span className="text-gray-900">Fulfillment</span>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sponsor Fulfillment</h1>
          <p className="text-gray-600 mt-1">
            Track deliverables for <span className="font-medium">{mockTournament.name}</span>
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href={`/api/operator/tournaments/${tournamentId}/wrap-report/pdf`}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            target="_blank"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Wrap Report
          </Link>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Overall Fulfillment Progress</h2>
          <span className="text-sm font-bold text-indigo-700">{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {completedDeliverables} of {totalDeliverables} deliverables completed
        </p>

        {/* Status summary pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {(Object.keys(statusCounts) as FulfillmentStatus[]).map((status) => {
            const s = STATUS_STYLES[status];
            const count = statusCounts[status];
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedStatus === status
                    ? `${s.bg} ${s.text} ring-2 ring-offset-1 ring-${s.dot.replace('bg-', '')}`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} mr-1.5`} />
                {s.label}: {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sponsor cards */}
      <div className="space-y-4">
        {sponsors.map((sponsor) => {
          const spProgress = overallProgress.find((p) => p.id === sponsor.id)!;
          const spPercent = spProgress.total > 0 ? Math.round((spProgress.completed / spProgress.total) * 100) : 0;
          const isExpanded = expandedSponsor === sponsor.id;
          const tierStyle = TIER_STYLES[sponsor.tier] ?? TIER_STYLES.bronze;

          // Filter by selected status
          const visibleDeliverables = selectedStatus
            ? sponsor.deliverables.filter((d) => d.status === selectedStatus)
            : sponsor.deliverables;

          if (!isExpanded && selectedStatus && visibleDeliverables.length === 0) {
            return null; // Don't show this sponsor if no matching deliverables
          }

          return (
            <div key={sponsor.id} className="bg-white rounded-lg shadow">
              {/* Sponsor header */}
              <button
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedSponsor(isExpanded ? null : sponsor.id)}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-indigo-700 font-bold text-sm">
                      {sponsor.sponsorName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-semibold text-gray-900">{sponsor.sponsorName}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${tierStyle.bg} ${tierStyle.text}`}>
                        {sponsor.tier}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{sponsor.contractName} · {fmtCents(sponsor.contractValueCents)}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  {/* Mini progress */}
                  <div className="hidden sm:flex items-center space-x-2 w-40">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${spPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 font-medium w-12">
                      {spProgress.completed}/{spProgress.total}
                    </span>
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded deliverables */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-6 pb-6">
                  <div className="pt-4 space-y-2">
                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="col-span-5">Deliverable</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-3">Delivery Date</div>
                      <div className="col-span-2">Actions</div>
                    </div>

                    {sponsor.deliverables.map((deliverable) => {
                      const ds = STATUS_STYLES[deliverable.status];
                      const isNoteOpen = notes[`${sponsor.id}-${deliverable.id}`];

                      return (
                        <div
                          key={deliverable.id}
                          className={`grid grid-cols-12 gap-4 items-center px-4 py-3 rounded-lg ${ds.bg} transition-colors`}
                        >
                          {/* Description */}
                          <div className="col-span-5">
                            <p className="text-sm font-medium text-gray-900">{deliverable.description}</p>
                            {deliverable.notes && (
                              <p className="text-xs text-gray-500 mt-0.5">{deliverable.notes}</p>
                            )}
                          </div>

                          {/* Status badge */}
                          <div className="col-span-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ds.bg} ${ds.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${ds.dot} mr-1.5`} />
                              {ds.label}
                            </span>
                          </div>

                          {/* Delivery date */}
                          <div className="col-span-3">
                            <p className="text-sm text-gray-700">
                              {deliverable.deliveryDate ? fmtDate(deliverable.deliveryDate) : '—'}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="col-span-2 flex items-center space-x-2">
                            {/* Status update dropdown */}
                            <select
                              className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              value={deliverable.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  sponsor.id,
                                  deliverable.id,
                                  e.target.value as FulfillmentStatus,
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="missed">Missed</option>
                            </select>

                            {/* Notes toggle */}
                            <button
                              className="text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Add note"
                              onClick={(e) => {
                                e.stopPropagation();
                                const key = `${sponsor.id}-${deliverable.id}`;
                                setNotes((prev) => ({ ...prev, [key]: prev[key] ?? '' }));
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>

                          {/* Inline notes field */}
                          {isNoteOpen !== undefined && (
                            <div className="col-span-12 mt-2">
                              <input
                                type="text"
                                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="Add a note..."
                                value={notes[`${sponsor.id}-${deliverable.id}`]}
                                onChange={(e) =>
                                  setNotes((prev) => ({
                                    ...prev,
                                    [`${sponsor.id}-${deliverable.id}`]: e.target.value,
                                  }))
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
