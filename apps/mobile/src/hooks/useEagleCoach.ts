/**
 * useEagleCoach.ts
 * Hook for Eagle AI coaching features in Spotter mobile app.
 *
 * Provides:
 *   generateDrill()    — generate a drill via Eagle AI
 *   trackOutcome()     — log completion + improvement
 *   getUserDrills()     — fetch drill history
 *   getUserOutcomes()   — fetch outcome history
 *   getDrill()         — fetch single drill by ID
 *   getAnalytics()      — aggregate coaching stats
 */

import { useCallback, useState } from 'react';
import { invokeFunction } from '../lib/api';

export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced';

export interface VerificationScore {
  score: number;       // 0-1
  pass: boolean;
  reason: string;
}

export interface VerificationBundle {
  biomechanics: VerificationScore;
  teaching_logic: VerificationScore;
  safety: VerificationScore;
  outcome: VerificationScore;
  factual: VerificationScore;
}

export interface EagleDrill {
  id: string;
  drillId?: string;
  title: string;
  description: string;
  steps: string[];
  difficulty: PlayerLevel;
  focusAreas: string[];
  estimatedMinutes: number;
  safetyNotes: string;
  confidenceScore: number;
  passed: boolean;
  verifications: VerificationBundle;
  inputProblem?: string;
  createdAt?: string;
  playerLevel?: PlayerLevel;
}

export interface EagleOutcome {
  id: string;
  drillId: string;
  completed: boolean;
  improvementScore: number | null;
  feedback: string | null;
  createdAt: string;
}

export interface CoachingAnalytics {
  problemStats: Array<{
    problem: string;
    drillCount: number;
    avgImprovement: number | null;
    completionRate: number;
  }>;
  totalDrills: number;
  avgImprovement: number | null;
  flaggedProblems: string[]; // problems with avgImprovement < 0.4
}

export function useEagleCoach() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a golf drill for a problem
  const generateDrill = useCallback(async (
    problem: string,
    playerLevel: PlayerLevel
  ): Promise<EagleDrill | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invokeFunction<any>('eagle-ai-coach', {
        method: 'POST',
        body: { action: 'generate_drill', problem, playerLevel },
      });

      if (result?.data?.degraded) {
        setError('Eagle AI is unavailable right now. Please try again later.');
        return null;
      }

      const drillData = result?.data?.data ?? result?.data;
      if (!drillData) {
        setError('No drill data returned.');
        return null;
      }

      return normalizeDrill(drillData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Track a drill completion
  const trackOutcome = useCallback(async (
    drillId: string,
    completed: boolean,
    improvement?: number,
    feedback?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invokeFunction<any>('eagle-ai-coach', {
        method: 'POST',
        body: { action: 'track_outcome', drillId, completed, improvement, feedback },
      });
      return Boolean(result?.data?.data?.success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to log outcome';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get drill history for current user
  const getUserDrills = useCallback(async (limit = 20): Promise<EagleDrill[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invokeFunction<any>('eagle-ai-coach', {
        method: 'POST',
        body: { action: 'get_user_drills', limit },
      });
      const drills = result?.data?.data?.drills ?? [];
      return drills.map(normalizeDrill);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load drills';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get outcomes for current user
  const getUserOutcomes = useCallback(async (limit = 50): Promise<EagleOutcome[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invokeFunction<any>('eagle-ai-coach', {
        method: 'POST',
        body: { action: 'get_user_outcomes', limit },
      });
      const outcomes = result?.data?.data?.outcomes ?? [];
      return outcomes.map(normalizeOutcome);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load outcomes';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get a single drill by ID
  const getDrill = useCallback(async (drillId: string): Promise<EagleDrill | null> => {
    try {
      const result = await invokeFunction<any>('eagle-ai-coach', {
        method: 'POST',
        body: { action: 'get_drill', drillId },
      });
      const drillData = result?.data?.data?.drill ?? result?.data?.data;
      return drillData ? normalizeDrill(drillData) : null;
    } catch {
      return null;
    }
  }, []);

  // Get coaching analytics
  const getAnalytics = useCallback(async (): Promise<CoachingAnalytics | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await invokeFunction<any>('eagle-ai-coach', {
        method: 'POST',
        body: { action: 'get_analytics' },
      });
      const data = result?.data?.data ?? result?.data;
      if (!data) return null;

      const flaggedProblems = (data.problemStats ?? [])
        .filter((s: any) => s.avgImprovement !== null && s.avgImprovement < 0.4)
        .map((s: any) => s.problem);

      return {
        problemStats: data.problemStats ?? [],
        totalDrills: data.totalDrills ?? 0,
        avgImprovement: data.avgImprovement ?? null,
        flaggedProblems,
      };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generateDrill,
    trackOutcome,
    getUserDrills,
    getUserOutcomes,
    getDrill,
    getAnalytics,
    loading,
    error,
  };
}

// ---------------------------------------------------------------------------
// Normalizers (handle both MCP raw output and edge function wrapped formats)
// ---------------------------------------------------------------------------

function normalizeDrill(raw: any): EagleDrill {
  // Handle nested data from edge function wrapper
  const d = raw?.data ?? raw;

  return {
    id: d.drillId ?? d.id ?? '',
    drillId: d.drillId ?? d.id ?? '',
    title: d.title ?? d.generated_drill?.title ?? 'AI Golf Drill',
    description: d.description ?? d.generated_drill?.description ?? '',
    steps: Array.isArray(d.steps)
      ? d.steps
      : Array.isArray(d.generated_drill?.steps)
      ? d.generated_drill.steps
      : [],
    difficulty: d.difficulty ?? d.player_level ?? 'intermediate',
    focusAreas: Array.isArray(d.focusAreas) ? d.focusAreas : [],
    estimatedMinutes: d.estimatedMinutes ?? 10,
    safetyNotes: d.safetyNotes ?? '',
    confidenceScore: d.confidenceScore ?? d.confidence_score ?? 0,
    passed: d.passed ?? true,
    verifications: d.verifications ?? {
      biomechanics: { score: 0.7, pass: true, reason: '' },
      teaching_logic: { score: 0.7, pass: true, reason: '' },
      safety: { score: 0.7, pass: true, reason: '' },
      outcome: { score: 0.7, pass: true, reason: '' },
      factual: { score: 0.7, pass: true, reason: '' },
    },
    inputProblem: d.inputProblem ?? d.input_problem ?? '',
    createdAt: d.created_at ?? d.createdAt,
    playerLevel: d.playerLevel ?? d.player_level,
  };
}

function normalizeOutcome(raw: any): EagleOutcome {
  const o = raw?.data ?? raw;
  return {
    id: o.id ?? '',
    drillId: o.drillId ?? o.drill_id ?? '',
    completed: o.completed ?? false,
    improvementScore: o.improvementScore ?? o.improvement_score ?? null,
    feedback: o.feedback ?? null,
    createdAt: o.created_at ?? o.createdAt ?? new Date().toISOString(),
  };
}
