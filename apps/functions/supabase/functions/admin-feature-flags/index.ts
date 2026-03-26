import { badRequest, json } from '../_shared/http.ts';
import { logAdminAction, requireAdmin } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const service = admin.service;
  const url = new URL(req.url);
  const method = req.method;
  const pathname = url.pathname;

  if (method === 'GET' && !pathname.match(/\/admin-feature-flags\/[^/]+$/)) {
    const { data: rows, error } = await service
      .from('feature_flags')
      .select('id,key,environment,value,payload,updated_by,updated_by_email,created_at,updated_at')
      .order('key', { ascending: true });

    if (error) return json(500, { error: error.message, code: 'flags_list_failed' });
    return json(200, { data: rows ?? [] });
  }

  const idMatch = pathname.match(/\/admin-feature-flags\/([^/]+)$/);
  if (idMatch) {
    const flagId = idMatch[1];

    if (method === 'PATCH') {
      let body: { value?: boolean; payload?: Record<string, unknown> };
      try {
        body = await req.json();
      } catch {
        return badRequest('Invalid JSON body', 'invalid_json');
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: admin.user.id };
      if (typeof body.value === 'boolean') updates.value = body.value;
      if (body.payload !== undefined) updates.payload = body.payload;

      const { data, error } = await service.from('feature_flags').update(updates).eq('id', flagId).select().single();
      if (error) {
        await logAdminAction(admin, req, 'feature_flag_update', 'FAILED', { flagId, error: error.message });
        return json(500, { error: error.message, code: 'flag_update_failed' });
      }

      await logAdminAction(admin, req, 'feature_flag_update', 'SUCCESS', { flagId });
      return json(200, { data });
    }

    if (method === 'DELETE') {
      const { error } = await service.from('feature_flags').delete().eq('id', flagId);
      if (error) {
        await logAdminAction(admin, req, 'feature_flag_delete', 'FAILED', { flagId, error: error.message });
        return json(500, { error: error.message, code: 'flag_delete_failed' });
      }
      await logAdminAction(admin, req, 'feature_flag_delete', 'SUCCESS', { flagId });
      return json(200, { success: true });
    }
  }

  if (method === 'POST') {
    let body: { key?: string; environment?: string; value?: boolean; payload?: Record<string, unknown> };
    try {
      body = await req.json();
    } catch {
      return badRequest('Invalid JSON body', 'invalid_json');
    }

    if (!body.key) return badRequest('key is required', 'missing_key');
    const { data, error } = await service
      .from('feature_flags')
      .insert({
        key: body.key,
        environment: body.environment ?? 'production',
        value: body.value ?? false,
        payload: body.payload ?? {},
        updated_by: admin.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      await logAdminAction(admin, req, 'feature_flag_create', 'FAILED', { key: body.key, error: error.message });
      return json(500, { error: error.message, code: 'flag_create_failed' });
    }

    await logAdminAction(admin, req, 'feature_flag_create', 'SUCCESS', { key: body.key });
    return json(201, { data });
  }

  return badRequest('Method not allowed', 'method_not_allowed');
});
