// Session domain types
import type { UUID } from './common';

export type SessionStatus =
  | 'proposed'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface SessionDTO {
  id: UUID;
  matchId: UUID;
  proposerUserId: UUID;
  partnerUserId: UUID;
  proposedStartTime: string;
  confirmedTime?: string;
  locationPoint: {
    latitude: number;
    longitude: number;
  };
  status: SessionStatus;
}

export interface SessionActionDTO {
  sessionId: UUID;
  confirmedTime?: string;
  latitude?: number;
  longitude?: number;
}

export interface ChatMessageDTO {
  sessionId: UUID;
  message: string;
  clientMessageId?: string;
}
