import { env } from '../types/env';

const asBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === 'true';
};

export const flags = {
  matchingV2: asBool(process.env.EXPO_PUBLIC_FLAG_MATCHING_V2, false),
  videoPipeline: asBool(process.env.EXPO_PUBLIC_FLAG_VIDEO_PIPELINE, true),
  environment: 'local'
};

export const loadFeatureFlags = async (accessToken: string): Promise<typeof flags> => {
  try {
    const response = await fetch(`${env.apiBaseUrl}/functions/v1/feature-flags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({})
    });

    const payload = await response.json();
    if (!response.ok || !payload?.data) return flags;

    flags.matchingV2 = Boolean(payload.data.matchingV2);
    flags.videoPipeline = Boolean(payload.data.videoPipeline);
    flags.environment = payload.data.environment ?? flags.environment;
    return flags;
  } catch {
    return flags;
  }
};
