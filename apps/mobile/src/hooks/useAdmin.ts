// Admin Dashboard Hooks
// Handles authentication, data fetching, and operations for admin screens

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { env } from '../types/env';

// ============================================================================
// Types
// ============================================================================

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  last_sign_in_at: string | null;
}

export interface DashboardStats {
  users: {
    total: number;
    activeToday: number;
    activeThisWeek: number;
    newToday: number;
    newThisWeek: number;
  };
  sessions: {
    total: number;
    proposed: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  matches: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    expired: number;
  };
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
  errors: {
    recent: Array<{
      id: string;
      error_type: string;
      message: string;
      user_id: string | null;
      created_at: string;
    }>;
    count24h: number;
  };
  deletionRequests: {
    pending: number;
    processing: number;
    completed: number;
  };
}

export interface AdminUserDetails {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  status: 'active' | 'suspended' | 'pending_deletion';
  matches_count: number;
  sessions_count: number;
  deletion_request: {
    id: string;
    status: string;
    requested_at: string;
  } | null;
}

export interface JobDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string;
  lastRun: string | null;
  lastStatus: 'success' | 'failed' | 'running' | null;
  nextRun: string | null;
  enabled: boolean;
  runCount?: number;
}

export interface JobRun {
  id: string;
  job_id: string;
  status: 'running' | 'success' | 'failed';
  output: string | null;
  error: string | null;
  triggered_by: 'schedule' | 'manual';
  triggered_by_user_id: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface FeatureFlag {
  id: string;
  key: string;
  environment: string;
  value: boolean;
  payload: Record<string, unknown>;
  updated_by: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
  usage_stats?: {
    enabled_count: number;
    total_requests: number;
    last_7d_requests: number;
  };
}

export interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  status: 'SUCCESS' | 'FAILED';
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// useAdminAuth - Admin authentication
// ============================================================================

interface UseAdminAuthReturn {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  adminUser: AdminUser | null;
  permissions: string[];
  checkAdminStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAdminAuth(): UseAdminAuthReturn {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const checkAdminStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        setAdminUser(null);
        return;
      }

      // Check admin status via edge function
      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-auth`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setIsAdmin(false);
        setAdminUser(null);
        setError(result.error || 'Admin verification failed');
        return;
      }

      setIsAdmin(true);
      setAdminUser(result.data);
      setPermissions(result.permissions || []);
    } catch (err) {
      setIsAdmin(false);
      setAdminUser(null);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setAdminUser(null);
    setPermissions([]);
  }, []);

  return {
    isAdmin,
    isLoading,
    error,
    adminUser,
    permissions,
    checkAdminStatus,
    logout,
  };
}

// ============================================================================
// useAdminDashboard - Dashboard statistics
// ============================================================================

interface UseAdminDashboardReturn {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAdminDashboard(): UseAdminDashboardReturn {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch dashboard stats');
      }

      setStats(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refresh: fetchStats,
  };
}

// ============================================================================
// useAdminUsers - User management
// ============================================================================

interface UserSearchFilters {
  query?: string;
  status?: 'active' | 'suspended' | 'pending_deletion' | 'all';
  createdAfter?: string;
  createdBefore?: string;
}

interface UseAdminUsersReturn {
  users: AdminUserDetails[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  searchUsers: (filters: UserSearchFilters, limit?: number, offset?: number) => Promise<void>;
  getUserDetails: (userId: string) => Promise<AdminUserDetails | null>;
  suspendUser: (userId: string, reason?: string) => Promise<void>;
  activateUser: (userId: string) => Promise<void>;
  processDeletion: (userId: string) => Promise<void>;
}

export function useAdminUsers(): UseAdminUsersReturn {
  const [users, setUsers] = useState<AdminUserDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const searchUsers = useCallback(async (
    filters: UserSearchFilters,
    limit: number = 50,
    offset: number = 0
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.createdAfter) params.append('createdAfter', filters.createdAfter);
      if (filters.createdBefore) params.append('createdBefore', filters.createdBefore);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const response = await fetch(
        `${env.apiBaseUrl}/functions/v1/admin-users/search?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to search users');
      }

      setUsers(result.data);
      setTotalCount(result.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getUserDetails = useCallback(async (userId: string): Promise<AdminUserDetails | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${env.apiBaseUrl}/functions/v1/admin-users/${userId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get user details');
      }

      return result.data;
    } catch (err) {
      console.error('Get user details error:', err);
      return null;
    }
  }, []);

  const suspendUser = useCallback(async (userId: string, reason?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'suspend', userId, reason }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to suspend user');
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  }, []);

  const activateUser = useCallback(async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'activate', userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to activate user');
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  }, []);

  const processDeletion = useCallback(async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'process_deletion', userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process deletion');
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  }, []);

  return {
    users,
    isLoading,
    error,
    totalCount,
    searchUsers,
    getUserDetails,
    suspendUser,
    activateUser,
    processDeletion,
  };
}

// ============================================================================
// useAdminJobs - Job management
// ============================================================================

interface UseAdminJobsReturn {
  jobs: JobDefinition[];
  jobRuns: JobRun[];
  isLoading: boolean;
  error: string | null;
  refreshJobs: () => Promise<void>;
  refreshJobRuns: (jobId?: string) => Promise<void>;
  triggerJob: (jobId: string) => Promise<void>;
}

export function useAdminJobs(): UseAdminJobsReturn {
  const [jobs, setJobs] = useState<JobDefinition[]>([]);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-jobs/jobs`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch jobs');
      }

      setJobs(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshJobRuns = useCallback(async (jobId?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (jobId) params.append('jobId', jobId);
      params.append('limit', '50');

      const response = await fetch(
        `${env.apiBaseUrl}/functions/v1/admin-jobs/logs?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch job logs');
      }

      setJobRuns(result.data);
    } catch (err) {
      console.error('Fetch job runs error:', err);
    }
  }, []);

  const triggerJob = useCallback(async (jobId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'trigger', jobId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to trigger job');
      }

      // Refresh jobs after triggering
      await refreshJobs();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  }, [refreshJobs]);

  return {
    jobs,
    jobRuns,
    isLoading,
    error,
    refreshJobs,
    refreshJobRuns,
    triggerJob,
  };
}

// ============================================================================
// useAdminFeatureFlags - Feature flag management
// ============================================================================

interface UseAdminFeatureFlagsReturn {
  flags: FeatureFlag[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createFlag: (input: { key: string; environment: string; value: boolean; payload?: Record<string, unknown> }) => Promise<void>;
  updateFlag: (flagId: string, updates: { value?: boolean; payload?: Record<string, unknown> }) => Promise<void>;
  deleteFlag: (flagId: string) => Promise<void>;
  toggleFlag: (flagId: string, currentValue: boolean) => Promise<void>;
}

export function useAdminFeatureFlags(): UseAdminFeatureFlagsReturn {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-feature-flags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch feature flags');
      }

      setFlags(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createFlag = useCallback(async (input: {
    key: string;
    environment: string;
    value: boolean;
    payload?: Record<string, unknown>;
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-feature-flags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create flag');
      }

      await refresh();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  }, [refresh]);

  const updateFlag = useCallback(async (
    flagId: string,
    updates: { value?: boolean; payload?: Record<string, unknown> }
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-feature-flags/${flagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update flag');
      }

      await refresh();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  }, [refresh]);

  const deleteFlag = useCallback(async (flagId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/admin-feature-flags/${flagId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete flag');
      }

      await refresh();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  }, [refresh]);

  const toggleFlag = useCallback(async (flagId: string, currentValue: boolean) => {
    await updateFlag(flagId, { value: !currentValue });
  }, [updateFlag]);

  return {
    flags,
    isLoading,
    error,
    refresh,
    createFlag,
    updateFlag,
    deleteFlag,
    toggleFlag,
  };
}