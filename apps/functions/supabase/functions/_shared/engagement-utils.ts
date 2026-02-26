// _shared/engagement-utils.ts
// Re-exports from engagements.ts for backwards compatibility.
// This file has been consolidated into engagements.ts — import from there directly.
export {
  formatPublicEngagement,
  isWithinResponseWindow,
  isEngagementExpired,
  isExpert,
  isRequester,
} from './engagements.ts';
