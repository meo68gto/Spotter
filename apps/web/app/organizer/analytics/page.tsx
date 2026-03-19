"use client";

import { useState } from "react";
import { StatsCard } from "../../../components/organizer/StatsCard";
import type { OrganizerAnalytics } from "@spotter/types";

// Mock analytics data
const mockAnalytics: OrganizerAnalytics = {
  organizerId: "org-1",
  periodStart: "2024-03-01T00:00:00Z",
  periodEnd: "2024-03-31T23:59:59Z",
  registrationMetrics: {
    totalRegistrations: 156,
    registrationsByDay: [
      { date: "2024-03-01", count: 5 },
      { date: "2024-03-02", count: 8 },
      { date: "2024-03-03", count: 3 },
      { date: "2024-03-04", count: 12 },
      { date: "2024-03-05", count: 7 },
      { date: "2024-03-06", count: 15 },
      { date: "2024-03-07", count: 9 },
      { date: "2024-03-08", count: 11 },
      { date: "2024-03-09", count: 6 },
      { date: "2024-03-10", count: 14 },
      { date: "2024-03-11", count: 8 },
      { date: "2024-03-12", count: 10 },
      { date: "2024-03-13", count: 13 },
      { date: "2024-03-14", count: 7 },
      { date: "2024-03-15", count: 9 },
    ],
    registrationSources: {
      direct: 70,
      invite: 47,
      social: 39,
    },
    conversionRate: 0.23,
    deviceBreakdown: {
      desktop: 89,
      mobile: 52,
      tablet: 15,
    },
    geographicDistribution: [
      { city: "Phoenix", count: 45 },
      { city: "Scottsdale", count: 38 },
      { city: "Tempe", count: 28 },
      { city: "Mesa", count: 22 },
      { city: "Gilbert", count: 23 },
    ],
  },
  attendanceMetrics: {
    totalCheckIns: 142,
    checkInRate: 0.91,
    noShows: 14,
    noShowRate: 0.09,
    checkInsByTime: [
      { timeBucket: "7:00-8:00", count: 45 },
      { timeBucket: "8:00-9:00", count: 52 },
      { timeBucket: "9:00-10:00", count: 28 },
      { timeBucket: "10:00+", count: 17 },
    ],
  },
  revenueMetrics: {
    totalRevenue: 12450,
    revenueByEvent: [
      { eventId: "evt-1", eventTitle: "Spring Championship", revenue: 4450 },
      { eventId: "evt-2", eventTitle: "Corporate Scramble", revenue: 6000 },
      { eventId: "evt-3", eventTitle: "Weekend Social", revenue: 2000 },
    ],
    revenueByMethod: {
      card: 11200,
      cash: 1250,
    },
    totalRefunds: 500,
    refundRate: 0.04,
    averageTransactionValue: 79.81,
  },
  engagementMetrics: {
    emailOpenRate: 0.68,
    emailClickRate: 0.34,
    averageTimeOnPage: 245,
    socialShares: 23,
    returnAttendeeRate: 0.45,
    npsScore: 72,
  },
  periodComparison: {
    registrationsChange: 0.15,
    attendanceRateChange: 0.03,
    revenueChange: 0.22,
  },
};

// Mock event breakdown data
const mockEventBreakdown = [
  {
    id: "evt-1",
    title: "Spring Championship Tournament",
    date: "2024-03-15",
    registrations: 89,
    attendance: 82,
    attendanceRate: 0.92,
    revenue: 4450,
  },
  {
    id: "evt-2",
    title: "Corporate Team Building Scramble",
    date: "2024-03-22",
    registrations: 80,
    attendance: 75,
    attendanceRate: 0.94,
    revenue: 6000,
  },
  {
    id: "evt-3",
    title: "Weekend Social Mixer",
    date: "2024-03-29",
    registrations: 45,
    attendance: 38,
    attendanceRate: 0.84,
    revenue: 2000,
  },
];

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [activeTab, setActiveTab] = useState<"overview" | "registrations" | "attendance" | "revenue">(
    "overview"
  );

  // Gold tier check (mock - would come from auth context)
  const isGoldTier = true;

  const handleExport = () => {
    if (!isGoldTier) {
      alert("Export feature is only available for Gold tier organizers.");
      return;
    }
    // Simulate export
    alert("Exporting analytics data...");
  };

  const maxRegistrations = Math.max(...mockAnalytics.registrationMetrics.registrationsByDay.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Track your event performance and attendee engagement.</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range...</option>
          </select>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
            {!isGoldTier && (
              <span className="ml-2 text-xs text-yellow-600 font-medium">Gold</span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {[
            { id: "overview", label: "Overview" },
            { id: "registrations", label: "Registrations" },
            { id: "attendance", label: "Attendance" },
            { id: "revenue", label: "Revenue" },
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
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Total Registrations"
              value={mockAnalytics.registrationMetrics.totalRegistrations}
              trend={{
                value: Math.round(mockAnalytics.periodComparison?.registrationsChange || 0) * 100,
                isPositive: (mockAnalytics.periodComparison?.registrationsChange || 0) > 0,
              }}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
            />
            <StatsCard
              title="Attendance Rate"
              value={`${Math.round(mockAnalytics.attendanceMetrics.checkInRate * 100)}%`}
              trend={{
                value: Math.round(mockAnalytics.periodComparison?.attendanceRateChange || 0) * 100,
                isPositive: (mockAnalytics.periodComparison?.attendanceRateChange || 0) > 0,
              }}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatsCard
              title="Total Revenue"
              value={`$${mockAnalytics.revenueMetrics?.totalRevenue?.toLocaleString() || "0"}`}
              trend={{
                value: Math.round(mockAnalytics.periodComparison?.revenueChange || 0) * 100,
                isPositive: (mockAnalytics.periodComparison?.revenueChange || 0) > 0,
              }}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatsCard
              title="NPS Score"
              value={mockAnalytics.engagementMetrics.npsScore || "-"}
              subtitle="Net Promoter Score"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Registration trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Trend</h3>
              <div className="h-48 flex items-end space-x-1">
                {mockAnalytics.registrationMetrics.registrationsByDay.map((day, index) => (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center"
                    title={`${day.date}: ${day.count} registrations`}
                  >
                    <div
                      className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                      style={{ height: `${(day.count / maxRegistrations) * 100}%` }}
                    />
                    {index % 3 === 0 && (
                      <span className="text-xs text-gray-500 mt-1">
                        {new Date(day.date).getDate()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Registration sources */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Sources</h3>
              <div className="space-y-4">
                {Object.entries(mockAnalytics.registrationMetrics.registrationSources).map(
                  ([source, count]) => {
                    const total = mockAnalytics.registrationMetrics.totalRegistrations;
                    const percentage = Math.round((count / total) * 100);
                    const colors: Record<string, string> = {
                      direct: "bg-indigo-500",
                      invite: "bg-green-500",
                      social: "bg-yellow-500",
                    };
                    return (
                      <div key={source}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 capitalize">{source}</span>
                          <span className="text-sm text-gray-500">
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`${colors[source] || "bg-gray-500"} h-2 rounded-full`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          {/* Event breakdown table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Event Breakdown</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registrations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mockEventBreakdown.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{event.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{event.registrations}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{event.attendance}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {Math.round(event.attendanceRate * 100)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ${event.revenue.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Registrations Tab */}
      {activeTab === "registrations" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Breakdown</h3>
              <div className="space-y-4">
                {Object.entries(mockAnalytics.registrationMetrics.deviceBreakdown).map(
                  ([device, count]) => {
                    const total =
                      mockAnalytics.registrationMetrics.deviceBreakdown.desktop +
                      mockAnalytics.registrationMetrics.deviceBreakdown.mobile +
                      mockAnalytics.registrationMetrics.deviceBreakdown.tablet;
                    const percentage = Math.round((count / total) * 100);
                    const colors: Record<string, string> = {
                      desktop: "bg-blue-500",
                      mobile: "bg-green-500",
                      tablet: "bg-purple-500",
                    };
                    return (
                      <div key={device}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 capitalize">{device}</span>
                          <span className="text-sm text-gray-500">
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`${colors[device] || "bg-gray-500"} h-2 rounded-full`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h3>
              <div className="space-y-3">
                {mockAnalytics.registrationMetrics.geographicDistribution.map((location) => (
                  <div key={location.city} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{location.city}</span>
                    <span className="text-sm font-medium text-gray-900">{location.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-gray-900">{mockAnalytics.attendanceMetrics.totalCheckIns}</div>
              <div className="text-sm text-gray-500 mt-1">Total Check-ins</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-gray-900">{mockAnalytics.attendanceMetrics.noShows}</div>
              <div className="text-sm text-gray-500 mt-1">No Shows</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-gray-900">
                {Math.round(mockAnalytics.attendanceMetrics.noShowRate * 100)}%
              </div>
              <div className="text-sm text-gray-500 mt-1">No-show Rate</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-ins by Time</h3>
            <div className="space-y-4">
              {mockAnalytics.attendanceMetrics.checkInsByTime.map((timeSlot) => {
                const maxCount = Math.max(
                  ...mockAnalytics.attendanceMetrics.checkInsByTime.map((t) => t.count)
                );
                return (
                  <div key={timeSlot.timeBucket}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{timeSlot.timeBucket}</span>
                      <span className="text-sm text-gray-500">{timeSlot.count} check-ins</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${(timeSlot.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === "revenue" && mockAnalytics.revenueMetrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-gray-900">
                ${mockAnalytics.revenueMetrics.totalRevenue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">Total Revenue</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-gray-900">
                ${mockAnalytics.revenueMetrics.totalRefunds.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">Total Refunds</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-gray-900">
                ${mockAnalytics.revenueMetrics.averageTransactionValue.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500 mt-1">Avg. Transaction</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Payment Method</h3>
            <div className="space-y-4">
              {Object.entries(mockAnalytics.revenueMetrics.revenueByMethod).map(([method, amount]) => {
                const total = Object.values(mockAnalytics.revenueMetrics!.revenueByMethod).reduce(
                  (a, b) => a + b,
                  0
                );
                const percentage = Math.round((amount / total) * 100);
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">{method}</span>
                      <span className="text-sm text-gray-500">
                        ${amount.toLocaleString()} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
