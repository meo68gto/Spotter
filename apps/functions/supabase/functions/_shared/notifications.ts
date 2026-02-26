// _shared/notifications.ts
// Push notification dispatch with error handling and logging
import { createLogger } from './telemetry.ts';

const log = createLogger('notifications', 'shared');

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushToken {
  token: string;
  platform: 'expo' | 'apns' | 'fcm';
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Send a push notification to a user via their stored push tokens */
export async function sendNotification(
  userId: string,
  notification: NotificationPayload,
  client: any // SupabaseClient
): Promise<void> {
  let tokens: PushToken[] = [];

  try {
    const { data, error } = await client
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', userId);

    if (error) throw error;
    tokens = (data ?? []) as PushToken[];
  } catch (err) {
    log.error('Failed to fetch push tokens', err, { userId });
    return;
  }

  if (tokens.length === 0) {
    log.warn('No push tokens found for user', { userId });
    return;
  }

  const expoTokens = tokens
    .filter(t => t.platform === 'expo' && t.token.startsWith('ExponentPushToken'))
    .map(t => t.token);

  if (expoTokens.length === 0) {
    log.warn('No valid Expo push tokens for user', { userId, tokenCount: tokens.length });
    return;
  }

  try {
    const messages = expoTokens.map(to => ({
      to,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
      sound: 'default',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Expo push API returned ${res.status}: ${text}`);
    }

    const result = await res.json();
    const failed = (result.data ?? []).filter(
      (r: { status: string }) => r.status !== 'ok'
    );

    if (failed.length > 0) {
      log.warn('Some notifications failed to deliver', {
        userId,
        failedCount: failed.length,
        total: expoTokens.length,
      });
    } else {
      log.info('Notifications sent successfully', {
        userId,
        count: expoTokens.length,
      });
    }
  } catch (err) {
    log.error('Failed to send push notification', err, { userId });

    // Persist failed notification for retry
    try {
      await client.from('notification_queue').insert({
        user_id: userId,
        payload: notification,
        attempt_count: 1,
        last_error: err instanceof Error ? err.message : String(err),
        next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      });
    } catch (persistErr) {
      log.error('Failed to persist notification to retry queue', persistErr, { userId });
    }
  }
}

/** Send an in-app notification via Supabase realtime channel */
export async function sendInAppNotification(
  userId: string,
  notification: NotificationPayload,
  client: any // SupabaseClient
): Promise<void> {
  try {
    await client.from('notifications').insert({
      user_id: userId,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    log.error('Failed to store in-app notification', err, { userId });
  }
}
