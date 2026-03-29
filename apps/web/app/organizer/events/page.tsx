"use client";

import { useState } from "react";
import Link from "next/link";
import { EventCard } from "../../../components/organizer/EventCard";
import type { OrganizerEvent, EventStatus, EventType } from "@spotter/types";
import { EVENT_STATUSES, EVENT_TYPES } from "@spotter/types";

// Mock data - would come from API in production
const mockEvents: OrganizerEvent[] = [
  {
    id: "evt-1",
    organizerId: "org-1",
    title: "Spring Championship Tournament",
    description: "Annual spring golf tournament with prizes",
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
  },
  {
    id: "evt-2",
    organizerId: "org-1",
    title: "Corporate Team Building Scramble",
    description: "Fun scramble format for corporate teams",
    type: "scramble",
    status: "published",
    courseId: "course-2",
    courseName: "Oakmont Country Club",
    startTime: "2024-04-22T09:00:00Z",
    endTime: "2024-04-22T15:00:00Z",
    registrationOpensAt: "2024-03-20T00:00:00Z",
    maxParticipants: 80,
    registrationCount: 0,
    waitlistCount: 0,
    entryFeeCents: 7500,
    currency: "USD",
    isPublic: false,
    targetTiers: ["silver", "gold"],
    createdByUserId: "user-1",
    createdAt: "2024-03-01T09:00:00Z",
    updatedAt: "2024-03-01T09:00:00Z",
  },
  {
    id: "evt-3",
    organizerId: "org-1",
    title: "Charity Golf Fundraiser",
    description: "Annual charity event supporting local youth programs",
    type: "charity",
    status: "draft",
    courseId: "course-3",
    courseName: "Pebble Beach Golf Links",
    startTime: "2024-05-10T07:30:00Z",
    endTime: "2024-05-10T17:00:00Z",
    maxParticipants: 144,
    registrationCount: 0,
    waitlistCount: 0,
    entryFeeCents: 15000,
    currency: "USD",
    isPublic: true,
    targetTiers: ["gold"],
    createdByUserId: "user-1",
    createdAt: "2024-03-10T11:00:00Z",
    updatedAt: "2024-03-10T11:00:00Z",
  },
  {
    id: "evt-4",
    organizerId: "org-1",
    title: "Summer Social Mixer",
    description: "Casual social event with dinner",
    type: "social",
    status: "completed",
    courseId: "course-4",
    courseName: "Augusta National Golf Club",
    startTime: "2023-08-20T17:00:00Z",
    endTime: "2023-08-20T21:00:00Z",
    registrationOpensAt: "2023-07-01T00:00:00Z",
    registrationClosesAt: "2023-08-18T23:59:59Z",
    maxParticipants: 60,
    registrationCount: 58,
    waitlistCount: 0,
    isPublic: true,
    targetTiers: ["bronze", "silver", "gold"],
    createdByUserId: "user-1",
    createdAt: "2023-06-15T10:00:00Z",
    updatedAt: "2023-08-21T09:00:00Z",
  },
  {
    id: "evt-5",
    organizerId: "org-1",
    title: "Fall Invitational",
    description: "Exclusive invitational tournament",
    type: "tournament",
    status: "cancelled",
    courseId: "course-5",
    courseName: "St Andrews Links",
    startTime: "2023-10-15T08:00:00Z",
    endTime: "2023-10-15T16:00:00Z",
    maxParticipants: 100,
    registrationCount: 0,
    waitlistCount: 0,
    entryFeeCents: 10000,
    currency: "USD",
    isPublic: false,
    targetTiers: ["gold"],
    createdByUserId: "user-1",
    createdAt: "2023-09-01T10:00:00Z",
    updatedAt: "2023-09-30T14:00:00Z",
  },
];

export default function EventsPage() {
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [dateRange, setDateRange] = useState<"upcoming" | "past" | "all">("upcoming");

  const filteredEvents = mockEvents.filter((event) => {
    if (statusFilter !== "all" && event.status !== statusFilter) return false;
    if (typeFilter !== "all" && event.type !== typeFilter) return false;
    if (dateRange === "upcoming") {
      return new Date(event.startTime) > new Date();
    } else if (dateRange === "past") {
      return new Date(event.startTime) < new Date();
    }
    return true;
  });

  const getStatusColor = (status: EventStatus) => {
    const colors: Record<EventStatus, string> = {
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600">Manage your tournaments, scrambles, and social events.</p>
        </div>
        <Link
          href="/organizer/events/create"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Event
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EventStatus | "all")}
              className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            >
              <option value="all">All Statuses</option>
              {EVENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EventType | "all")}
              className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            >
              <option value="all">All Types</option>
              {EVENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as "upcoming" | "past" | "all")}
              className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            >
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registrations
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEvents.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{event.title}</div>
                      <div className="text-sm text-gray-500">{event.courseName}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(event.startTime).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      event.status
                    )}`}
                  >
                    {EVENT_STATUSES.find((s) => s.value === event.status)?.label || event.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {event.registrationCount} / {event.maxParticipants}
                  </div>
                  {event.waitlistCount > 0 && (
                    <div className="text-sm text-yellow-600">{event.waitlistCount} waitlisted</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <Link
                      href={`/organizer/events/${event.id}`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View
                    </Link>
                    {event.status !== "completed" && event.status !== "cancelled" && (
                      <>
                        <Link
                          href={`/organizer/events/${event.id}/edit`}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Edit
                        </Link>
                        <button className="text-red-600 hover:text-red-900">Cancel</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEvents.length === 0 && (
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No events found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new event.</p>
            <div className="mt-6">
              <Link
                href="/organizer/events/create"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Event
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
