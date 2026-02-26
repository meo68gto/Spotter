// _shared/daily.ts
// Daily.co video room API wrapper with typed interfaces

const DAILY_API_URL = 'https://api.daily.co/v1';

export interface DailyRoom {
  id: string;
  name: string;
  url: string;
  privacy: 'public' | 'private';
  config: { max_participants?: number; enable_recording?: string };
  created_at: string;
}

export interface DailyMeetingToken {
  token: string;
}

function getDailyApiKey(): string {
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) throw new Error('DAILY_API_KEY is not set');
  return key;
}

async function dailyRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${DAILY_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getDailyApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Daily API ${method} ${path} failed ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function createRoom(params: {
  name?: string;
  privacy?: 'public' | 'private';
  expiresAt?: number;
}): Promise<DailyRoom> {
  return dailyRequest<DailyRoom>('POST', '/rooms', {
    name: params.name,
    privacy: params.privacy ?? 'private',
    properties: {
      exp: params.expiresAt,
      max_participants: 2,
      enable_recording: 'local',
    },
  });
}

export async function getMeetingToken(
  roomName: string,
  userId: string,
  isOwner: boolean
): Promise<DailyMeetingToken> {
  return dailyRequest<DailyMeetingToken>('POST', '/meeting-tokens', {
    properties: {
      room_name: roomName,
      user_id: userId,
      is_owner: isOwner,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  });
}

export async function deleteRoom(roomName: string): Promise<void> {
  await dailyRequest<{ deleted: boolean; name: string }>('DELETE', `/rooms/${roomName}`);
}

export async function getRoom(roomName: string): Promise<DailyRoom> {
  return dailyRequest<DailyRoom>('GET', `/rooms/${roomName}`);
}
