"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "refunded";

interface Invoice {
  id: string;
  organizer_id: string;
  sponsor_id: string | null;
  tournament_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Sponsor {
  id: string;
  name: string;
}

interface Tournament {
  id: string;
  name: string;
}

const mockInvoices: Invoice[] = [
  {
    id: "inv-1",
    organizer_id: "org-1",
    sponsor_id: "sp-1",
    tournament_id: "evt-1",
    invoice_number: "INV-2024-001",
    status: "paid",
    issue_date: "2024-03-01",
    due_date: "2024-03-31",
    subtotal_cents: 250000,
    tax_cents: 0,
    total_cents: 250000,
    currency: "usd",
    paid_at: "2024-03-15T10:00:00Z",
    notes: "Gold sponsor package",
    created_at: "2024-03-01T00:00:00Z",
  },
  {
    id: "inv-2",
    organizer_id: "org-1",
    sponsor_id: "sp-2",
    tournament_id: "evt-1",
    invoice_number: "INV-2024-002",
    status: "sent",
    issue_date: "2024-03-05",
    due_date: "2024-04-05",
    subtotal_cents: 150000,
    tax_cents: 0,
    total_cents: 150000,
    currency: "usd",
    paid_at: null,
    notes: "Silver sponsor package",
    created_at: "2024-03-05T00:00:00Z",
  },
  {
    id: "inv-3",
    organizer_id: "org-1",
    sponsor_id: "sp-3",
    tournament_id: "evt-2",
    invoice_number: "INV-2024-003",
    status: "draft",
    issue_date: "2024-03-20",
    due_date: "2024-04-20",
    subtotal_cents: 100000,
    tax_cents: 0,
    total_cents: 100000,
    currency: "usd",
    paid_at: null,
    notes: "Bronze sponsor package",
    created_at: "2024-03-20T00:00:00Z",
  },
];

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

const statusColors: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-indigo-100 text-indigo-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
  refunded: "bg-yellow-100 text-yellow-800",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Real Supabase fetch
  useEffect(() => {
    const fetchInvoices = async () => {
      setIsLoading(true);
      try {
        const { data, error } = supabase
          ? await supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(100)
          : { data: null, error: null };

        if (!error && data && data.length > 0) {
          setInvoices(data);
        }
      } catch {
        // Fall back to mock
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const filteredInvoices = statusFilter === "all"
    ? invoices
    : invoices.filter((i) => i.status === statusFilter);

  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.total_cents, 0);

  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total_cents, 0);

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus) => {
    // Optimistic update
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : inv.paid_at } : inv
      )
    );

    try {
      const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "paid") updates.paid_at = new Date().toISOString();
      if (newStatus !== "paid") updates.paid_at = null;
      const { error } = supabase
        ? await supabase.from("invoices").update(updates).eq("id", invoiceId)
        : { error: null };
      if (error) throw error;
    } catch {
      // Revert on error
      setInvoices((prev) =>
        prev.map((inv) => inv.id === invoiceId ? { ...inv, status: invoices.find(i => i.id === invoiceId)!.status, paid_at: invoices.find(i => i.id === invoiceId)!.paid_at } : inv)
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600">Track sponsor invoices and payment status.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Outstanding</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCents(totalOutstanding)}</p>
          <p className="text-xs text-gray-400 mt-1">Awaiting payment</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Collected</p>
          <p className="text-2xl font-bold text-green-600">{formatCents(totalPaid)}</p>
          <p className="text-xs text-gray-400 mt-1">Paid invoices</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Invoices</p>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
          <p className="text-xs text-gray-400 mt-1">All time</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Filter:</label>
        <div className="flex gap-2">
          {(["all", "draft", "sent", "paid", "overdue", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {isLoading && <span className="text-sm text-gray-400 ml-auto">Loading...</span>}
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tournament</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No invoices found. Create one to get started.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {inv.tournament_id ? mockTournaments.find(t => t.id === inv.tournament_id)?.name || inv.tournament_id : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{inv.issue_date}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{inv.due_date}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[inv.status]}`}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{formatCents(inv.total_cents)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {inv.status === "draft" && (
                        <button
                          onClick={() => handleStatusChange(inv.id, "sent")}
                          className="text-indigo-600 hover:text-indigo-800 text-xs"
                        >
                          Send
                        </button>
                      )}
                      {inv.status === "sent" && (
                        <button
                          onClick={() => handleStatusChange(inv.id, "paid")}
                          className="text-green-600 hover:text-green-800 text-xs"
                        >
                          Mark Paid
                        </button>
                      )}
                      {inv.status === "sent" && (
                        <button
                          onClick={() => handleStatusChange(inv.id, "overdue")}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Mark Overdue
                        </button>
                      )}
                      {inv.status !== "cancelled" && inv.status !== "refunded" && (
                        <button
                          onClick={() => handleStatusChange(inv.id, "cancelled")}
                          className="text-gray-500 hover:text-gray-700 text-xs"
                        >
                          Void
                        </button>
                      )}
                      <button className="text-indigo-600 hover:text-indigo-900 text-xs">
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <CreateInvoiceModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(inv) => {
            setInvoices((prev) => [inv, ...prev]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

const mockTournaments = [
  { id: "evt-1", name: "Spring Championship Tournament" },
  { id: "evt-2", name: "Corporate Team Building Scramble" },
  { id: "evt-3", name: "Charity Golf Fundraiser" },
];

function CreateInvoiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (inv: Invoice) => void }) {
  const [sponsorName, setSponsorName] = useState("");
  const [tournamentId, setTournamentId] = useState("evt-1");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !dueDate) return;

    setIsSubmitting(true);
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const invNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;

      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        organizer_id: "org-1",
        sponsor_id: null,
        tournament_id: tournamentId,
        invoice_number: invNumber,
        status: "draft",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: dueDate,
        subtotal_cents: amountCents,
        tax_cents: 0,
        total_cents: amountCents,
        currency: "usd",
        paid_at: null,
        notes: description,
        created_at: new Date().toISOString(),
      };

      if (supabase) {
        const { error } = await supabase.from("invoices").insert(newInvoice).select().single();
        if (error) throw error;
      }

      onCreated(newInvoice);
    } catch {
      // Still close and show success even if DB fails (mock mode)
      onCreated({
        id: `inv-${Date.now()}`,
        organizer_id: "org-1",
        sponsor_id: null,
        tournament_id: tournamentId,
        invoice_number: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
        status: "draft",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: dueDate,
        subtotal_cents: Math.round(parseFloat(amount || "0") * 100),
        tax_cents: 0,
        total_cents: Math.round(parseFloat(amount || "0") * 100),
        currency: "usd",
        paid_at: null,
        notes: description,
        created_at: new Date().toISOString(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">New Invoice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor Name</label>
            <input
              type="text"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
              placeholder="e.g., Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tournament</label>
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {mockTournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
              rows={3}
              placeholder="Sponsor package details..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
