import { getRuntimeEnv } from './env.ts';

const DAILY_API_BASE = 'https://api.daily.co/v1';

const signDailyToken = async (payload: Record<string, unknown>, secret: string) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const content = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(content));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${content}.${signature}`;
};

export const createDailyRoom = async (name: string, startsAtIso?: string) => {
  const env = getRuntimeEnv();
  if (!env.dailyApiKey) {
    return { roomUrl: `https://example.daily.co/${name}`, roomName: name };
  }

  const response = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.dailyApiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      name,
      properties: {
        enable_chat: true,
        start_video_off: false,
        nbf: startsAtIso ? Math.floor(new Date(startsAtIso).getTime() / 1000) : undefined
      }
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Daily room create failed: ${text}`);
  }

  const body = await response.json();
  return {
    roomUrl: body.url as string,
    roomName: body.name as string
  };
};

export const createDailyTokenPair = async (roomName: string, hostId: string, guestId: string) => {
  const env = getRuntimeEnv();
  const secret = env.dailyApiKey || env.serviceRoleKey;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 6;

  const hostToken = await signDailyToken(
    {
      iss: secret,
      sub: hostId,
      exp,
      room: roomName,
      owner: true
    },
    secret
  );

  const guestToken = await signDailyToken(
    {
      iss: secret,
      sub: guestId,
      exp,
      room: roomName,
      owner: false
    },
    secret
  );

  return { hostToken, guestToken };
};
