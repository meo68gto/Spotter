import { json, badRequest, unauthorized, serverError, forbidden } from '../_shared/http.ts';
import { createAuthedClient, createServiceClient } from '../_shared/client.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getRuntimeEnv } from '../_shared/env.ts';

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
    fault?: string;
  };
}

interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
    fault?: string;
    sentAt?: number;
    deliveredAt?: number;
  };
}

// Send push notifications via Expo
async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<{
  tickets: ExpoPushTicket[];
  errors: string[];
}> {
  const errors: string[] = [];
  const tickets: ExpoPushTicket[] = [];

  // Expo Push API has a limit of 100 messages per request
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        errors.push(`Expo API error: ${response.status} - ${text}`);
        continue;
      }

      const data = await response.json();
      if (data.data) {
        tickets.push(...data.data);
      }
      if (data.errors?.length) {
        errors.push(...data.errors.map((e: { message: string }) => e.message));
      }
    } catch (err) {
      errors.push(`Failed to send to Expo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { tickets, errors };
}

// Check push receipt status from Expo
async function checkExpoPushReceipts(ids: string[]): Promise<Record<string, ExpoPushReceipt>> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      throw new Error(`Expo receipts API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || {};
  } catch (err) {
    console.error('Failed to check receipts:', err);
    return {};
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const authHeader = req.headers.get('Authorization');
  const apiKey = req.headers.get('X-API-Key');
  const env = getRuntimeEnv();

  let userId: string | null = null;
  let isServiceCall = false;

  // Check for service-to-service API key
  if (apiKey && env.internalApiKey && apiKey === env.internalApiKey) {
    isServiceCall = true;
  } else if (authHeader) {
    // Check user auth
    try {
      const authedClient = createAuthedClient(authHeader);
      const {
        data: { user },
        error: authError
      } = await authedClient.auth.getUser();

      if (authError || !user) {
        return unauthorized('Invalid token');
      }
      userId = user.id;
    } catch {
      return unauthorized('Invalid authorization');
    }
  } else {
    return unauthorized('Missing authorization');
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      user_id: targetUserId,
      notification_type: notificationType,
      title,
      body,
      data = {},
      priority = 'default'
    } = body;

    // Validate required fields
    if (!targetUserId) {
      return badRequest('Missing target user_id');
    }
    if (!notificationType) {
      return badRequest('Missing notification_type');
    }
    if (!title) {
      return badRequest('Missing title');
    }
    if (!body) {
      return badRequest('Missing body');
    }

    // Non-service calls can only send to themselves
    if (!isServiceCall && targetUserId !== userId) {
      return forbidden('Can only send notifications to yourself');
    }

    const serviceClient = createServiceClient();

    // Check user's notification preferences
    const { data: settings, error: settingsError } = await serviceClient
      .from('user_notification_settings')
      .select('push_enabled')
      .eq('user_id', targetUserId)
      .eq('notification_type', notificationType)
      .maybeSingle();

    if (settingsError) {
      console.error('Failed to check notification settings:', settingsError);
    }

    // If user has disabled push for this notification type, skip
    if (settings && settings.push_enabled === false) {
      return json(200, {
        success: true,
        message: 'Skipped - user has disabled push notifications for this type',
        skipped: true
      });
    }

    // Get active push tokens for the user
    const { data: tokens, error: tokensError } = await serviceClient
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', targetUserId)
      .eq('is_active', true);

    if (tokensError) {
      console.error('Failed to fetch tokens:', tokensError);
      return serverError('Failed to fetch push tokens');
    }

    if (!tokens || tokens.length === 0) {
      return json(200, {
        success: true,
        message: 'No active push tokens found for user',
        skipped: true
      });
    }

    // Prepare Expo push messages
    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: {
        ...data,
        notification_type: notificationType,
        user_id: targetUserId,
      },
      sound: 'default',
      priority: priority === 'high' ? 'high' : 'default',
    }));

    // Send to Expo
    const { tickets, errors } = await sendExpoPushNotifications(messages);

    // Log deliveries to database
    const deliveryRecords = tickets.map((ticket, index) => ({
      user_id: targetUserId,
      notification_type: notificationType,
      title,
      body,
      data,
      channel: 'push' as const,
      status: ticket.status === 'ok' ? 'sent' : 'failed',
      error_message: ticket.status === 'error' ? ticket.message : null,
      provider_response: ticket,
      sent_at: new Date().toISOString(),
    }));

    // Insert delivery records
    if (deliveryRecords.length > 0) {
      const { error: insertError } = await serviceClient
        .from('notification_deliveries')
        .insert(deliveryRecords);

      if (insertError) {
        console.error('Failed to log deliveries:', insertError);
      }
    }

    // Check for token errors and deactivate invalid tokens
    const invalidTokens: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'error') {
        // DeviceNotRegistered error means token is invalid
        if (ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(tokens[i].token);
        }
      }
    }

    // Deactivate invalid tokens
    if (invalidTokens.length > 0) {
      const { error: deactivateError } = await serviceClient
        .from('push_tokens')
        .update({ is_active: false })
        .in('token', invalidTokens);

      if (deactivateError) {
        console.error('Failed to deactivate invalid tokens:', deactivateError);
      }
    }

    // If there were errors but also some successes, return partial success
    if (errors.length > 0 && tickets.some((t) => t.status === 'ok')) {
      return json(200, {
        success: true,
        partial: true,
        sent: tickets.filter((t) => t.status === 'ok').length,
        failed: errors.length,
        errors: errors.slice(0, 5), // Limit error details
        invalid_tokens_deactivated: invalidTokens.length
      });
    }

    // Complete failure
    if (errors.length > 0 && !tickets.some((t) => t.status === 'ok')) {
      return json(500, {
        success: false,
        error: 'Failed to send all notifications',
        details: errors.slice(0, 5)
      });
    }

    return json(200, {
      success: true,
      sent: tickets.filter((t) => t.status === 'ok').length,
      tokens_used: tokens.length,
      invalid_tokens_deactivated: invalidTokens.length
    });
  } catch (err) {
    console.error('Unexpected error in notifications-send:', err);
    return serverError('Internal server error');
  }
});
