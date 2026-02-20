import { env } from '../types/env';
import { supabase } from './supabase';

export type ApiError = {
  error: string;
  code: string;
  details?: Record<string, unknown>;
};

export const invokeFunction = async <T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
  }
): Promise<T> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) {
    throw new Error('Session missing. Please sign in again.');
  }

  const response = await fetch(`${env.apiBaseUrl}/functions/v1/${path}`, {
    method: options?.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: options?.body ? JSON.stringify(options.body) : undefined
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: string;
    code?: string;
    details?: Record<string, unknown>;
  };

  if (!response.ok) {
    const err: ApiError = {
      error: payload.error ?? 'Request failed',
      code: payload.code ?? 'request_failed',
      details: payload.details
    };
    const message = `${err.error} (${err.code})`;
    throw new Error(message);
  }

  return payload.data as T;
};
