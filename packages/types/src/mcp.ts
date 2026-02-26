// MCP (Machine-Curated Plan) domain types
import type { UUID } from './common';

export interface MCPBookingPlanRequestDTO {
  activityId: UUID;
  radiusKm?: number;
  limit?: number;
  includeEvents?: boolean;
  objective?: 'balanced' | 'fast_match' | 'tournament_ready';
}

export interface MCPPairingRecommendationDTO {
  type: 'pairing';
  candidateUserId: UUID | null;
  candidateDisplayName: string;
  candidateAvatarUrl?: string | null;
  score: number;
  distanceKm?: number | null;
  skillDelta?: number | null;
  availabilityOverlapMinutes?: number | null;
  reasons: string[];
}

export interface MCPEventRecommendationDTO {
  type: 'event';
  eventId: UUID | null;
  title: string;
  city?: string | null;
  venueName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sponsorName?: string | null;
  score: number;
  distanceKm?: number | null;
  reasons: string[];
}

export interface MCPBookingPlanResponseDTO {
  run: {
    id: UUID;
    requester_user_id: UUID;
    activity_id: UUID;
    objective: string;
    radius_km: number;
    include_events: boolean;
    created_at: string;
  };
  pairings: MCPPairingRecommendationDTO[];
  events: MCPEventRecommendationDTO[];
}
