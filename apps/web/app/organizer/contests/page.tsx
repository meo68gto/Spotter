"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type ContestType = "closest_to_pin" | "longest_drive" | "straightest_shot" | "skin" | "putting" | "custom";
type ContestStatus = "open" | "closed" | "cancelled";

interface Contest {
  id: string;
  tournament_id: string;
  name: string;
  description: string | null;
  contest_type: ContestType;
  status: ContestStatus;
  prize_description: string | null;
  prize_value_cents: number | null;
  hole_number: number | null;
  winner_user_id: string | null;
  winner_notes: string | null;
  closed_at: string | null;
  created_at: string;
  // Joined
  winner_name?: string;
}

interface Tournament {
  id: string;
  name: string;
  event_date: string;
}

const mockTournaments: Tournament[] = [
  { id: "evt-1", name: "Spring Championship Tournament", event_date: "2024-04-15" },
  { id: "evt-2", name: "Corporate Team Building Scramble", event_date: "2024-04-22" },
  { id: "evt-3", name: "Charity Golf Fundraiser", event_date: "2024-05-10" },
];

const mockContests: Contest[] = [
  { id: "c-1", tournament_id: "evt-1", name: "Closest to Pin #3", description: "Closest to pin on the par-3 3rd hole", contest_type: "closest_to_pin", status: "open", prize_description: "$100 Pro Shop Gift Card", prize_value_cents: 10000, hole_number: 3, winner_user_id: null, winner_notes: null, closed_at: null, created_at: "2024-03-01T00:00:00Z" },
  { id: "c-2", tournament_id: "evt-1", name: "Longest Drive #7", description: "Longest drive on the par-5 7th hole", contest_type: "longest_drive", status: "open", prize_description: "$150 Pro Shop Gift Card", prize_value_cents: 15000, hole_number: 7, winner_user_id: null, winner_notes: null, closed_at: null, created_at: "2024-03-01T00:00:00Z" },
  { id: "c-3", tournament_id: "evt-1", name: "Putting Contest", description: "Closest to pin from 30 feet on the practice green", contest_type: "putting", status: "open", prize_description: "$75 Pro Shop Gift Card", prize_value_cents: 7500, hole_number: null, winner_user_id: null, winner_notes: null, closed_at: null, created_at: "2024-03-01T00:00:00Z" },
  { id: "c-4", tournament_id: "evt-1", name: "Closest to Pin #12", description: "Closest to pin on the par-3 12th hole", contest_type: "closest_to_pin", status: "closed", prize_description: "$100 Pro Shop Gift Card", prize_value_cents: 10000, hole_number: 12, winner_user_id: "user-99", winner_notes: "3 feet 2 inches", closed_at: "2024-04-15T14:00:00Z", created_at: "2024-03-01T00:00:00Z", winner_name: "Tom Brady" },
];

const contestTypeLabels: Record<ContestType, string> = {
  closest_to_pin: "Closest to Pin",
  longest_drive: "Longest Drive",
  straightest_shot: "Straightest Shot",
  skin: "Skin",
  putting: "Putting Contest",
  custom: "Custom",
};

const statusColors: Record<ContestStatus, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function ContestsPage() {
  const [contests, setContests] = useState<Contest[]>(mockContests);
  const [tournaments] = useState<Tournament[]>(mockTournaments);
  const [selectedTournament, setSelectedTournament] = useState<string>("evt-1");
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);

  // Real Supabase fetch
  useEffect(() => {
    const fetchContests = async () => {
      setIsLoading(true);
      try {
        const { data, error } = supabase
          ? await supabase.from("contests").select("*").eq("tournament_id", selectedTournament).order("created_at", { ascending: true }).limit(50)
          : { data: null, error: null };

        if (!error && data && data.length > 0) {
          setContests(data);
        }
      } catch {
        // Fall back to mock
      } finally {
        setIsLoading(false);
      }
    };
    fetchContests();
  }, [selectedTournament]);

  const handleCloseContest = async (contest: Contest) => {
    const original = [...contests];
    setContests((prev) =>
      prev.map((c) => (c.id === contest.id ? { ...c, status: "closed", closed_at: new Date().toISOString() } : c))
    );

    try {
      if (supabase) {
        const { error } = await supabase.from("contests").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", contest.id);
        if (error) throw error;
      }
    } catch {
      setContests(original);
    }
  };

  const handleSetWinner = async (contest: Contest, winnerName: string, notes: string) => {
    const original = [...contests];
    setContests((prev) =>
      prev.map((c) =>
        c.id === contest.id ? { ...c, winner_name: winnerName, winner_notes: notes, status: "closed" as ContestStatus, closed_at: new Date().toISOString() } : c
      )
    );
    setEditingContest(null);

    try {
      if (supabase) {
        const { error } = await supabase.from("contests").update({ winner_user_id: "user-manual", winner_notes: notes, status: "closed", closed_at: new Date().toISOString() }).eq("id", contest.id);
        if (error) throw error;
      }
    } catch {
      setContests(original);
    }
  };

  const handleCreateContest = async (contest: Omit<Contest, "id" | "created_at" | "status" | "winner_user_id" | "winner_notes" | "closed_at">) => {
    const newContest: Contest = {
      ...contest,
      id: `c-${Date.now()}`,
      status: "open",
      winner_user_id: null,
      winner_notes: null,
      closed_at: null,
      created_at: new Date().toISOString(),
    };

    setContests((prev) => [...prev, newContest]);
    setShowCreateModal(false);

    try {
      if (supabase) {
        const { error } = await supabase.from("contests").insert(newContest).select().single();
        if (error) throw error;
      }
    } catch {
      // Mock mode — already added locally
    }
  };

  const openContests = contests.filter((c) => c.status === "open");
  const closedContests = contests.filter((c) => c.status === "closed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contests</h1>
          <p className="text-gray-600">Track closest-to-pin, longest drive, and putting contests.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Contest
        </button>
      </div>

      {/* Tournament Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Event:</label>
        <select
          value={selectedTournament}
          onChange={(e) => setSelectedTournament(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm border p-2 text-sm"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {isLoading && <span className="text-sm text-gray-400">Loading...</span>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Contests</p>
          <p className="text-2xl font-bold text-gray-900">{contests.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Open</p>
          <p className="text-2xl font-bold text-green-600">{openContests.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Closed / Winners Set</p>
          <p className="text-2xl font-bold text-gray-600">{closedContests.length}</p>
        </div>
      </div>

      {/* Open Contests */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Open Contests</h2>
        <div className="space-y-3">
          {openContests.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No open contests. Create one to get started.
            </div>
          ) : (
            openContests.map((contest) => (
              <div key={contest.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{contest.name}</p>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[contest.status]}`}>
                        {contest.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {contestTypeLabels[contest.contest_type]}
                      {contest.hole_number ? ` — Hole #${contest.hole_number}` : ""}
                      {contest.prize_value_cents ? ` · ${formatCents(contest.prize_value_cents)} prize` : ""}
                    </p>
                    {contest.description && (
                      <p className="text-sm text-gray-400 mt-0.5">{contest.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingContest(contest)}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium hover:bg-indigo-200"
                  >
                    Enter Winner
                  </button>
                  <button
                    onClick={() => handleCloseContest(contest)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200"
                  >
                    Close (No Winner)
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Closed Contests with Winners */}
      {closedContests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Results</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hole</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Winner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prize</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {closedContests.map((contest) => (
                  <tr key={contest.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{contest.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{contestTypeLabels[contest.contest_type]}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{contest.hole_number ? `#${contest.hole_number}` : "—"}</td>
                    <td className="px-6 py-4">
                      {contest.winner_name ? (
                        <span className="text-sm font-medium text-green-700">{contest.winner_name} 🏆</span>
                      ) : (
                        <span className="text-sm text-gray-400">No winner</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{contest.winner_notes || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {contest.prize_value_cents ? formatCents(contest.prize_value_cents) : contest.prize_description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Contest Modal */}
      {showCreateModal && (
        <CreateContestModal
          tournamentId={selectedTournament}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreateContest}
        />
      )}

      {/* Set Winner Modal */}
      {editingContest && (
        <SetWinnerModal
          contest={editingContest}
          onClose={() => setEditingContest(null)}
          onSave={handleSetWinner}
        />
      )}
    </div>
  );
}

function CreateContestModal({
  tournamentId,
  onClose,
  onCreated,
}: {
  tournamentId: string;
  onClose: () => void;
  onCreated: (contest: Omit<Contest, "id" | "created_at" | "status" | "winner_user_id" | "winner_notes" | "closed_at">) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ContestType>("closest_to_pin");
  const [holeNumber, setHoleNumber] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [prizeValue, setPrizeValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreated({
      tournament_id: tournamentId,
      name,
      description: description || null,
      contest_type: type,
      prize_description: prizeDescription || null,
      prize_value_cents: prizeValue ? Math.round(parseFloat(prizeValue) * 100) : null,
      hole_number: holeNumber ? parseInt(holeNumber) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add Contest</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contest Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm" placeholder="e.g., Closest to Pin #3" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ContestType)} className="w-full rounded-md border border-gray-300 p-2 text-sm">
              {(Object.keys(contestTypeLabels) as ContestType[]).map((t) => (
                <option key={t} value={t}>{contestTypeLabels[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hole Number (optional)</label>
            <input type="number" min="1" max="18" value={holeNumber} onChange={(e) => setHoleNumber(e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm" placeholder="e.g., 3" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prize Description</label>
            <input type="text" value={prizeDescription} onChange={(e) => setPrizeDescription(e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm" placeholder="e.g., $100 Pro Shop Gift Card" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prize Value ($)</label>
            <input type="number" step="0.01" value={prizeValue} onChange={(e) => setPrizeValue(e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm" placeholder="0.00" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SetWinnerModal({ contest, onClose, onSave }: { contest: Contest; onClose: () => void; onSave: (contest: Contest, name: string, notes: string) => void }) {
  const [winnerName, setWinnerName] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(contest, winnerName, notes);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Enter Winner — {contest.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Winner Name</label>
            <input type="text" value={winnerName} onChange={(e) => setWinnerName(e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm" placeholder="e.g., Tom Brady" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Result (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm" placeholder="e.g., 3 feet 2 inches" />
          </div>
          {contest.prize_value_cents && (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <p className="text-sm text-green-800">Prize: <strong>{formatCents(contest.prize_value_cents)}</strong> — {contest.prize_description}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Save Winner</button>
          </div>
        </form>
      </div>
    </div>
  );
}
