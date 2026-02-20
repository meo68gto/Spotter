const asBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === 'true';
};

export const flags = {
  matchingV2: asBool(process.env.EXPO_PUBLIC_FLAG_MATCHING_V2, false),
  videoPipeline: asBool(process.env.EXPO_PUBLIC_FLAG_VIDEO_PIPELINE, true)
};
