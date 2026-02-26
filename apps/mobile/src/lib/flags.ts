import { env } from '../types/env';

const asBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === 'true';
};

// S-6: Flag env vars are now read from the consolidated env object
export type FeatureFlags = {
  matchingV2: boolean;
  videoPipeline: boolean;
  engagementAsyncAnswers: boolean;
  engagementGuestCheckout: boolean;
  engagementPublicFeed: boolean;
  engagementVideoCallDaily: boolean;
  environment: string;
};

// Default flags — read from env at module load time
export const flags: FeatureFlags = {
  matchingV2: asBool(env.flagMatchingV2, false),
  videoPipeline: asBool(env.flagVideoPipeline, true),
  engagementAsyncAnswers: asBool(env.flagEngagementAsyncAnswers, true),
  engagementGuestCheckout: asBool(env.flagEngagementGuestCheckout, true),
  engagementPublicFeed: asBool(env.flagEngagementPublicFeed, true),
  engagementVideoCallDaily: asBool(env.flagEngagementVideoCallDaily, true),
  environment: 'local'
};

// C-8: Returns a new FeatureFlags object instead of mutating the shared singleton
export const loadFeatureFlags = async (accessToken: string): Promise<FeatureFlags> => {
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
    if (!response.ok || !payload?.data) return { ...flags };

    // S-6: Return a new object — never mutate the exported singleton
    return {
      matchingV2: Boolean(payload.data.matchingV2),
      videoPipeline: Boolean(payload.data.videoPipeline),
      engagementAsyncAnswers: Boolean(payload.data.engagementAsyncAnswers),
      engagementGuestCheckout: Boolean(payload.data.engagementGuestCheckout),
      engagementPublicFeed: Boolean(payload.data.engagementPublicFeed),
      engagementVideoCallDaily: Boolean(payload.data.engagementVideoCallDaily),
      environment: payload.data.environment ?? flags.environment
    };
  } catch {
    return { ...flags };
  }
};
