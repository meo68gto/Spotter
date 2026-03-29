"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RegistrationRow } from "../../../../components/organizer/RegistrationRow";
import { StatsCard } from "../../../../components/organizer/StatsCard";
import type { OrganizerEvent, RegistrationWithUser } from "@spotter/types";
import { EVENT_STATUSES, REGISTRATION_STATUSES } from "@spotter/types";

// Mock data - would come from API in production
const mockEvent: OrganizerEvent = {
  id: "evt-1",
  organizerId: "org-1",
  title: "Spring Championship Tournament",
  description: "Annual spring golf tournament with prizes for top performers. Join us for a day of competitive golf and networking.",
  type: "tournament",
  status: "registration_open",
  courseId: "course-1",
  courseName: "Pine Valley Golf Club",
  startTime: "2024-04-15T08:00:00Z",
  endTime: "2024-04-15T16:00:00Z",
  registrationOpensAt: "2024-03-01T00:00:00Z",
  registrationClosesAt: "2024-04-10T23:59:59Z",
  maxParticipants: 120,
  registrationCount: 89,
  waitlistCount: 5,
  entryFeeCents: 5000,
  currency: "USD",
  isPublic: true,
  targetTiers: ["bronze", "silver", "gold"],
  createdByUserId: "user-1",
  createdAt: "2024-02-15T10:00:00Z",
  updatedAt: "2024-03-15T14:30:00Z",
};

const mockRegistrations: RegistrationWithUser[] = [
  {
    id: "reg-1",
    eventId: "evt-1",
    userId: "user-1",
    displayName: "Alice Johnson",
    email: "alice@example.com",
    avatarUrl: undefined,
    status: "checked_in",
    paymentStatus: "paid",
    amountPaidCents: 5000,
    registeredAt: "2024-03-01T10:30:00Z",
    confirmedAt: "2024-03-01T12:00:00Z",
    checkedInAt: "2024-04-15T07:45:00Z",
    checkedInByUserId: "user-admin",
    handicapAtRegistration: 12,
    marketingOptIn: true,
  },
  {
    id: "reg-2",
    eventId: "evt-1",
    userId: "user-2",
    displayName: "Bob Smith",
    email: "bob@example.com",
    avatarUrl: undefined,
    status: "confirmed",
    paymentStatus: "paid",
    amountPaidCents: 5000,
    registeredAt: "2024-03-02T09:15:00Z",
    confirmedAt: "2024-03-02T11:00:00Z",
    handicapAtRegistration: 18,
    marketingOptIn: false,
  },
  {
    id: "reg-3",
    eventId: "evt-1",
    userId: "user-3",
    displayName: "Carol White",
    email: "carol@example.com",
    avatarUrl: undefined,
    status: "confirmed",
    paymentStatus: "waived",
    registeredAt: "2024-03-03T16:45:00Z",
    confirmedAt: "2024-03-03T18:00:00Z",
    handicapAtRegistration: 8,
    marketingOptIn: true,
  },
  {
    id: "reg-4",
    eventId: "evt-1",
    userId: "user-4",
    displayName: "David Brown",
    email: "david@example.com",
    avatarUrl: undefined,
    status: "registered",
    paymentStatus: "pending",
    registeredAt: "2024-03-05T14:20:00Z",
    handicapAtRegistration: 22,
    marketingOptIn: false,
  },
  {
    id: "reg-5",
    eventId: "evt-1",
    guestEmail: "guest@example.com",
    guestName: "Guest User",
    status: "waitlisted",
    paymentStatus: "pending",
    registeredAt: "2024-03-06T11:00:00Z",
    marketingOptIn: false,
  },
];

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [activeTab, setActiveTab] = useState<"registrations" | "invites" | "analytics">("registrations");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");

  const getStatusColor = (status: typeof mockEvent.status) => {
    const colors: Record<typeof mockEvent.status, string> = {
      draft: "bg-gray-100 text-gray-800",
      published: "bg-indigo-100 text-indigo-800",
      registration_open: "bg-green-100 text-green-800",
      full: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-purple-100 text-purple-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const confirmedCount = mockRegistrations.filter((r) =>
    ["confirmed", "checked_in"].includes(r.status)
  ).length;
  const checkedInCount = mockRegistrations.filter((r) => r.status === "checked_in").length;
  const revenue = mockRegistrations.reduce((sum, r) => sum + (r.amountPaidCents || 0), 0);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setInviteEmail("");
    setInviteMessage("");
    alert("Invite sent!");
  };

  const handleCheckIn = async (registrationId: string) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    alert(`Checked in registration ${registrationId}`);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/organizer/events" className="hover:text-gray-700">
          Events
        </Link>
        <span>/</span>
        <span className="text-gray-900 truncate max-w-md">{mockEvent.title}</span>
      </div>

      {/* Event Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{mockEvent.title}</h1>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  mockEvent.status
                )}`}
              >
                {EVENT_STATUSES.find((s) => s.value === mockEvent.status)?.label}
              </span>
            </div>
            <p className="text-gray-600 max-w-2xl">{mockEvent.description}</p>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(mockEvent.startTime).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {new Date(mockEvent.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                {new Date(mockEvent.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {mockEvent.courseName}
              </div>
              {mockEvent.entryFeeCents && (
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ${(mockEvent.entryFeeCents / 100).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-2">
            <Link
              href={`/organizer/events/${eventId}/edit`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </Link>
            {mockEvent.status !== "cancelled" && mockEvent.status !== "completed" && (
              <button className="inline-flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel Event
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mini Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Registrations"
          value={mockEvent.registrationCount}
          subtitle={`of ${mockEvent.maxParticipants} spots`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Confirmed"
          value={confirmedCount}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Checked In"
          value={checkedInCount}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatsCard
          title="Revenue"
          value={`$${(revenue / 100).toFixed(2)}`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: "registrations", label: "Registrations", count: mockRegistrations.length },
              { id: "invites", label: "Invites", count: 0 },
              { id: "analytics", label: "Analytics" },
            ].map((tab) => (
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
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "registrations" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Event Registrations</h3>
                <div className="flex space-x-2">
                  <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filter
                  </button>
                  <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Participant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Registered
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mockRegistrations.map((registration) => (
                      <RegistrationRow
                        key={registration.id}
                        registration={registration}
                        onCheckIn={() => handleCheckIn(registration.id)}
                        showCheckIn={registration.status === "confirmed"}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "invites" && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Send Invite</h3>
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div>
                    <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="inviteEmail"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                      placeholder="player@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="inviteMessage" className="block text-sm font-medium text-gray-700">
                      Personal Message (Optional)
                    </label>
                    <textarea
                      id="inviteMessage"
                      rows={3}
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                      placeholder="Join us for this amazing event!"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Invite
                  </button>
                </form>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Sent Invites</h3>
                <p className="text-gray-500">No invites sent yet.</p>
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Registration Trend</h4>
                  <div className="h-32 flex items-end space-x-2">
                    {[12, 18, 15, 25, 30, 22, 28, 35, 42, 38, 45, 50, 55, 48, 52, 58, 62, 68, 72, 65, 70, 75, 80, 77, 82, 85, 89].map(
                      (count, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-indigo-500 rounded-t"
                          style={{ height: `${(count / 100) * 100}%` }}
                        />
                      )
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Registration Sources</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <div className="w-32 text-sm text-gray-600">Direct</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div className="bg-indigo-500 h-4 rounded-full" style={{ width: "45%" }} />
                      </div>
                      <div className="w-12 text-right text-sm text-gray-600">45%</div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-32 text-sm text-gray-600">Invites</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div className="bg-green-500 h-4 rounded-full" style={{ width: "30%" }} />
                      </div>
                      <div className="w-12 text-right text-sm text-gray-600">30%</div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-32 text-sm text-gray-600">Social</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div className="bg-yellow-500 h-4 rounded-full" style={{ width: "25%" }} />
                      </div>
                      <div className="w-12 text-right text-sm text-gray-600">25%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
