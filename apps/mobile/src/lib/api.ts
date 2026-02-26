import { env } from '../types/env';
import { supabase } from './supabase';

export type ApiError = {
  error: string;
  code: string;
  details?: Record<string, unknown>;
};

// M-1: Extended invokeFunction — supports GET with query params and optional auth
export const invokeFunction = async <T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    query?: Record<string, string | number | boolean | undefined>;
    requireAuth?: boolean;
  }
): Promise<T> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (token?.startsWith('demo-')) {
    return mockFunctionResponse<T>(path, options?.body);
  }

  // requireAuth defaults to true; pass false only for public endpoints
  const authRequired = options?.requireAuth !== false;
  if (authRequired && !token) {
    throw new Error('Session missing. Please sign in again.');
  }

  // Build URL with optional query params for GET requests
  let url = `${env.apiBaseUrl}/functions/v1/${path}`;
  if (options?.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs) url = `${url}?${qs}`;
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: options?.method ?? 'POST',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: string;
    code?: string;
    details?: Record<string, unknown>;
  };

  if (!response.ok) {
    const err: ApiError = {
      error: payload.error ?? 'Request failed',
      code: payload.code ?? 'request_failed',
      details: payload.details
    };
    const message = `${err.error} (${err.code})`;
    throw new Error(message);
  }

  return payload.data as T;
};

const mockFunctionResponse = async <T>(path: string, body?: Record<string, unknown>): Promise<T> => {
  const now = new Date();
  const plusDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  if (path === 'mcp-booking-plan') {
    return {
      run: {
        id: `demo-run-${Date.now()}`
      },
      pairings: [
        {
          candidateUserId: 'demo-player-1',
          candidateDisplayName: 'Avery G.',
          score: 0.94,
          distanceKm: 6.2,
          reasons: ['same_sport', 'nearby', 'skill_fit']
        },
        {
          candidateUserId: 'demo-player-2',
          candidateDisplayName: 'Jordan P.',
          score: 0.88,
          distanceKm: 9.4,
          reasons: ['availability_overlap', 'recent_activity']
        }
      ],
      events: [
        {
          eventId: 'demo-event-1',
          title: 'Local Sponsor Invitational',
          city: 'Scottsdale',
          sponsorName: 'Spotter Demo Sponsor'
        }
      ]
    } as T;
  }

  if (path === 'networking-invite-send') {
    return {
      id: `demo-invite-${Date.now()}`,
      status: 'sent',
      ...body
    } as T;
  }

  if (path === 'sponsors-event-list') {
    return [
      {
        id: 'demo-event-1',
        sponsor_id: 'demo-sponsor-1',
        activity_id: (body?.activityId as string | undefined) ?? 'demo-activity-golf',
        title: 'Spotter Open: Local Golf Day',
        description: 'Sponsored local tournament',
        city: 'Scottsdale',
        venue_name: 'Desert Hills Club',
        start_time: plusDays(10),
        end_time: plusDays(10),
        status: 'published',
        max_participants: 64,
        created_at: now.toISOString(),
        sponsor_name: 'Spotter Demo Sponsor',
        registration_count: 18,
        my_registration_status: null
      },
      {
        id: 'demo-event-2',
        sponsor_id: 'demo-sponsor-2',
        activity_id: (body?.activityId as string | undefined) ?? 'demo-activity-pickleball',
        title: 'City Pickleball Ladder',
        description: 'Sponsored local ladder event',
        city: 'Austin',
        venue_name: 'Downtown Courts',
        start_time: plusDays(14),
        end_time: plusDays(14),
        status: 'published',
        max_participants: 48,
        created_at: now.toISOString(),
        sponsor_name: 'CourtSide Partners',
        registration_count: 27,
        my_registration_status: null
      }
    ] as T;
  }

  if (path === 'sponsors-event-create') {
    return {
      id: `demo-created-event-${Date.now()}`,
      status: 'published',
      ...body
    } as T;
  }

  if (path === 'sponsors-event-rsvp') {
    return {
      id: `demo-rsvp-${Date.now()}`,
      status: body?.action === 'cancel' ? 'cancelled' : 'registered',
      ...body
    } as T;
  }

  if (path === 'sponsors-event-invite-locals') {
    return {
      invited: 12,
      invites: []
    } as T;
  }

  if (path === 'matching-candidates') {
    return {
      data: []
    } as T;
  }

  if (path === 'matching-request') {
    return { id: `demo-match-${Date.now()}`, status: 'pending', ...body } as T;
  }

  if (path === 'matching-accept' || path === 'matching-reject') {
    return { success: true, ...body } as T;
  }

  if (path === 'profiles-feedback-summary') {
    return { data: [] } as T;
  }

  if (path === 'sessions-propose' || path === 'sessions-confirm' || path === 'sessions-cancel') {
    return {
      data: { id: `demo-session-${Date.now()}`, status: 'proposed', ...body }
    } as T;
  }

  if (path === 'sessions-feedback') {
    return { success: true } as T;
  }

  if (path === 'chat-send') {
    return {
      data: {
        id: `demo-msg-${Date.now()}`,
        sender_user_id: 'demo-user',
        message: body?.message ?? '',
        created_at: new Date().toISOString()
      }
    } as T;
  }

  if (path === 'onboarding-profile') {
    return { success: true } as T;
  }

  if (path.startsWith('progress-')) {
    return { data: [], summary: null } as T;
  }

  if (path === 'videos-presign') {
    return { data: { id: `demo-submission-${Date.now()}`, upload_url: 'https://example.com/upload' } } as T;
  }

  if (path === 'videos-enqueue-processing') {
    return { success: true } as T;
  }

  throw new Error(`Function not available in demo mode: ${path}`);
};
