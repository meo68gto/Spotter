export const flags = {
  matchingV2: (Deno.env.get('FLAG_MATCHING_V2') ?? 'false') === 'true',
  videoPipeline: (Deno.env.get('FLAG_VIDEO_PIPELINE') ?? 'true') === 'true'
};
