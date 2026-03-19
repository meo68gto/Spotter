import { useState, useEffect } from "react";
import type { OrganizerEvent, EventStatus, EventType } from "@spotter/types";

// Mock data - would be fetched from API
const mockEvents: OrganizerEvent[] = [
  {
    id: "evt-1",
    organizerId: "org-1",
    title: "Spring Championship Tournament",
    description: "Annual spring golf tournament",
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
    title: "Corporate Scramble",
    type: "scramble",
    status: "published",
    courseId: "course-2",
    courseName: "Oakmont Country Club",
    startTime: "2024-04-22T09:00:00Z",
    endTime: "2024-04-22T15:00:00Z",
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
    title: "Charity Fundraiser",
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
];

interface UseOrganizerEventsOptions {
  status?: EventStatus;
  type?: EventType;
  upcoming?: boolean;
}

interface UseOrganizerEventsReturn {
  events: OrganizerEvent[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createEvent: (event: Omit<OrganizerEvent, "id" | "createdAt" | "updatedAt">) => Promise<OrganizerEvent>;
  updateEvent: (id: string, updates: Partial<OrganizerEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

export function useOrganizerEvents(options?: UseOrganizerEventsOptions): UseOrganizerEventsReturn {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // In production:
      // const response = await fetch('/api/organizer/events');
      // const data = await response.json();

      let filteredEvents = mockEvents;

      if (options?.status) {
        filteredEvents = filteredEvents.filter((e) => e.status === options.status);
      }

      if (options?.type) {
        filteredEvents = filteredEvents.filter((e) => e.type === options.type);
      }

      if (options?.upcoming !== undefined) {
        const now = new Date();
        filteredEvents = filteredEvents.filter((e) =>
          options.upcoming ? new Date(e.startTime) > now : new Date(e.startTime) <= now
        );
      }

      setEvents(filteredEvents);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch events"));
    } finally {
      setIsLoading(false);
    }
  };

  const createEvent = async (
    eventData: Omit<OrganizerEvent, "id" | "createdAt" | "updatedAt">
  ): Promise<OrganizerEvent> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    const newEvent: OrganizerEvent = {
      ...eventData,
      id: `evt-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setEvents((prev) => [...prev, newEvent]);
    return newEvent;
  };

  const updateEvent = async (id: string, updates: Partial<OrganizerEvent>): Promise<void> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setEvents((prev) =>
      prev.map((event) =>
        event.id === id
          ? { ...event, ...updates, updatedAt: new Date().toISOString() }
          : event
      )
    );
  };

  const deleteEvent = async (id: string): Promise<void> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setEvents((prev) => prev.filter((event) => event.id !== id));
  };

  useEffect(() => {
    fetchEvents();
  }, [options?.status, options?.type, options?.upcoming]);

  return {
    events,
    isLoading,
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
