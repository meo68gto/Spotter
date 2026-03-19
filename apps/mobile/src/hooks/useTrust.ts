// Epic 6: Trust and Reputation Hooks
// Handles vouching, reliability data, and incident reporting

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { 
  TrustBadge, 
  ReliabilityBreakdown, 
  Vouch,
  IncidentSeverity,
  IncidentCategory 
} from '@spotter/types';

// ============================================================================
// Types
// ============================================================================

interface UseTrustOptions {
  userId?: string;
  enabled?: boolean;
}

interface UseTrustReturn {
  reliability: ReliabilityBreakdown | null;
  badges: TrustBadge[];
  vouches: Vouch[];
  vouchesReceived: number;
  canVouch: boolean;
  sharedRoundsCount: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseVouchReturn {
  vouch: (vouchedUserId: string, notes?: string) => Promise<void>;
  revokeVouch: (vouchId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

interface UseReportIncidentReturn {
  report: (data: {
    reportedUserId: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    description: string;
    roundId?: string;
  }) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

// ============================================================================
// useTrust - Get trust data for a user
// ============================================================================

export function useTrust({ userId, enabled = true }: UseTrustOptions = {}): UseTrustReturn {
  const [reliability, setReliability] = useState<ReliabilityBreakdown | null>(null);
  const [badges, setBadges] = useState<TrustBadge[]>([]);
  const [vouches, setVouches] = useState<Vouch[]>([]);
  const [vouchesReceived, setVouchesReceived] = useState(0);
  const [canVouch, setCanVouch] = useState(false);
  const [sharedRoundsCount, setSharedRoundsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrustData = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Fetch reliability data from edge function
      // Contract: GET /trust-reliability/:userId (path-based, not query param)
      const { data: reliabilityData, error: reliabilityError } = await supabase.functions.invoke(
        `trust-reliability/${userId}`,
        { method: 'GET' }
      );

      if (reliabilityError) throw reliabilityError;
      setReliability(reliabilityData?.data || null);

      // Fetch trust badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('trust_badges')
        .select('*')
        .eq('user_id', userId)
        .eq('is_visible', true)
        .order('awarded_at', { ascending: false });

      if (badgesError) throw badgesError;
      setBadges(badgesData || []);

      // Fetch vouches count
      const { count: vouchCount, error: vouchCountError } = await supabase
        .from('vouches')
        .select('*', { count: 'exact', head: true })
        .eq('vouched_user_id', userId)
        .eq('status', 'active');

      if (vouchCountError) throw vouchCountError;
      setVouchesReceived(vouchCount || 0);

      // Get current user to check if they can vouch
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser && currentUser.id !== userId) {
        // Check shared rounds count
        const { data: sharedRounds, error: sharedError } = await supabase.rpc(
          'get_shared_rounds_count',
          { p_user_id: currentUser.id, p_other_user_id: userId }
        );

        if (!sharedError && sharedRounds !== null) {
          setSharedRoundsCount(sharedRounds);
          setCanVouch(sharedRounds >= 3); // Need 3+ shared rounds to vouch
        }

        // Check if already vouched
        const { data: existingVouch } = await supabase
          .from('vouches')
          .select('id')
          .eq('voucher_id', currentUser.id)
          .eq('vouched_user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (existingVouch) {
          setCanVouch(false); // Already vouched
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch trust data'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (enabled && userId) {
      fetchTrustData();
    }
  }, [enabled, userId, fetchTrustData]);

  return {
    reliability,
    badges,
    vouches,
    vouchesReceived,
    canVouch,
    sharedRoundsCount,
    isLoading,
    error,
    refetch: fetchTrustData,
  };
}

// ============================================================================
// useVouch - Create and manage vouches
// ============================================================================

export function useVouch(): UseVouchReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const vouch = useCallback(async (vouchedUserId: string, notes?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: vouchError } = await supabase.functions.invoke('trust-vouch', {
        body: { 
          vouchedId: vouchedUserId,  // Contract: backend expects 'vouchedId'
          notes 
        },
      });

      if (vouchError) throw vouchError;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create vouch'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revokeVouch = useCallback(async (vouchId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: revokeError } = await supabase.functions.invoke('trust-vouch', {
        body: { 
          action: 'revoke',
          vouchId 
        },
      });

      if (revokeError) throw revokeError;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to revoke vouch'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    vouch,
    revokeVouch,
    isLoading,
    error,
  };
}

// ============================================================================
// useReportIncident - Report incidents
// ============================================================================

export function useReportIncident(): UseReportIncidentReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const report = useCallback(async ({
    reportedUserId,
    severity,
    category,
    description,
    roundId,
  }: {
    reportedUserId: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    description: string;
    roundId?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: reportError } = await supabase.functions.invoke('trust-report-incident', {
        body: {
          reportedId: reportedUserId,  // Contract: backend expects 'reportedId'
          severity,
          category,
          description,
          roundId,
        },
      });

      if (reportError) throw reportError;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to submit report'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    report,
    isLoading,
    error,
  };
}

// ============================================================================
// usePostRoundRating - Submit ratings after rounds
// ============================================================================

interface RatingInput {
  rateeId: string;
  punctuality: number;
  golfEtiquette: number;
  enjoyment: number;
  businessValue?: number;
  playAgain: boolean;
  wouldIntroduce: boolean;
  privateNote?: string;
  publicCompliment?: string;
}

interface UsePostRoundRatingReturn {
  submitRatings: (roundId: string, ratings: RatingInput[]) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function usePostRoundRating(): UsePostRoundRatingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submitRatings = useCallback(async (roundId: string, ratings: RatingInput[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: submitError } = await supabase.functions.invoke('rounds-rate', {
        body: {
          roundId,
          ratings,
        },
      });

      if (submitError) throw submitError;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to submit ratings'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    submitRatings,
    isLoading,
    error,
  };
}

// ============================================================================
// useTrustFilter - Filter and sort by trust metrics
// ============================================================================

export type TrustFilterLevel = 'all' | 'building' | 'reliable' | 'trusted' | 'exceptional';
export type TrustSortOption = 'relevance' | 'reliability' | 'vouches' | 'rounds';

interface UseTrustFilterReturn {
  filterLevel: TrustFilterLevel;
  setFilterLevel: (level: TrustFilterLevel) => void;
  sortBy: TrustSortOption;
  setSortBy: (option: TrustSortOption) => void;
  matchesFilter: (reliabilityLabel?: string) => boolean;
  getSortValue: (a: any, b: any) => number;
}

export function useTrustFilter(): UseTrustFilterReturn {
  const [filterLevel, setFilterLevel] = useState<TrustFilterLevel>('all');
  const [sortBy, setSortBy] = useState<TrustSortOption>('relevance');

  const matchesFilter = useCallback((reliabilityLabel?: string): boolean => {
    if (filterLevel === 'all') return true;
    return reliabilityLabel?.toLowerCase() === filterLevel;
  }, [filterLevel]);

  const getSortValue = useCallback((a: any, b: any): number => {
    switch (sortBy) {
      case 'reliability':
        return (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
      case 'vouches':
        return (b.vouchesReceived || 0) - (a.vouchesReceived || 0);
      case 'rounds':
        return (b.roundsCompleted || 0) - (a.roundsCompleted || 0);
      case 'relevance':
      default:
        return (b.overallScore || 0) - (a.overallScore || 0);
    }
  }, [sortBy]);

  return {
    filterLevel,
    setFilterLevel,
    sortBy,
    setSortBy,
    matchesFilter,
    getSortValue,
  };
}
