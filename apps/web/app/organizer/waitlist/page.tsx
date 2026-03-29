"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type WaitlistStatus = "waiting" | "offered" | "accepted" | "declined" | "expired";

interface WaitlistEntry {
  id: string;
  tournament_id: string;
  user_id: string;
  position: number;
  status: WaitlistStatus;
  offered_at: string | null;
  offer_expires_at: string | null;
  created_at: string;
  // Joined fields
  user_email?: string;
  user_name?: string;
}

interface Tournament {
  id: string;
  name: string;
  event_date: string;
  max_participants: number;
  current_participants: number;
}

const mockTournaments: Tournament[] = [
  { id: "evt-1", name: "Spring Championship Tournament", event_date: "2024-04-15", max_participants: 120, current_participants: 89 },
  { id: "evt-2", name: "Corporate Team Building Scramble", event_date: "2024-04-22", max_participants: 80, current_participants: 0 },
  { id: "evt-3", name: "Charity Golf Fundraiser", event_date: "2024-05-10", max_participants: 144, current_participants: 0 },
];

const mockWaitlist: WaitlistEntry[] = [
  { id: "wl-1", tournament_id: "evt-1", user_id: "user-1", position: 1, status: "waiting", offered_at: null, offer_expires_at: null, created_at: "2024-03-15T10:00:00Z", user_email: "alice@example.com", user_name: "Alice Johnson" },
  { id: "wl-2", tournament_id: "evt-1", user_id: "user-2", position: 2, status: "waiting", offered_at: null, offer_expires_at: null, created_at: "2024-03-15T11:00:00Z", user_email: "bob@example.com", user_name: "Bob Smith" },
  { id: "wl-3", tournament_id: "evt-1", user_id: "user-3", position: 3, status: "offered", offered_at: "2024-03-18T10:00:00Z", offer_expires_at: "2024-03-19T10:00:00Z", created_at: "2024-03-15T12:00:00Z", user_email: "carol@example.com", user_name: "Carol Davis" },
  { id: "wl-4", tournament_id: "evt-1", user_id: "user-4", position: 4, status: "waiting", offered_at: null, offer_expires_at: null, created_at: "2024-03-16T09:00:00Z", user_email: "dave@example.com", user_name: "Dave Wilson" },
  { id: "wl-5", tournament_id: "evt-1", user_id: "user-5", position: 5, status: "expired", offered_at: "2024-03-17T10:00:00Z", offer_expires_at: "2024-03-18T10:00:00Z", created_at: "2024-03-15T13:00:00Z", user_email: "eve@example.com", user_name: "Eve Martinez" },
];

const statusColors: Record<WaitlistStatus, string> = {
  waiting: "bg-indigo-100 text-indigo-800",
  offered: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-gray-100 text-gray-600",
  expired: "bg-red-100 text-red-800",
};

export default function WaitlistPage() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(mockWaitlist);
  const [tournaments] = useState<Tournament[]>(mockTournaments);
  const [selectedTournament, setSelectedTournament] = useState<string>("evt-1");
  const [isLoading, setIsLoading] = useState(false);
  const [autoRemoveEnabled, setAutoRemoveEnabled] = useState(true);

  // Real Supabase fetch
  useEffect(() => {
    const fetchWaitlist = async () => {
      setIsLoading(true);
      try {
        const { data, error } = supabase
          ? await supabase.from("waitlist_queue").select("*").eq("tournament_id", selectedTournament).order("position", { ascending: true }).limit(100)
          : { data: null, error: null };

        if (!error && data && data.length > 0) {
          setWaitlist(data);
        }
      } catch {
        // Fall back to mock
      } finally {
        setIsLoading(false);
      }
    };
    fetchWaitlist();
  }, [selectedTournament]);

  const handlePromote = async (entry: WaitlistEntry) => {
    // Optimistic update
    const original = [...waitlist];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    setWaitlist((prev) =>
      prev.map((w) =>
        w.id === entry.id ? { ...w, status: "offered", offered_at: new Date().toISOString(), offer_expires_at: expiresAt } : w
      )
    );

    try {
      const updates: Record<string, unknown> = { status: "offered", offered_at: new Date().toISOString(), offer_expires_at: expiresAt };
      if (supabase) {
        const { error } = await supabase.from("waitlist_queue").update(updates).eq("id", entry.id);
        if (error) throw error;
      }
    } catch {
      setWaitlist(original);
    }
  };

  const handleRemove = async (entry: WaitlistEntry) => {
    const original = [...waitlist];
    setWaitlist((prev) => prev.filter((w) => w.id !== entry.id));

    try {
      if (supabase) {
        const { error } = await supabase.from("waitlist_queue").update({ status: "declined", declined_at: new Date().toISOString() }).eq("id", entry.id);
        if (error) throw error;
      }
    } catch {
      setWaitlist(original);
    }
  };

  const handlePromoteToConfirmed = async (entry: WaitlistEntry) => {
    const original = [...waitlist];
    setWaitlist((prev) =>
      prev.map((w) =>
        w.id === entry.id ? { ...w, status: "accepted", accepted_at: new Date().toISOString() } : w
      )
    );

    try {
      if (supabase) {
        const { error } = await supabase.from("waitlist_queue").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", entry.id);
        if (error) throw error;
      }
    } catch {
      setWaitlist(original);
    }
  };

  const selectedEvent = tournaments.find((t) => t.id === selectedTournament);
  const spotsAvailable = selectedEvent ? selectedEvent.max_participants - selectedEvent.current_participants : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
          <p className="text-gray-600">Manage event waitlists and promote players.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRemoveEnabled}
              onChange={(e) => setAutoRemoveEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-remove on spot open
          </label>
        </div>
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
            <option key={t.id} value={t.id}>
              {t.name} — {t.event_date} ({t.current_participants}/{t.max_participants})
            </option>
          ))}
        </select>
        {isLoading && <span className="text-sm text-gray-400">Loading...</span>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Waitlisted</p>
          <p className="text-2xl font-bold text-gray-900">{waitlist.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Waiting</p>
          <p className="text-2xl font-bold text-indigo-600">{waitlist.filter(w => w.status === "waiting").length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Offered</p>
          <p className="text-2xl font-bold text-yellow-600">{waitlist.filter(w => w.status === "offered").length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Spots Available</p>
          <p className="text-2xl font-bold text-green-600">{spotsAvailable}</p>
        </div>
      </div>

      {/* Waitlist Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Golfer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waitlisted</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Offer Expires</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {waitlist.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No one on the waitlist for this event.
                </td>
              </tr>
            ) : (
              waitlist.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{entry.position}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{entry.user_name || "Unknown"}</div>
                    <div className="text-sm text-gray-500">{entry.user_email || "—"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[entry.status]}`}>
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {entry.offer_expires_at ? (
                      <span className={new Date(entry.offer_expires_at) < new Date() ? "text-red-600" : "text-gray-500"}>
                        {new Date(entry.offer_expires_at).toLocaleDateString()}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {entry.status === "waiting" && spotsAvailable > 0 && (
                        <button
                          onClick={() => handlePromote(entry)}
                          className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium hover:bg-indigo-200"
                        >
                          Offer Spot
                        </button>
                      )}
                      {entry.status === "offered" && (
                        <button
                          onClick={() => handlePromoteToConfirmed(entry)}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium hover:bg-green-200"
                        >
                          Confirm
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(entry)}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-indigo-800">
          <strong>How it works:</strong> When a confirmed registration is cancelled, the first person on the waitlist 
          {autoRemoveEnabled ? " is automatically offered a spot and removed if they don't respond within 24 hours." : " is notified and can manually accept."} 
          Promoting a waitlisted player charges their card on file and moves them to confirmed status.
        </p>
      </div>
    </div>
  );
}
