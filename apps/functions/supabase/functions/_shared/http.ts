// _shared/http.ts
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token, x-admin-nonce, x-admin-sig',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }
  return null;
}

export function ok<T = unknown>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export function error(message: string, status = 400, code?: string): Response {
  return new Response(JSON.stringify({ error: message, code: code ?? 'error' }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export function notFound(message = 'Not found'): Response {
  return error(message, 404, 'not_found');
}

export function unauthorized(message = 'Unauthorized'): Response {
  return error(message, 401, 'unauthorized');
}

export function forbidden(message = 'Forbidden'): Response {
  return error(message, 403, 'forbidden');
}

export function serverError(message = 'Internal server error'): Response {
  return error(message, 500, 'internal_error');
}
