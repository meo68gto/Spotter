import { json, badRequest, unauthorized, serverError } from '../_shared/http.ts';
import { createAuthedClient, createServiceClient } from '../_shared/client.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return unauthorized('Missing authorization header');
  }

  try {
    const authedClient = createAuthedClient(authHeader);
    const {
      data: { user },
      error: authError
    } = await authedClient.auth.getUser();

    if (authError || !user) {
      return unauthorized('Invalid token');
    }

    const serviceClient = createServiceClient();

    // GET - Fetch user settings
    if (req.method === 'GET') {
      // Get all notification types
      const notificationTypes = [
        'round_invitation',
        'round_reminder',
        'trust_update',
        'reputation_update',
        'event_registration',
        'message',
        'connection_request',
        'session_reminder',
        'general'
      ];

      // Fetch user's settings
      const { data: settings, error: settingsError } = await serviceClient
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user.id);

      if (settingsError) {
        console.error('Failed to fetch settings:', settingsError);
        return serverError('Failed to fetch notification settings');
      }

      // Build response with defaults
      const settingsMap: Record<string, { push_enabled: boolean; email_enabled: boolean; sms_enabled: boolean }> = {};
      
      // Initialize all types with defaults
      for (const type of notificationTypes) {
        settingsMap[type] = { push_enabled: true, email_enabled: true, sms_enabled: false };
      }

      // Override with user's actual settings
      for (const row of (settings || [])) {
        settingsMap[row.notification_type] = {
          push_enabled: row.push_enabled,
          email_enabled: row.email_enabled,
          sms_enabled: row.sms_enabled
        };
      }

      // Get push token status
      const { data: tokens, error: tokensError } = await serviceClient
        .from('push_tokens')
        .select('id, is_active, last_used_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_used_at', { ascending: false });

      if (tokensError) {
        console.error('Failed to fetch tokens:', tokensError);
      }

      return json(200, {
        settings: settingsMap,
        push_tokens: (tokens || []).map(t => ({
          id: t.id,
          is_active: t.is_active,
          last_used_at: t.last_used_at
        })),
        has_push_enabled: (tokens || []).length > 0
      });
    }

    // POST - Update settings
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { 
        notification_type: notificationType,
        push_enabled: pushEnabled,
        email_enabled: emailEnabled,
        sms_enabled: smsEnabled
      } = body;

      if (!notificationType) {
        return badRequest('Missing notification_type');
      }

      const validTypes = [
        'round_invitation',
        'round_reminder',
        'trust_update',
        'reputation_update',
        'event_registration',
        'message',
        'connection_request',
        'session_reminder',
        'general'
      ];

      if (!validTypes.includes(notificationType)) {
        return badRequest(`Invalid notification_type. Must be one of: ${validTypes.join(', ')}`);
      }

      // Build update object
      const updateData: Record<string, boolean | string> = {
        user_id: user.id,
        notification_type: notificationType
      };

      if (pushEnabled !== undefined) {
        updateData.push_enabled = pushEnabled;
      }
      if (emailEnabled !== undefined) {
        updateData.email_enabled = emailEnabled;
      }
      if (smsEnabled !== undefined) {
        updateData.sms_enabled = smsEnabled;
      }

      const { data, error: upsertError } = await serviceClient
        .from('user_notification_settings')
        .upsert(updateData, { onConflict: 'user_id,notification_type' })
        .select()
        .single();

      if (upsertError) {
        console.error('Failed to update settings:', upsertError);
        return serverError('Failed to update notification settings');
      }

      return json(200, {
        success: true,
        setting: data
      });
    }

    // PUT - Bulk update settings
    if (req.method === 'PUT') {
      const body = await req.json().catch(() => ({}));
      const { settings } = body;

      if (!settings || typeof settings !== 'object') {
        return badRequest('Missing or invalid settings object');
      }

      const validTypes = [
        'round_invitation',
        'round_reminder',
        'trust_update',
        'reputation_update',
        'event_registration',
        'message',
        'connection_request',
        'session_reminder',
        'general'
      ];

      const records = [];
      for (const [type, config] of Object.entries(settings)) {
        if (!validTypes.includes(type)) continue;
        
        const cfg = config as { push_enabled?: boolean; email_enabled?: boolean; sms_enabled?: boolean };
        records.push({
          user_id: user.id,
          notification_type: type,
          push_enabled: cfg.push_enabled ?? true,
          email_enabled: cfg.email_enabled ?? true,
          sms_enabled: cfg.sms_enabled ?? false
        });
      }

      if (records.length === 0) {
        return badRequest('No valid settings to update');
      }

      const { error: upsertError } = await serviceClient
        .from('user_notification_settings')
        .upsert(records, { onConflict: 'user_id,notification_type' });

      if (upsertError) {
        console.error('Failed to bulk update settings:', upsertError);
        return serverError('Failed to update notification settings');
      }

      return json(200, {
        success: true,
        updated: records.length
      });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Unexpected error in notifications-settings:', err);
    return serverError('Internal server error');
  }
});
