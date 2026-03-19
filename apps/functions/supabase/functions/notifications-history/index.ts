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
    const url = new URL(req.url);

    // GET - Fetch notification history
    if (req.method === 'GET') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      const days = parseInt(url.searchParams.get('days') || '30');

      // Build query
      let query = serviceClient
        .from('notification_deliveries')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Add filters
      if (type) {
        query = query.eq('notification_type', type);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Failed to fetch notification history:', error);
        return serverError('Failed to fetch notification history');
      }

      // Calculate statistics
      const { data: stats } = await serviceClient
        .from('notification_deliveries')
        .select('status')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      const statistics = {
        total: stats?.length || 0,
        sent: stats?.filter((s) => s.status === 'sent').length || 0,
        delivered: stats?.filter((s) => s.status === 'delivered').length || 0,
        failed: stats?.filter((s) => s.status === 'failed').length || 0,
        bounced: stats?.filter((s) => s.status === 'bounced').length || 0,
        pending: stats?.filter((s) => s.status === 'pending').length || 0
      };

      return json(200, {
        notifications: data || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          has_more: (count || 0) > offset + limit
        },
        statistics
      });
    }

    // PATCH - Mark notification as read (update status to delivered)
    if (req.method === 'PATCH') {
      const body = await req.json().catch(() => ({}));
      const { notification_id: notificationId, status } = body;

      if (!notificationId) {
        return badRequest('Missing notification_id');
      }

      const updateData: Record<string, string | null> = {};
      if (status) {
        updateData.status = status;
      } else {
        // Default to marking as delivered
        updateData.status = 'delivered';
        updateData.delivered_at = new Date().toISOString();
      }

      const { data, error } = await serviceClient
        .from('notification_deliveries')
        .update(updateData)
        .eq('id', notificationId)
        .eq('user_id', user.id) // Ensure user owns this notification
        .select()
        .single();

      if (error) {
        console.error('Failed to update notification:', error);
        return serverError('Failed to update notification');
      }

      return json(200, {
        success: true,
        notification: data
      });
    }

    // DELETE - Clear old notification history
    if (req.method === 'DELETE') {
      const body = await req.json().catch(() => ({}));
      const days = body.days || 30;

      const { error, count } = await serviceClient
        .from('notification_deliveries')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('Failed to clear notification history:', error);
        return serverError('Failed to clear notification history');
      }

      return json(200, {
        success: true,
        deleted: count || 0
      });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Unexpected error in notifications-history:', err);
    return serverError('Internal server error');
  }
});
