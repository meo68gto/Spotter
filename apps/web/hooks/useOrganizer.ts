import { useState, useEffect } from "react";
import type { OrganizerAccount, OrganizerWithStats, OrganizerQuotaInfo } from "@spotter/types";

// Mock data - would be fetched from API
const mockOrganizer: OrganizerWithStats = {
  id: "org-1",
  name: "Tournament Organizers LLC",
  slug: "tournament-organizers",
  description: "Professional golf tournament organizers",
  website: "https://example.com",
  email: "contact@example.com",
  tier: "gold",
  status: "active",
  ownerId: "user-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-03-15T10:00:00Z",
  totalEvents: 12,
  totalRegistrations: 156,
  activeEvents: 3,
  totalRevenue: 12450,
  memberCount: 5,
  lastActivityAt: "2024-03-15T10:00:00Z",
};

const mockQuotaInfo: OrganizerQuotaInfo = {
  eventsUsed: 8,
  eventsLimit: null, // Unlimited for Gold
  registrationsUsed: 156,
  registrationsLimit: null, // Unlimited for Gold
  storageUsed: 1024 * 1024 * 50, // 50MB
  storageLimit: null, // Unlimited for Gold
  apiCallsUsed: 4521,
  apiCallsLimit: null, // Unlimited for Gold
  periodStart: "2024-03-01T00:00:00Z",
  periodEnd: "2024-03-31T23:59:59Z",
};

interface UseOrganizerReturn {
  organizer: OrganizerWithStats | null;
  quotaInfo: OrganizerQuotaInfo | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useOrganizer(): UseOrganizerReturn {
  const [organizer, setOrganizer] = useState<OrganizerWithStats | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<OrganizerQuotaInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrganizer = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // In production, this would be:
      // const response = await fetch('/api/organizer');
      // const data = await response.json();

      setOrganizer(mockOrganizer);
      setQuotaInfo(mockQuotaInfo);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch organizer"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizer();
  }, []);

  return {
    organizer,
    quotaInfo,
    isLoading,
    error,
    refetch: fetchOrganizer,
  };
}
