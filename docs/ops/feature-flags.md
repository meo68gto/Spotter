# Feature Flags

## Mobile flags
- `EXPO_PUBLIC_FLAG_MATCHING_V2`
  - `false`: radius default 25km
  - `true`: radius default 35km and score emphasis
- `EXPO_PUBLIC_FLAG_VIDEO_PIPELINE`
  - `true`: enables `videos-presign`
  - `false`: returns `feature_disabled`

## Functions flags
- `FLAG_MATCHING_V2`
- `FLAG_VIDEO_PIPELINE`

Keep production defaults conservative and roll out by staging verification.
