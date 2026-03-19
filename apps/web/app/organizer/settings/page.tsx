"use client";

import { useState } from "react";
import type { OrganizerTier } from "@spotter/types";
import { ORGANIZER_TIERS } from "@spotter/types";
import { TierBadge } from "../../../components/organizer/TierBadge";

// Mock data - would come from API in production
const mockOrganizer = {
  id: "org-1",
  name: "Tournament Organizers LLC",
  slug: "tournament-organizers",
  description: "Professional golf tournament organizers serving the Phoenix metro area.",
  website: "https://example.com",
  email: "contact@tournament-organizers.com",
  phone: "+1 (555) 123-4567",
  address: {
    street: "123 Golf Course Way",
    city: "Phoenix",
    state: "AZ",
    zipCode: "85001",
    country: "USA",
  },
  tier: "gold" as OrganizerTier,
  status: "active" as const,
  logoUrl: undefined,
  subscriptionExpiresAt: "2025-03-15T00:00:00Z",
};

const mockBillingInfo = {
  cardLast4: "4242",
  cardBrand: "visa",
  nextBillingDate: "2024-04-15",
  invoices: [
    { id: "inv-1", date: "2024-03-15", amount: 9999, status: "paid" as const },
    { id: "inv-2", date: "2024-02-15", amount: 9999, status: "paid" as const },
    { id: "inv-3", date: "2024-01-15", amount: 9999, status: "paid" as const },
  ],
};

const mockApiKeys = [
  {
    id: "key-1",
    name: "Production API Key",
    keyPrefix: "pk_live_...",
    permissions: {
      manageSettings: false,
      manageMembers: false,
      createEvents: true,
      editEvents: true,
      deleteEvents: false,
      viewRegistrations: true,
      manageRegistrations: true,
      viewAnalytics: true,
      exportData: true,
      sendInvites: true,
      manageApiKeys: false,
    },
    lastUsedAt: "2024-03-15T10:30:00Z",
    usageCount: 1523,
    active: true,
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "key-2",
    name: "Development API Key",
    keyPrefix: "pk_test_...",
    permissions: {
      manageSettings: false,
      manageMembers: false,
      createEvents: true,
      editEvents: true,
      deleteEvents: true,
      viewRegistrations: true,
      manageRegistrations: true,
      viewAnalytics: true,
      exportData: true,
      sendInvites: true,
      manageApiKeys: false,
    },
    lastUsedAt: "2024-03-14T16:45:00Z",
    usageCount: 892,
    active: true,
    createdAt: "2024-02-01T00:00:00Z",
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"organization" | "billing" | "api">("organization");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [showKeySecret, setShowKeySecret] = useState<string | null>(null);

  // Form state
  const [orgForm, setOrgForm] = useState({
    name: mockOrganizer.name,
    description: mockOrganizer.description || "",
    website: mockOrganizer.website || "",
    email: mockOrganizer.email,
    phone: mockOrganizer.phone || "",
    street: mockOrganizer.address?.street || "",
    city: mockOrganizer.address?.city || "",
    state: mockOrganizer.address?.state || "",
    zipCode: mockOrganizer.address?.zipCode || "",
    country: mockOrganizer.address?.country || "",
  });

  const isGoldTier = mockOrganizer.tier === "gold";
  const isSilverTier = mockOrganizer.tier === "silver";
  const isBronzeTier = mockOrganizer.tier === "bronze";

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    alert("Organization settings saved!");
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setShowCreateKeyModal(false);
    alert("New API key created!");
  };

  const handleRevokeKey = async (keyId: string) => {
    if (confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      alert(`API key ${keyId} revoked`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your organization settings and preferences.</p>
      </div>

      {/* Current tier banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold">{mockOrganizer.name}</h2>
              <TierBadge tier={mockOrganizer.tier} />
            </div>
            <p className="mt-1 text-indigo-100">
              {isGoldTier
                ? "You have full access to all features including API keys and white-label options."
                : isSilverTier
                ? "Upgrade to Gold for API access and unlimited events."
                : "Upgrade to unlock more features and higher limits."}
            </p>
            {mockOrganizer.subscriptionExpiresAt && (
              <p className="mt-1 text-sm text-indigo-200">
                Subscription renews on{" "}
                {new Date(mockOrganizer.subscriptionExpiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
          {(isBronzeTier || isSilverTier) && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 font-medium"
            >
              Upgrade Plan
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {[
            { id: "organization", label: "Organization" },
            { id: "billing", label: "Billing" },
            { id: "api", label: "API Keys", goldOnly: true },
          ].map((tab) => {
            if (tab.goldOnly && !isGoldTier) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Organization Tab */}
      {activeTab === "organization" && (
        <form onSubmit={handleSaveOrganization} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
                Organization Name *
              </label>
              <input
                type="text"
                id="orgName"
                value={orgForm.name}
                onChange={(e) => setOrgForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="orgDescription" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="orgDescription"
                rows={3}
                value={orgForm.description}
                onChange={(e) => setOrgForm((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              />
            </div>

            <div>
              <label htmlFor="orgWebsite" className="block text-sm font-medium text-gray-700">
                Website
              </label>
              <input
                type="url"
                id="orgWebsite"
                value={orgForm.website}
                onChange={(e) => setOrgForm((prev) => ({ ...prev, website: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label htmlFor="orgEmail" className="block text-sm font-medium text-gray-700">
                Contact Email *
              </label>
              <input
                type="email"
                id="orgEmail"
                value={orgForm.email}
                onChange={(e) => setOrgForm((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                required
              />
            </div>

            <div>
              <label htmlFor="orgPhone" className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                id="orgPhone"
                value={orgForm.phone}
                onChange={(e) => setOrgForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              />
            </div>

            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <input
                    type="text"
                    placeholder="Street Address"
                    value={orgForm.street}
                    onChange={(e) => setOrgForm((prev) => ({ ...prev, street: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="City"
                    value={orgForm.city}
                    onChange={(e) => setOrgForm((prev) => ({ ...prev, city: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="State"
                    value={orgForm.state}
                    onChange={(e) => setOrgForm((prev) => ({ ...prev, state: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                  <input
                    type="text"
                    placeholder="ZIP"
                    value={orgForm.zipCode}
                    onChange={(e) => setOrgForm((prev) => ({ ...prev, zipCode: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    placeholder="Country"
                    value={orgForm.country}
                    onChange={(e) => setOrgForm((prev) => ({ ...prev, country: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Billing Tab */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Payment method */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                  <svg className="w-8 h-5" viewBox="0 0 48 32" fill="none">
                    <rect width="48" height="32" rx="4" fill="#1A1F71" />
                    <path
                      d="M19.2 21.2L21.6 10.8H24.8L22.4 21.2H19.2ZM36.8 14.4C36 14 34.8 13.6 33.6 13.6C31.2 13.6 29.6 14.8 29.6 16.4C29.6 17.6 30.8 18.2 31.6 18.6C32.4 19 32.8 19.2 32.8 19.6C32.8 20.2 32 20.4 31.2 20.4C30 20.4 29.2 20.2 28.4 19.8L28 19.6L27.6 22C28.4 22.4 29.6 22.6 30.8 22.6C33.2 22.6 34.8 21.4 34.8 19.6C34.8 18.6 34 18 32.8 17.4C32 17 31.6 16.8 31.6 16.4C31.6 16 32 15.8 32.8 15.8C33.6 15.8 34.2 16 34.8 16.2L35.2 16.4L35.6 14.4H36.8Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {mockBillingInfo.cardBrand.charAt(0).toUpperCase() + mockBillingInfo.cardBrand.slice(1)} ending in{" "}
                    {mockBillingInfo.cardLast4}
                  </div>
                  <div className="text-sm text-gray-500">
                    Next billing date: {new Date(mockBillingInfo.nextBillingDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button className="text-indigo-600 hover:text-indigo-700 font-medium">Update</button>
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mockBillingInfo.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${(invoice.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-indigo-600 hover:text-indigo-900">Download</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === "api" && isGoldTier && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateKeyModal(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create API Key
            </button>
          </div>

          <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
            {mockApiKeys.map((key) => (
              <div key={key.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-medium text-gray-900">{key.name}</h3>
                      {key.active ? (
                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          Revoked
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {key.keyPrefix} • Created {new Date(key.createdAt).toLocaleDateString()}
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"} •{" "}
                      {key.usageCount.toLocaleString()} requests
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowKeySecret(showKeySecret === key.id ? null : key.id)}
                      className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                    >
                      {showKeySecret === key.id ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="text-red-600 hover:text-red-700 font-medium text-sm"
                    >
                      Revoke
                    </button>
                  </div>
                </div>

                {showKeySecret === key.id && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono text-gray-900">pk_live_abc123xyz789...</code>
                      <button className="text-indigo-600 hover:text-indigo-700 text-sm">Copy</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Upgrade Your Plan</h3>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ORGANIZER_TIERS.map((tier) => (
                  <div
                    key={tier.value}
                    className={`border rounded-lg p-4 ${
                      tier.value === mockOrganizer.tier
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="text-center">
                      <h4 className="text-lg font-semibold text-gray-900">{tier.label}</h4>
                      <div className="mt-2 text-2xl font-bold text-gray-900">
                        ${(tier.priceMonthlyCents / 100).toFixed(0)}
                        <span className="text-sm font-normal text-gray-500">/mo</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{tier.description}</p>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-gray-600">
                      {tier.features.slice(0, 4).map((feature, i) => (
                        <li key={i} className="flex items-start">
                          <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      {tier.value === mockOrganizer.tier ? (
                        <button
                          disabled
                          className="w-full py-2 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed"
                        >
                          Current Plan
                        </button>
                      ) : (
                        <button className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateKeyModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Create API Key</h3>
                <button
                  onClick={() => setShowCreateKeyModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateApiKey} className="px-6 py-4 space-y-4">
              <div>
                <label htmlFor="keyName" className="block text-sm font-medium text-gray-700">
                  Key Name *
                </label>
                <input
                  type="text"
                  id="keyName"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  placeholder="e.g., Production API Key"
                  required
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> This key will only be shown once. Make sure to copy it
                  immediately.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateKeyModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
