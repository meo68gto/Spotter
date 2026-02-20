import { getRuntimeEnv } from './env.ts';

type EventProps = Record<string, unknown>;

export const trackServerEvent = async (
  event: string,
  distinctId: string,
  properties: EventProps = {}
): Promise<void> => {
  const env = getRuntimeEnv();
  if (!env.posthogKey || !env.posthogHost) return;

  try {
    await fetch(`${env.posthogHost}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.posthogKey,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          source: 'functions',
          timestamp: new Date().toISOString()
        }
      })
    });
  } catch {
    // Non-blocking telemetry
  }
};
