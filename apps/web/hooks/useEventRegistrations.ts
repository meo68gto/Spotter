import { useState, useEffect } from "react";
import type { EventRegistration, RegistrationWithUser, RegistrationStatus } from "@spotter/types";

// Mock data - would be fetched from API
const mockRegistrations: RegistrationWithUser[] = [
  {
    id: "reg-1",
    eventId: "evt-1",
    userId: "user-1",
    displayName: "Alice Johnson",
    email: "alice@example.com",
    status: "confirmed",
    paymentStatus: "paid",
    amountPaidCents: 5000,
    registeredAt: "2024-03-01T10:30:00Z",
    confirmedAt: "2024-03-01T12:00:00Z",
    handicapAtRegistration: 12,
    marketingOptIn: true,
  },
  {
    id: "reg-2",
    eventId: "evt-1",
    userId: "user-2",
    displayName: "Bob Smith",
    email: "bob@example.com",
    status: "registered",
    paymentStatus: "pending",
    registeredAt: "2024-03-02T09:15:00Z",
    handicapAtRegistration: 18,
    marketingOptIn: false,
  },
  {
    id: "reg-3",
    eventId: "evt-1",
    userId: "user-3",
    displayName: "Carol White",
    email: "carol@example.com",
    status: "confirmed",
    paymentStatus: "waived",
    registeredAt: "2024-03-03T16:45:00Z",
    confirmedAt: "2024-03-03T18:00:00Z",
    handicapAtRegistration: 8,
    marketingOptIn: true,
  },
];

interface UseEventRegistrationsOptions {
  eventId: string;
  status?: RegistrationStatus;
}

interface UseEventRegistrationsReturn {
  registrations: RegistrationWithUser[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  checkInRegistration: (registrationId: string) => Promise<void>;
  cancelRegistration: (registrationId: string, reason?: string) => Promise<void>;
  updateRegistrationStatus: (registrationId: string, status: RegistrationStatus) => Promise<void>;
  stats: {
    total: number;
    confirmed: number;
    checkedIn: number;
    waitlisted: number;
    cancelled: number;
    noShows: number;
    revenue: number;
  };
}

export function useEventRegistrations(
  options: UseEventRegistrationsOptions
): UseEventRegistrationsReturn {
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRegistrations = async () => {
    if (!options.eventId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // In production:
      // const response = await fetch(`/api/organizer/events/${options.eventId}/registrations`);
      // const data = await response.json();

      let filteredRegistrations = mockRegistrations.filter(
        (r) => r.eventId === options.eventId
      );

      if (options?.status) {
        filteredRegistrations = filteredRegistrations.filter(
          (r) => r.status === options.status
        );
      }

      setRegistrations(filteredRegistrations);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch registrations"));
    } finally {
      setIsLoading(false);
    }
  };

  const checkInRegistration = async (registrationId: string): Promise<void> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setRegistrations((prev) =>
      prev.map((reg) =>
        reg.id === registrationId
          ? {
              ...reg,
              status: "checked_in",
              checkedInAt: new Date().toISOString(),
              checkedInByUserId: "current-user",
            }
          : reg
      )
    );
  };

  const cancelRegistration = async (registrationId: string, reason?: string): Promise<void> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setRegistrations((prev) =>
      prev.map((reg) =>
        reg.id === registrationId
          ? {
              ...reg,
              status: "cancelled",
              cancelledAt: new Date().toISOString(),
              cancelledByUserId: "current-user",
              cancellationReason: reason,
            }
          : reg
      )
    );
  };

  const updateRegistrationStatus = async (
    registrationId: string,
    status: RegistrationStatus
  ): Promise<void> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setRegistrations((prev) =>
      prev.map((reg) =>
        reg.id === registrationId
          ? {
              ...reg,
              status,
              ...(status === "confirmed" ? { confirmedAt: new Date().toISOString() } : {}),
            }
          : reg
      )
    );
  };

  // Calculate stats
  const stats = {
    total: registrations.length,
    confirmed: registrations.filter((r) => r.status === "confirmed").length,
    checkedIn: registrations.filter((r) => r.status === "checked_in").length,
    waitlisted: registrations.filter((r) => r.status === "waitlisted").length,
    cancelled: registrations.filter((r) => r.status === "cancelled").length,
    noShows: registrations.filter((r) => r.status === "no_show").length,
    revenue: registrations.reduce((sum, r) => sum + (r.amountPaidCents || 0), 0),
  };

  useEffect(() => {
    fetchRegistrations();
  }, [options.eventId, options?.status]);

  return {
    registrations,
    isLoading,
    error,
    refetch: fetchRegistrations,
    checkInRegistration,
    cancelRegistration,
    updateRegistrationStatus,
    stats,
  };
}
