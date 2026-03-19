import { env } from '../types/env';
import { supabase } from './supabase';

export type ApiError = {
  error: string;
  code: string;
  details?: Record<string, unknown>;
};

export const invokeFunction = async <T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
  }
): Promise<T> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (token?.startsWith('demo-')) {
    return mockFunctionResponse<T>(path, options?.body);
  }
  if (!token) {
    throw new Error('Session missing. Please sign in again.');
  }

  const response = await fetch(toFunctionsUrl(path), {
    method: options?.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
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

const toFunctionsUrl = (path: string): string => {
  const cleanBase = env.apiBaseUrl.replace(/\/+$/, '');
  const pathClean = path.replace(/^\/+/, '');
  if (/\/functions\/v1$/.test(cleanBase)) {
    return `${cleanBase}/${pathClean}`;
  }
  return `${cleanBase}/functions/v1/${pathClean}`;
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

  if (path === 'feed-home') {
    return [
      {
        id: `demo-feed-${Date.now()}`,
        score: 0.91,
        published_at: now.toISOString(),
        engagement_requests: {
          id: 'demo-engagement-1',
          question_text: 'How do I stabilize my backswing tempo?',
          engagement_mode: 'video_answer',
          engagement_responses: [{ response_text: 'Focus on a 3:1 rhythm and lower-body anchoring.', transcript: null }]
        }
      }
    ] as T;
  }

  if (path === 'payments-review-order-confirm') {
    return {
      id: (body?.reviewOrderId as string) ?? `demo-order-${Date.now()}`,
      status: (body?.status as string) ?? 'paid'
    } as T;
  }

  if (path === 'engagements-publish') {
    return {
      id: (body?.engagementRequestId as string) ?? `demo-engagement-${Date.now()}`,
      status: 'awaiting_expert'
    } as T;
  }

  if (path === 'inbox-conversations') {
    return {
      data: [
        {
          threadType: 'session',
          threadId: 'demo-session-1',
          title: 'Session demo',
          status: 'confirmed',
          lastMessage: 'See you at the court at 6pm.',
          lastMessageAt: now.toISOString(),
          unreadCount: 1
        },
        {
          threadType: 'engagement',
          threadId: 'demo-engagement-2',
          title: 'Request demo',
          status: 'awaiting_expert',
          lastMessage: 'Can we focus on serve consistency?',
          lastMessageAt: now.toISOString(),
          unreadCount: 0
        }
      ],
      nextCursor: null
    } as T;
  }

  if (path === 'inbox-mark-read') {
    return {
      id: `demo-read-${Date.now()}`,
      ...body
    } as T;
  }

  if (path === 'engagement-chat-send' || path === 'chat-send') {
    return {
      id: `demo-msg-${Date.now()}`,
      sender_user_id: 'demo-user',
      message: (body?.message as string) ?? 'demo message',
      created_at: now.toISOString(),
      client_message_id: (body?.clientMessageId as string | undefined) ?? null
    } as T;
  }

  if (path === 'calls-create-room') {
    return {
      roomUrl: 'https://www.daily.co/example-room',
      id: `demo-call-${Date.now()}`,
      engagement_request_id: body?.engagementRequestId ?? 'demo-engagement'
    } as T;
  }

  if (path === 'calls-start') {
    return { started: true } as T;
  }

  if (path === 'calls-end') {
    return { billableMinutes: 22, durationSeconds: 1310 } as T;
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

  throw new Error(`Function not available in demo mode: ${path}`);
};
