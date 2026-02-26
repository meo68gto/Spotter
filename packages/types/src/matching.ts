// Matching domain types
import type { UUID } from './common';

export interface SkillDimension {
  key: string;
  label: string;
  score: number;
  maxScore?: number;
}

export interface SkillProfileDTO {
  id: UUID;
  userId: UUID;
  activityId: UUID;
  canonicalScore: number;
  confidence: number;
  sourceScale: string;
  skillBand: string;
  dimensions: SkillDimension[];
  updatedAt: string;
}

export interface MatchCandidateDTO {
  userId: UUID;
  activityId: UUID;
  distanceKm: number;
  skillDelta: number;
  availabilityOverlapMinutes: number;
  reasons: string[];
  matchScore?: number;
}

export type MatchStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface MatchRequestDTO {
  candidateUserId: UUID;
  activityId: UUID;
  requestedFrom?: string;
  requestedTo?: string;
}

export interface MatchActionDTO {
  matchId: UUID;
}
