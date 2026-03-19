"use client";

import Link from "next/link";
import { StatsCard } from "../../components/organizer/StatsCard";
import { RegistrationRow } from "../../components/organizer/RegistrationRow";
import type { OrganizerEvent, RegistrationWithUser } from "@spotter/types";

// Mock data - would come from API in production
const mockStats = {
  totalEvents: 12,
  registrationsThisMonth: 156,
  revenue: 12450,
  upcomingEvents: 3,
};

const mockRecentRegistrations: RegistrationWithUser[] = [
  {
    id: "reg-1",
    eventId: "evt-1",
    userId: "user-1",
    displayName: "Alice Johnson",
    email: "alice@example.com",
    avatarUrl: undefined,
    status: "confirmed",
    paymentStatus: "paid",
    amountPaidCents: 5000,
    registeredAt: "2024-03-15T10:30:00Z",
    marketingOptIn: true,
  },
  {
    id: "reg-2",
    eventId: "evt-1",
    userId: "user-2",
    displayName: "Bob Smith",
    email: "bob@example.com",
    avatarUrl: undefined,
    status: "registered",
    paymentStatus: "pending",
    registeredAt: "2024-03-15T09:15:00Z",
    marketingOptIn: false,
  },
  {
    id: "reg-3",
    eventId: "evt-2",
    userId: "user-3",
    displayName: "Carol White",
    email: "carol@example.com",
    avatarUrl: undefined,
    status: "confirmed",
    paymentStatus: "waived",
    registeredAt: "2024-03-14T16:45:00Z",
    marketingOptIn: true,
  },
  {
    id: "reg-4",
    eventId: "evt-1",
    guestEmail: "guest@example.com",
    guestName: "Guest User",
    status: "waitlisted",
    paymentStatus: "pending",
    registeredAt: "2024-03-14T14:20:00Z",
    marketingOptIn: false,
  },
];

const mockRegistrationTrend = [
  { date: "2024-02-15", count: 5 },
  { date: "2024-02-16", count: 8 },
  { date: "2024-02-17", count: 3 },
  { date: "2024-02-18", count: 12 },
  { date: "2024-02-19", count: 7 },
  { date: "2024-02-20", count: 15 },
  { date: "2024-02-21", count: 9 },
  { date: "2024-02-22", count: 11 },
  { date: "2024-02-23", count: 6 },
  { date: "2024-02-24", count: 14 },
  { date: "2024-02-25", count: 8 },
  { date: "2024-02-26", count: 10 },
  { date: "2024-02-27", count: 13 },
  { date: "2024-02-28", count: 7 },
  { date: "2024-02-29", count: 9 },
  { date: "2024-03-01", count: 16 },
  { date: "2024-03-02", count: 12 },
  { date: "2024-03-03", count: 8 },
  { date: "2024-03-04", count: 11 },
  { date: "2024-03-05", count: 14 },
  { date: "2024-03-06", count: 9 },
  { date: "2024-03-07", count: 13 },
  { date: "2024-03-08", count: 7 },
  { date: "2024-03-09", count: 10 },
  { date: "2024-03-10", count: 15 },
  { date: "2024-03-11", count: 11 },
  { date: "2024-03-12", count: 8 },
  { date: "2024-03-13", count: 12 },
  { date: "2024-03-14", count: 14 },
  { date: "2024-03-15", count: 6 },
];

export default function OrganizerDashboard() {
  const maxCount = Math.max(...mockRegistrationTrend.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your events.</p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/organizer/events/create"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Event
          </Link>
          <button className="inline-flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Invite
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Events"
          value={mockStats.totalEvents}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          trend={{ value: 20, isPositive: true }}
        />
        <StatsCard
          title="Registrations This Month"
          value={mockStats.registrationsThisMonth}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          trend={{ value: 15, isPositive: true }}
        />
        <StatsCard
          title="Revenue"
          value={`$${mockStats.revenue.toLocaleString()}`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Upcoming Events"
          value={mockStats.upcomingEvents}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Charts and tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration trend chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Registrations Over Time (Last 30 Days)</h2>
          <div className="h-64 flex items-end space-x-1">
            {mockRegistrationTrend.map((day, index) => (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center"
                title={`${day.date}: ${day.count} registrations`}
              >
                <div
                  className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                  style={{ height: `${(day.count / maxCount) * 100}%` }}
                />
                {index % 5 === 0 && (
                  <span className="text-xs text-gray-500 mt-1">
                    {new Date(day.date).getDate()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent registrations */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Registrations</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {mockRecentRegistrations.map((registration) => (
              <RegistrationRow key={registration.id} registration={registration} compact />
            ))}
          </div>
          <div className="px-6 py-3 border-t border-gray-200">
            <Link
              href="/organizer/events"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all registrations →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
