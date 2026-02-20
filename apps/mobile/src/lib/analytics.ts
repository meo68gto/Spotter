import { env } from '../types/env';

type Properties = Record<string, unknown>;

export const trackEvent = async (
  event: string,
  distinctId: string,
  properties: Properties = {}
): Promise<void> => {
  if (!env.posthogKey || !env.posthogHost) return;

  try {
    await fetch(`${env.posthogHost}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: env.posthogKey,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          source: 'mobile'
        }
      })
    });
  } catch {
    // Intentionally no-op for analytics failures.
  }
};
