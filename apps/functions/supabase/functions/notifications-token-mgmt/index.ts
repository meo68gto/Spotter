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
    const action = url.searchParams.get('action');

    // GET - List user's tokens
    if (req.method === 'GET') {
      const { data: tokens, error } = await serviceClient
        .from('push_tokens')
        .select('id, platform, is_active, last_used_at, created_at')
        .eq('user_id', user.id)
        .order('last_used_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch tokens:', error);
        return serverError('Failed to fetch tokens');
      }

      return json(200, { tokens: tokens || [] });
    }

    // POST - Register or update token
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { token, platform, app_version, device_info } = body;

      if (!token || typeof token !== 'string') {
        return badRequest('Missing or invalid token');
      }

      if (!platform || !['ios', 'android', 'web'].includes(platform)) {
        return badRequest('Missing or invalid platform');
      }

      // Upsert the token using RPC
      const { data: tokenId, error: upsertError } = await serviceClient.rpc(
        'upsert_push_token',
        {
          p_user_id: user.id,
          p_token: token,
          p_platform: platform,
          p_app_version: app_version || null,
          p_device_info: device_info || {}
        }
      );

      if (upsertError) {
        console.error('Failed to upsert token:', upsertError);
        return serverError('Failed to register token');
      }

      return json(200, {
        success: true,
        token_id: tokenId,
        message: 'Token registered successfully'
      });
    }

    // DELETE - Deactivate token
    if (req.method === 'DELETE') {
      const body = await req.json().catch(() => ({}));
      const { token } = body;

      if (!token) {
        return badRequest('Missing token to delete');
      }

      const { error } = await serviceClient
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('token', token);

      if (error) {
        console.error('Failed to deactivate token:', error);
        return serverError('Failed to deactivate token');
      }

      return json(200, {
        success: true,
        message: 'Token deactivated successfully'
      });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Unexpected error:', err);
    return serverError('Internal server error');
  }
});
