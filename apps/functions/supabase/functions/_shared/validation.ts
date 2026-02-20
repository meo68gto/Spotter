export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const hasRequiredOnboardingFields = (value: {
  activityId?: unknown;
  sourceScale?: unknown;
  skillBand?: unknown;
}): boolean =>
  isNonEmptyString(value.activityId) &&
  isNonEmptyString(value.sourceScale) &&
  isNonEmptyString(value.skillBand);

export const hasRequiredSessionFields = (value: {
  matchId?: unknown;
  partnerUserId?: unknown;
  proposedStartTime?: unknown;
}): boolean =>
  isNonEmptyString(value.matchId) &&
  isNonEmptyString(value.partnerUserId) &&
  isNonEmptyString(value.proposedStartTime);
