import { useState, useCallback } from 'react';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

type ApiFn<T> = (...args: unknown[]) => Promise<T>;

/**
 * Generic API caller hook with loading/error state management.
 * Wrap any async function to get reactive loading and error tracking.
 */
export function useApi<T>(
  apiFn: ApiFn<T>,
  options: UseApiOptions<T> = {},
) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: unknown[]) => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await apiFn(...args);
        setState({ data: result, loading: false, error: null });
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        setState({ data: null, loading: false, error: message });
        options.onError?.(message);
        return null;
      }
    },
    [apiFn, options],
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}

/**
 * Fetch-with-state helper for simple GET patterns.
 */
export function useFetch<T>(url: string, options?: RequestInit) {
  return useApi(
    () => fetch(url, options).then((r) => r.json()) as Promise<T>,
  );
}
