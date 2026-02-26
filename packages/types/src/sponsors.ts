// Sponsors domain types
import type { UUID } from './common';

export interface SponsorEventCreateDTO {
  sponsorId?: UUID;
  sponsorName?: string;
  sponsorCity?: string;
  title: string;
  description?: string;
  activityId: UUID;
  city?: string;
  venueName?: string;
  latitude?: number;
  longitude?: number;
  startTime: string;
  endTime: string;
  maxParticipants?: number;
}

export interface SponsorEventDTO {
  id: UUID;
  sponsor_id: UUID;
  sponsor_name?: string;
  activity_id: UUID;
  title: string;
  description?: string;
  city?: string;
  venue_name?: string;
  start_time: string;
  end_time: string;
  status: 'draft' | 'published' | 'closed' | 'cancelled';
  max_participants: number;
  registration_count?: number;
  my_registration_status?: 'registered' | 'waitlist' | 'cancelled' | 'checked_in' | null;
}

export interface SponsorEventInviteLocalsDTO {
  eventId: UUID;
  radiusKm?: number;
  limit?: number;
  message?: string;
}

export interface SponsorEventRSVPDTO {
  eventId: UUID;
  action: 'register' | 'cancel' | 'accept_invite' | 'decline_invite';
}

export interface NetworkingInviteSendDTO {
  receiverUserId: UUID;
  activityId: UUID;
  relatedEventId?: UUID;
  purpose?: 'session' | 'tournament' | 'networking';
  message?: string;
}
