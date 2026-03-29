'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VendorStatus = 'confirmed' | 'pending' | 'on-site';

interface Vendor {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  role: string;
  notes: string;
  status: VendorStatus;
  addedAt: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_VENDORS: Vendor[] = [
  {
    id: 'v1',
    name: 'Ace Carts LLC',
    contactName: 'Mike Reynolds',
    contactEmail: 'mike@acecarts.com',
    contactPhone: '+1 480-555-0101',
    role: 'Golf Cart Rental',
    notes: '30 carts confirmed. Arriving 6:30 AM. Need staging area near clubhouse.',
    status: 'confirmed',
    addedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'v2',
    name: 'Pro Shop Supply Co.',
    contactName: 'Sarah Kim',
    contactEmail: 'sarah@proshop.com',
    contactPhone: '+1 480-555-0202',
    role: 'Equipment Vendor',
    notes: 'Bringing demo clubs and fitting station. Booth setup by 7 AM.',
    status: 'on-site',
    addedAt: '2024-02-15T09:00:00Z',
  },
  {
    id: 'v3',
    name: 'Taste of the Valley Catering',
    contactName: 'Carlos Mendez',
    contactEmail: 'carlos@tastecatering.com',
    contactPhone: '+1 480-555-0303',
    role: 'Catering',
    notes: 'Lunch for 120. Menu confirmed. Dietary restrictions list sent.',
    status: 'confirmed',
    addedAt: '2024-02-20T14:00:00Z',
  },
  {
    id: 'v4',
    name: 'Event Gear Rentals',
    contactName: 'Jamie Torres',
    contactEmail: 'jamie@eventgear.com',
    contactPhone: '+1 480-555-0404',
    role: 'Tent & Table Rental',
    notes: 'Awaiting final headcount confirmation before finalizing order.',
    status: 'pending',
    addedAt: '2024-03-10T11:00:00Z',
  },
  {
    id: 'v5',
    name: 'Pacekeeper Scoring',
    contactName: 'Dan Walters',
    contactEmail: 'dan@pacekeeper.com',
    contactPhone: '+1 480-555-0505',
    role: 'Scoreboard & Scoring Services',
    notes: 'Live scoring app configured. Leaderboard display at clubhouse.',
    status: 'on-site',
    addedAt: '2024-02-25T08:30:00Z',
  },
  {
    id: 'v6',
    name: 'OnCourse Photography',
    contactName: 'Lisa Park',
    contactEmail: 'lisa@oncoursephoto.com',
    contactPhone: '+1 480-555-0606',
    role: 'Photography',
    notes: 'Hole-in-one prize photos. Social media delivery within 24hrs.',
    status: 'confirmed',
    addedAt: '2024-03-05T16:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<VendorStatus, { bg: string; text: string; dot: string; label: string }> = {
  confirmed: { bg: 'bg-green-50', text: 'text-green-800', dot: 'bg-green-500', label: 'Confirmed' },
  pending:   { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Pending' },
  'on-site': { bg: 'bg-indigo-50',  text: 'text-indigo-800',  dot: 'bg-indigo-500',  label: 'On-Site' },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Add/Edit Vendor Modal
// ---------------------------------------------------------------------------

interface VendorModalProps {
  isOpen: boolean;
  vendor?: Vendor;
  onClose: () => void;
  onSave: (data: Omit<Vendor, 'id' | 'addedAt'>) => void;
}

function VendorModal({ isOpen, vendor, onClose, onSave }: VendorModalProps) {
  const [name, setName] = useState(vendor?.name ?? '');
  const [contactName, setContactName] = useState(vendor?.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(vendor?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(vendor?.contactPhone ?? '');
  const [role, setRole] = useState(vendor?.role ?? '');
  const [notes, setNotes] = useState(vendor?.notes ?? '');
  const [status, setStatus] = useState<VendorStatus>(vendor?.status ?? 'pending');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;
    onSave({ name: name.trim(), contactName, contactEmail, contactPhone, role: role.trim(), notes, status });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{vendor ? 'Edit Vendor' : 'Add Vendor'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Vendor Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Ace Golf Carts" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Name</label>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role / Service *</label>
              <input type="text" required value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Catering, Photography" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="contact@vendor.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="+1 480-555-0100" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as VendorStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="on-site">On-Site</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Arrival time, setup requirements, special instructions..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              {vendor ? 'Save Changes' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor Card
// ---------------------------------------------------------------------------

interface VendorCardProps {
  vendor: Vendor;
  onEdit: () => void;
  onDelete: () => void;
}

function VendorCard({ vendor, onEdit, onDelete }: VendorCardProps) {
  const st = STATUS_STYLES[vendor.status];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        {/* Left: icon + info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-700 font-bold text-sm">{vendor.name.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900">{vendor.name}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot} mr-1`} />
                {st.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{vendor.role}</p>

            {/* Contact info */}
            <div className="mt-3 space-y-1">
              {vendor.contactName && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {vendor.contactName}
                </div>
              )}
              {vendor.contactEmail && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${vendor.contactEmail}`} className="text-indigo-600 hover:underline">{vendor.contactEmail}</a>
                </div>
              )}
              {vendor.contactPhone && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${vendor.contactPhone}`} className="text-indigo-600 hover:underline">{vendor.contactPhone}</a>
                </div>
              )}
            </div>

            {/* Notes */}
            {vendor.notes && (
              <p className="mt-2 text-xs text-gray-500 italic leading-relaxed border-l-2 border-gray-200 pl-2">
                {vendor.notes}
              </p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {vendor.contactPhone && (
            <a
              href={`tel:${vendor.contactPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call
            </a>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Edit vendor"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete vendor"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function VendorsPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<VendorStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const fetchVendors = useCallback(async () => {
    const res = await fetch(`/api/operator/tournaments/${tournamentId}/vendors`);
    if (res.ok) {
      const data = await res.json();
      setVendors(data);
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const filtered = vendors.filter((v) => {
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    const matchesSearch = !search.trim() ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.role.toLowerCase().includes(search.toLowerCase()) ||
      (v.contactName?.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const statusCounts: Record<VendorStatus, number> = {
    confirmed: vendors.filter((v) => v.status === 'confirmed').length,
    pending:   vendors.filter((v) => v.status === 'pending').length,
    'on-site': vendors.filter((v) => v.status === 'on-site').length,
  };

  const handleSave = async (data: Omit<Vendor, 'id' | 'addedAt'>) => {
    if (editingVendor) {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/vendors/${editingVendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) fetchVendors();
    } else {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) fetchVendors();
    }
    setEditingVendor(undefined);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this vendor?')) return;
    const res = await fetch(`/api/operator/tournaments/${tournamentId}/vendors/${id}`, { method: 'DELETE' });
    if (res.ok) fetchVendors();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-500">Loading vendors…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/tournaments" className="hover:text-gray-700">Tournaments</Link>
        <span>/</span>
        <Link href={`/tournaments/${tournamentId}/fulfillment`} className="hover:text-gray-700">Fulfillment</Link>
        <span>/</span>
        <span className="text-gray-900">Vendors</span>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Coordination</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Manage vendors, sponsors, and on-site contractors
          </p>
        </div>
        <button
          onClick={() => { setEditingVendor(undefined); setShowModal(true); }}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Vendor
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-4">
        {(['confirmed', 'pending', 'on-site'] as VendorStatus[]).map((s) => {
          const st = STATUS_STYLES[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className={`bg-white rounded-lg shadow px-4 py-3 text-left transition-all ${
                filterStatus === s ? 'ring-2 ring-indigo-300' : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                <span className={`text-xs font-medium ${st.text}`}>{st.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{statusCounts[s]}</p>
            </button>
          );
        })}
        <div className="bg-white rounded-lg shadow px-4 py-3">
          <p className="text-xs text-gray-500 font-medium">Total Vendors</p>
          <p className="text-2xl font-bold text-gray-900">{vendors.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search vendors by name, role, or contact..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Vendor list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-gray-500 font-medium">No vendors found</p>
          <button
            onClick={() => { setEditingVendor(undefined); setShowModal(true); }}
            className="mt-3 text-indigo-600 text-sm font-medium hover:underline"
          >
            + Add your first vendor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              onEdit={() => { setEditingVendor(vendor); setShowModal(true); }}
              onDelete={() => handleDelete(vendor.id)}
            />
          ))}
        </div>
      )}

      <VendorModal
        isOpen={showModal}
        vendor={editingVendor}
        onClose={() => { setShowModal(false); setEditingVendor(undefined); }}
        onSave={handleSave}
      />
    </div>
  );
}
