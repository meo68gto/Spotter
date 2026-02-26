// Video domain types
import type { UUID, AnalysisMetric } from './common';

export interface AnalysisResultDTO {
  provider: 'openai-vision' | 'replicate' | 'manual';
  summary: string;
  metrics: AnalysisMetric[];
  annotations?: Array<{
    tsMs: number;
    note: string;
  }>;
}

export interface VideoSubmissionDTO {
  id: UUID;
  userId: UUID;
  activityId: UUID;
  storagePath: string;
  status: 'uploaded' | 'processing' | 'analyzed' | 'failed';
  aiAnalysis?: AnalysisResultDTO;
  coachReviewId?: UUID;
  createdAt: string;
}

export interface ProgressSnapshotDTO {
  id: UUID;
  userId: UUID;
  activityId: UUID;
  snapshotDate: string;
  metrics: AnalysisMetric[];
  trendSummary: string;
  sourceSubmissionIds: UUID[];
}

export interface ProgressSeriesDTO {
  activityId: UUID;
  snapshots: ProgressSnapshotDTO[];
}

export interface VideoUploadIntentDTO {
  activityId: UUID;
  fileExt?: string;
  sessionId?: UUID;
}

export interface VideoAnalysisIngestDTO {
  videoSubmissionId: UUID;
  provider: 'openai-vision' | 'replicate' | 'manual';
  summary: string;
  metrics: AnalysisMetric[];
  annotations?: Array<{ tsMs: number; note: string }>;
}
