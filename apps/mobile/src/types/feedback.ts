// M-22: Shared FeedbackSummary type — imported by both MatchesScreen and ProfileScreen
export type FeedbackSummary = {
  userId: string;
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  positiveRatio: number;
  topTags: string[];
};
