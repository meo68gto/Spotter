"use client";

import { useState } from "react";
import { SponsorRow } from "../../../components/organizer/SponsorRow";

interface Sponsor {
  id: string;
  name: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  email: string;
  website?: string;
  logoUrl?: string;
  events: number;
  totalSpent: number;
  joinedAt: string;
  status: "active" | "inactive";
}

const mockSponsors: Sponsor[] = [
  {
    id: "spon-1",
    name: "Acme Golf Supplies",
    tier: "platinum",
    email: "sponsors@acmegolf.com",
    website: "https://acmegolf.com",
    events: 12,
    totalSpent: 25000,
    joinedAt: "2024-01-15T10:00:00Z",
    status: "active",
  },
  {
    id: "spon-2",
    name: "Titleist",
    tier: "gold",
    email: "events@titleist.com",
    website: "https://titleist.com",
    events: 8,
    totalSpent: 15000,
    joinedAt: "2024-02-01T14:30:00Z",
    status: "active",
  },
  {
    id: "spon-3",
    name: "FootJoy",
    tier: "gold",
    email: "sponsors@footjoy.com",
    website: "https://footjoy.com",
    events: 6,
    totalSpent: 12000,
    joinedAt: "2024-02-20T09:00:00Z",
    status: "active",
  },
  {
    id: "spon-4",
    name: "Callaway",
    tier: "silver",
    email: "golf@callaway.com",
    website: "https://callawaygolf.com",
    events: 4,
    totalSpent: 6000,
    joinedAt: "2024-03-05T11:00:00Z",
    status: "active",
  },
  {
    id: "spon-5",
    name: "PING",
    tier: "silver",
    email: "info@ping.com",
    events: 3,
    totalSpent: 4500,
    joinedAt: "2024-03-15T16:00:00Z",
    status: "inactive",
  },
  {
    id: "spon-6",
    name: "Cobra Golf",
    tier: "bronze",
    email: "sponsors@cobragolf.com",
    website: "https://cobragolf.com",
    events: 2,
    totalSpent: 2000,
    joinedAt: "2024-03-20T10:00:00Z",
    status: "active",
  },
];

export default function SponsorsPage() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTier, setInviteTier] = useState<Sponsor["tier"]>("bronze");
  const [tierFilter, setTierFilter] = useState<Sponsor["tier"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Sponsor["status"] | "all">("all");

  const filteredSponsors = mockSponsors.filter((sponsor) => {
    if (tierFilter !== "all" && sponsor.tier !== tierFilter) return false;
    if (statusFilter !== "all" && sponsor.status !== statusFilter) return false;
    return true;
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    await new Promise((resolve) => setTimeout(resolve, 500));
    setShowInviteModal(false);
    setInviteName("");
    setInviteEmail("");
    alert(`Sponsorship invitation sent to ${inviteEmail}!`);
  };

  const handleRemoveSponsor = async (sponsorId: string) => {
    if (confirm("Are you sure you want to remove this sponsor?")) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      alert(`Sponsor ${sponsorId} removed`);
    }
  };

  const handleEditSponsor = (sponsorId: string) => {
    alert(`Edit sponsor ${sponsorId} — coming soon`);
  };

  const totalRevenue = mockSponsors.reduce((sum, s) => sum + s.totalSpent, 0);
  const activeSponsors = mockSponsors.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sponsors</h1>
          <p className="text-gray-600">Manage tournament sponsors and sponsorship tiers.</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add Sponsor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">Total Sponsors</p>
          <p className="text-3xl font-bold text-gray-900">{mockSponsors.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">Active Sponsors</p>
          <p className="text-3xl font-bold text-green-600">{activeSponsors}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          <p className="text-3xl font-bold text-gray-900">${totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4 flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as Sponsor["tier"] | "all")}
              className="block w-36 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            >
              <option value="all">All Tiers</option>
              <option value="platinum">Platinum</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Sponsor["status"] | "all")}
              className="block w-36 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex-1 text-right text-sm text-gray-500">
            {filteredSponsors.length} sponsor{filteredSponsors.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Sponsors table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sponsor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Website
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Events
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Spent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSponsors.map((sponsor) => (
              <SponsorRow
                key={sponsor.id}
                sponsor={sponsor}
                onEdit={handleEditSponsor}
                onRemove={handleRemoveSponsor}
              />
            ))}
          </tbody>
        </table>

        {filteredSponsors.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No sponsors found</h3>
            <p className="mt-1 text-sm text-gray-500">Add sponsors to start monetizing your tournaments.</p>
            <button
              onClick={() => setShowInviteModal(true)}
              className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              Add Your First Sponsor
            </button>
          </div>
        )}
      </div>

      {/* Add Sponsor Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Add Sponsor</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleInvite} className="px-6 py-4 space-y-4">
              <div>
                <label htmlFor="sponsorName" className="block text-sm font-medium text-gray-700">
                  Company Name *
                </label>
                <input
                  type="text"
                  id="sponsorName"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  placeholder="Acme Golf Supplies"
                  required
                />
              </div>

              <div>
                <label htmlFor="sponsorEmail" className="block text-sm font-medium text-gray-700">
                  Contact Email *
                </label>
                <input
                  type="email"
                  id="sponsorEmail"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  placeholder="sponsor@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="sponsorTier" className="block text-sm font-medium text-gray-700">
                  Sponsorship Tier *
                </label>
                <select
                  id="sponsorTier"
                  value={inviteTier}
                  onChange={(e) => setInviteTier(e.target.value as Sponsor["tier"])}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                >
                  <option value="bronze">Bronze — $1,000/event</option>
                  <option value="silver">Silver — $2,500/event</option>
                  <option value="gold">Gold — $5,000/event</option>
                  <option value="platinum">Platinum — $10,000/event</option>
                </select>
              </div>

              <div className="bg-gray-50 rounded p-3 text-sm text-gray-600">
                <p className="font-medium mb-1">Tier benefits:</p>
                <ul className="list-disc list-inside space-y-1">
                  {inviteTier === "platinum" && <li>Logo on all event materials</li>}
                  {inviteTier === "platinum" && <li>Speaking slot at awards dinner</li>}
                  {inviteTier === "gold" && <li>Logo on scorecards and leaderboards</li>}
                  {inviteTier === "silver" && <li>Logo on event program</li>}
                  {inviteTier === "bronze" && <li>Logo on website and social media</li>}
                  <li>Complimentary event entries</li>
                  <li>Networking access</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
