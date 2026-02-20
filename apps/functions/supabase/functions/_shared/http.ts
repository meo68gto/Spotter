export const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*'
    }
  });

export const errorResponse = (
  status: number,
  message: string,
  code: string,
  details?: Record<string, unknown>
): Response => json(status, details ? { error: message, code, details } : { error: message, code });

export const badRequest = (message: string, code = 'bad_request', details?: Record<string, unknown>): Response =>
  errorResponse(400, message, code, details);

export const unauthorized = (
  message = 'Unauthorized',
  code = 'unauthorized',
  details?: Record<string, unknown>
): Response => errorResponse(401, message, code, details);

export const forbidden = (message = 'Forbidden', code = 'forbidden', details?: Record<string, unknown>): Response =>
  errorResponse(403, message, code, details);

export const tooMany = (message = 'Too many requests', code = 'rate_limited', details?: Record<string, unknown>): Response =>
  errorResponse(429, message, code, details);

export const serverError = (
  message = 'Internal server error',
  code = 'internal_error',
  details?: Record<string, unknown>
): Response => errorResponse(500, message, code, details);
