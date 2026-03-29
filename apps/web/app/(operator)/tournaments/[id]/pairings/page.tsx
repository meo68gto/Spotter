'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Player {
  id: string;
  name: string;
  email?: string;
  handicap?: number;
  status: 'registered' | 'confirmed' | 'checked_in';
}

export interface Flight {
  id: string;
  name: string;
  teeTime: string;
  cartNumber?: string;
  startHole: number;
  course_id?: string;
  notes?: string;
  players: Player[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTeeTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function STATUS_COLOR(status: Player['status']): string {
  switch (status) {
    case 'checked_in': return 'bg-green-100 text-green-800';
    case 'confirmed':  return 'bg-indigo-100 text-indigo-800';
    default:           return 'bg-yellow-100 text-yellow-800';
  }
}

function STATUS_LABEL(status: Player['status']): string {
  switch (status) {
    case 'checked_in': return 'Checked In';
    case 'confirmed':  return 'Confirmed';
    default:           return 'Registered';
  }
}

// Map DB snake_case to UI camelCase
function mapFlight(db: Record<string, unknown>): Flight {
  const playersRaw = (db['players'] as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    id: db['id'] as string,
    name: (db['flight_name'] as string) ?? '',
    teeTime: (db['tee_time'] as string) ?? '',
    cartNumber: db['cart_number'] as string | undefined,
    startHole: (db['starting_hole'] as number) ?? 1,
    course_id: db['course_id'] as string | undefined,
    notes: db['notes'] as string | undefined,
    players: playersRaw.map((fp) => {
      const user = fp['users'] as Record<string, unknown> | undefined;
      return {
        id: fp['player_id'] as string,
        name: (user?.['display_name'] as string) ?? (user?.['full_name'] as string) ?? 'Unknown',
        email: user?.['email'] as string | undefined,
        handicap: user?.['handicap'] as number | undefined,
        status: 'confirmed',
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Player Card
// ---------------------------------------------------------------------------

interface PlayerCardProps {
  player: Player;
  flightId?: string;
  isDragging?: boolean;
  onRemove?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

function PlayerCard({ player, isDragging, onRemove, onDragStart, onDragEnd }: PlayerCardProps) {
  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg border transition-all
        ${isDragging ? 'opacity-40 border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'}
      `}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-indigo-700">{player.name.charAt(0)}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{player.name}</p>
        <div className="flex items-center gap-2">
          {player.handicap !== undefined && (
            <span className="text-xs text-gray-500">HDCP {player.handicap}</span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR(player.status)}`}>
            {STATUS_LABEL(player.status)}
          </span>
        </div>
      </div>

      {onRemove && (
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors"
          title="Remove from flight"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flight Card
// ---------------------------------------------------------------------------

interface FlightCardProps {
  flight: Flight;
  isDragOver?: boolean;
  onDrop?: (playerId: string) => void;
  onRemovePlayer?: (playerId: string) => void;
  onDelete?: () => void;
  onUpdateTeeTime?: (time: string) => void;
  onUpdateCart?: (cart: string) => void;
}

function FlightCard({ flight, isDragOver, onDrop, onRemovePlayer, onDelete }: FlightCardProps) {
  const [editingTime, setEditingTime] = useState(false);
  const [editingCart, setEditingCart] = useState(false);
  const [timeVal, setTimeVal] = useState(flight.teeTime ? flight.teeTime.slice(11, 16) : '');
  const [cartVal, setCartVal] = useState(flight.cartNumber ?? '');

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('playerId');
    if (playerId && onDrop) onDrop(playerId);
  };

  return (
    <div
      className={`
        rounded-xl border-2 transition-all
        ${isDragOver ? 'border-indigo-400 bg-indigo-50 shadow-md' : 'border-gray-200 bg-white'}
      `}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={handleDrop}
    >
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{flight.name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {flight.teeTime ? formatTeeTime(flight.teeTime) : '—'}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {flight.cartNumber ?? 'No cart #'}
            </span>
            <span className="text-xs text-gray-500">Hole {flight.startHole}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {flight.players.length} players
          </span>
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Delete flight"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2 min-h-[80px]">
        {flight.players.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg py-6 text-center text-sm text-gray-400">
            Drop players here
          </div>
        ) : (
          flight.players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onRemove={() => onRemovePlayer?.(player.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData('playerId', player.id);
                e.dataTransfer.setData('sourceFlightId', flight.id);
              }}
              onDragEnd={(e) => {
                e.dataTransfer.clearData('playerId');
                e.dataTransfer.clearData('sourceFlightId');
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unassigned Panel
// ---------------------------------------------------------------------------

function UnassignedPanel({ players, onAssign }: { players: Player[]; onAssign: (playerId: string) => void }) {
  return (
    <div className="bg-white rounded-xl border-2 border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Unassigned</h3>
            <p className="text-xs text-gray-500 mt-0.5">{players.length} players not in a flight</p>
          </div>
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {players.length}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {players.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">All players assigned ✓</p>
        ) : (
          players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
            >
              <div className="flex-1">
                <PlayerCard
                  player={player}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('playerId', player.id);
                    e.dataTransfer.setData('sourceFlightId', 'unassigned');
                  }}
                  onDragEnd={(e) => {
                    e.dataTransfer.clearData('playerId');
                    e.dataTransfer.clearData('sourceFlightId');
                  }}
                />
              </div>
              <button
                onClick={() => onAssign(player.id)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
              >
                + Add to flight
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Flight Modal
// ---------------------------------------------------------------------------

interface AddFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (flight: { flight_name: string; tee_time: string; cart_number?: string; starting_hole: number; course_id?: string; notes?: string }) => void;
  nextTeeTime?: string;
}

function AddFlightModal({ isOpen, onClose, onAdd, nextTeeTime }: AddFlightModalProps) {
  const [name, setName] = useState('');
  const [teeTime, setTeeTime] = useState(nextTeeTime?.slice(11, 16) ?? '09:00');
  const [cartNumber, setCartNumber] = useState('');
  const [startHole, setStartHole] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !teeTime) return;
    setIsSubmitting(true);
    // Use today's date for the tee time date portion
    const today = new Date().toISOString().slice(0, 10);
    onAdd({
      flight_name: name.trim(),
      tee_time: `${today}T${teeTime}:00`,
      cart_number: cartNumber.trim() || undefined,
      starting_hole: parseInt(startHole),
    });
    setName('');
    setCartNumber('');
    setStartHole('1');
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Add New Flight</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Flight Name *</label>
            <input
              type="text"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Flight 5 — 9:30 AM"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tee Time *</label>
              <input
                type="time"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={teeTime}
                onChange={(e) => setTeeTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cart Number</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="C-05"
                value={cartNumber}
                onChange={(e) => setCartNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Hole</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={startHole}
              onChange={(e) => setStartHole(e.target.value)}
            >
              <option value="1">Hole 1</option>
              <option value="10">Hole 10</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Flight'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PairingsPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [flights, setFlights] = useState<Flight[]>([]);
  const [unassigned, setUnassigned] = useState<Player[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [dragOverFlightId, setDragOverFlightId] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentDate, setTournamentDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch flights and unassigned players
  const fetchData = useCallback(async () => {
    try {
      const [flightsRes, regRes] = await Promise.all([
        fetch(`/api/operator/tournaments/${tournamentId}/pairings`),
        fetch(`/api/operator/tournaments/${tournamentId}/checkin`),
      ]);

      if (!flightsRes.ok) {
        throw new Error(`Failed to load pairings: ${flightsRes.status}`);
      }

      const flightsData = await flightsRes.json();
      const flightList: Flight[] = Array.isArray(flightsData) ? flightsData.map(mapFlight) : [];

      // Fetch unassigned players from registrations that aren't in any flight
      let unassignedPlayers: Player[] = [];
      if (regRes.ok) {
        const regData = await regRes.json();
        const registrations: Array<Record<string, unknown>> = regData.registrations ?? [];
        const assignedUserIds = new Set(
          flightList.flatMap((f) => f.players.map((p) => p.id))
        );
        unassignedPlayers = registrations
          .filter((r) => !assignedUserIds.has(r['user_id'] as string))
          .map((r) => ({
            id: r['user_id'] as string,
            name: (r['user'] as Record<string, unknown>)?.['display_name'] as string
              ?? (r['user'] as Record<string, unknown>)?.['full_name'] as string
              ?? 'Unknown',
            email: (r['user'] as Record<string, unknown>)?.['email'] as string | undefined,
            handicap: (r['user'] as Record<string, unknown>)?.['handicap'] as number | undefined,
            status: (r['status'] as Player['status']) ?? 'registered',
          }));
      }

      setFlights(flightList);
      setUnassigned(unassignedPlayers);

      // Fetch tournament info
      const tourneyRes = await fetch(`/api/operator/tournaments/${tournamentId}`);
      if (tourneyRes.ok) {
        const tourney = await tourneyRes.json();
        setTournamentName(tourney.title ?? tourney.name ?? 'Tournament');
        setTournamentDate(tourney.start_time ?? tourney.startTime ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Move player to a different flight via API
  const movePlayer = useCallback(async (playerId: string, fromFlightId: string, toFlightId: string) => {
    try {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/pairings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, fromFlightId, toFlightId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Move failed');
      }
      // Refresh data
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Move failed');
    }
  }, [tournamentId, fetchData]);

  // Handle drag-drop between flights
  const handleDrop = useCallback((targetFlightId: string) => {
    return async (playerId: string) => {
      setDragOverFlightId(null);

      // Find source
      let fromFlightId: string | null = null;
      flights.forEach((f) => {
        if (f.players.some((p) => p.id === playerId)) fromFlightId = f.id;
      });

      if (!fromFlightId) {
        // From unassigned — just optimistically update UI + POST
        const player = unassigned.find((p) => p.id === playerId);
        if (!player) return;

        // For now, we need a different approach: POST to add player to flight
        // We don't have an "add player to flight" endpoint — using PATCH pairings
        // The PATCH endpoint requires fromFlightId, so we can't use it for unassigned
        // Instead, we'll do a POST to create a flight_players record directly
        try {
          const res = await fetch(`/api/operator/tournaments/${tournamentId}/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: playerId, flightId: targetFlightId }),
          });
          if (res.ok) await fetchData();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Failed to assign');
        }
        return;
      }

      if (fromFlightId === targetFlightId) return;
      await movePlayer(playerId, fromFlightId, targetFlightId);
    };
  }, [flights, unassigned, tournamentId, movePlayer, fetchData]);

  // Remove player from flight (move to unassigned)
  const handleRemoveFromFlight = useCallback(async (flightId: string, playerId: string) => {
    // Find first flight to move to (or keep as unassigned)
    try {
      // Move player to first flight, then we'll remove them via the first flight
      // Actually, we should unassign — delete from flight_players
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: playerId, action: 'remove_from_flight', flightId }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error ?? 'Failed to remove');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove');
    }
  }, [tournamentId, fetchData]);

  // Create new flight
  const handleAddFlight = useCallback(async (data: { flight_name: string; tee_time: string; cart_number?: string; starting_hole: number; course_id?: string; notes?: string }) => {
    try {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/pairings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create flight');
      }
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create flight');
    }
  }, [tournamentId, fetchData]);

  // Delete flight
  const handleDeleteFlight = useCallback(async (flightId: string) => {
    if (!confirm('Delete this flight? Players will be moved to unassigned.')) return;
    try {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/pairings?flightId=${flightId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to delete flight');
      }
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete flight');
    }
  }, [tournamentId, fetchData]);

  // Assign unassigned player to a flight
  const handleAssignDirect = useCallback(async (playerId: string) => {
    if (flights.length === 0) {
      alert('Create a flight first');
      return;
    }
    const target = flights.find((f) => f.players.length < 4) ?? flights[0];
    try {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: playerId, flightId: target.id }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error ?? 'Failed to assign');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign');
    }
  }, [tournamentId, flights, fetchData]);

  const nextTeeTime = flights.length > 0 ? flights[flights.length - 1].teeTime : undefined;
  const totalPlayers = flights.reduce((s, f) => s + f.players.length, 0) + unassigned.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading pairings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500">{error}</p>
        <button onClick={fetchData} className="text-indigo-600 hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 min-h-screen bg-gray-50 print:bg-white">
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/tournaments" className="hover:text-gray-700">Tournaments</Link>
        <span>/</span>
        <Link href={`/tournaments/${tournamentId}/fulfillment`} className="hover:text-gray-700">Fulfillment</Link>
        <span>/</span>
        <span className="text-gray-900">Pairings</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flight / Pairing Board</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {tournamentName} · {tournamentDate ? formatDate(tournamentDate) : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Flight
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Flights', value: flights.length, color: 'text-indigo-700' },
          { label: 'Players Assigned', value: flights.reduce((s, f) => s + f.players.length, 0), color: 'text-green-700' },
          { label: 'Unassigned', value: unassigned.length, color: unassigned.length > 0 ? 'text-amber-700' : 'text-gray-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow px-4 py-3">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">{tournamentName}</h1>
        <p className="text-sm text-gray-600">{tournamentDate ? formatDate(tournamentDate) : ''}</p>
        <p className="text-sm text-gray-600">Flight / Pairing Sheet — Printed {new Date().toLocaleDateString()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {flights.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 font-medium">No flights created yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 text-indigo-600 text-sm font-medium hover:underline"
              >
                + Add your first flight
              </button>
            </div>
          ) : (
            flights.map((flight) => (
              <FlightCard
                key={flight.id}
                flight={flight}
                isDragOver={dragOverFlightId === flight.id}
                onDrop={handleDrop(flight.id)}
                onRemovePlayer={(playerId) => handleRemoveFromFlight(flight.id, playerId)}
                onDelete={() => handleDeleteFlight(flight.id)}
              />
            ))
          )}
        </div>

        <div className="space-y-4">
          <UnassignedPanel players={unassigned} onAssign={handleAssignDirect} />

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Players</span>
                <span className="font-semibold text-gray-900">{totalPlayers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Flights</span>
                <span className="font-semibold text-gray-900">{flights.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg per Flight</span>
                <span className="font-semibold text-gray-900">
                  {flights.length > 0 ? (flights.reduce((s, f) => s + f.players.length, 0) / flights.length).toFixed(1) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Unassigned</span>
                <span className={`font-semibold ${unassigned.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {unassigned.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddFlightModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddFlight}
        nextTeeTime={nextTeeTime}
      />
    </div>
  );
}
