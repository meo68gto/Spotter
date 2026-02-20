export const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*'
    }
  });

export const badRequest = (message: string, code = 'bad_request'): Response =>
  json(400, { error: message, code });

export const unauthorized = (message = 'Unauthorized', code = 'unauthorized'): Response =>
  json(401, { error: message, code });

export const forbidden = (message = 'Forbidden', code = 'forbidden'): Response =>
  json(403, { error: message, code });

export const tooMany = (message = 'Too many requests', code = 'rate_limited'): Response =>
  json(429, { error: message, code });

export const serverError = (message = 'Internal server error', code = 'internal_error'): Response =>
  json(500, { error: message, code });
