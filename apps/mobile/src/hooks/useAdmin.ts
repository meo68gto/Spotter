// Admin Dashboard Hooks
// Handles authentication, data fetching, and operations for admin screens

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/api';

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
      const payload = await invokeFunction<{
        data: AdminUser;
        permissions: string[];
      }>('admin-auth', { method: 'GET' });

      setIsAdmin(true);
      setAdminUser(payload.data);
      setPermissions(payload.permissions ?? []);
    } catch (err) {
      setIsAdmin(false);
      setAdminUser(null);
      setError(err instanceof Error ? err.message : 'Admin verification failed');
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
      const payload = await invokeFunction<{ data: DashboardStats }>('admin-dashboard', { method: 'GET' });
      setStats(payload.data);
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
      const params: Record<string, string> = {
        limit: String(limit),
        offset: String(offset),
      };
      if (filters.query) params.query = filters.query;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.createdAfter) params.createdAfter = filters.createdAfter;
      if (filters.createdBefore) params.createdBefore = filters.createdBefore;

      const payload = await invokeFunction<{
        data: AdminUserDetails[];
        pagination?: { total: number };
      }>('admin-users/search', { method: 'GET', params });

      setUsers(payload.data ?? []);
      setTotalCount(payload.pagination?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getUserDetails = useCallback(async (userId: string): Promise<AdminUserDetails | null> => {
    try {
      const payload = await invokeFunction<{ data: AdminUserDetails }>(`admin-users/${userId}`, { method: 'GET' });
      return payload.data ?? null;
    } catch (err) {
      console.error('Get user details error:', err);
      return null;
    }
  }, []);

  const suspendUser = useCallback(async (userId: string, reason?: string) => {
    const payload = await invokeFunction<{ success: boolean }>('admin-users', {
      method: 'POST',
      body: { action: 'suspend', userId, reason }
    });
    if (!payload.success) throw new Error('Suspend failed');
  }, []);

  const activateUser = useCallback(async (userId: string) => {
    const payload = await invokeFunction<{ success: boolean }>('admin-users', {
      method: 'POST',
      body: { action: 'activate', userId }
    });
    if (!payload.success) throw new Error('Activate failed');
  }, []);

  const processDeletion = useCallback(async (userId: string) => {
    const payload = await invokeFunction<{ success: boolean }>('admin-users', {
      method: 'POST',
      body: { action: 'process_deletion', userId }
    });
    if (!payload.success) throw new Error('Process deletion failed');
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
      const payload = await invokeFunction<{ data: JobDefinition[] }>('admin-jobs/jobs', { method: 'GET' });
      setJobs(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshJobRuns = useCallback(async (jobId?: string) => {
    try {
      const params: Record<string, string> = { limit: '50' };
      if (jobId) params.jobId = jobId;
      const payload = await invokeFunction<{ data: JobRun[] }>('admin-jobs/logs', { method: 'GET', params });
      setJobRuns(payload.data ?? []);
    } catch (err) {
      console.error('Fetch job runs error:', err);
    }
  }, []);

  const triggerJob = useCallback(async (jobId: string) => {
    await invokeFunction('admin-jobs', {
      method: 'POST',
      body: { action: 'trigger', jobId }
    });
    await refreshJobs();
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
      const payload = await invokeFunction<{ data: FeatureFlag[] }>('admin-feature-flags', { method: 'GET' });
      setFlags(payload.data ?? []);
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
    await invokeFunction('admin-feature-flags', { method: 'POST', body: input });
    await refresh();
  }, [refresh]);

  const updateFlag = useCallback(async (
    flagId: string,
    updates: { value?: boolean; payload?: Record<string, unknown> }
  ) => {
    await invokeFunction(`admin-feature-flags/${flagId}`, { method: 'PATCH', body: updates });
    await refresh();
  }, [refresh]);

  const deleteFlag = useCallback(async (flagId: string) => {
    await invokeFunction(`admin-feature-flags/${flagId}`, { method: 'DELETE' });
    await refresh();
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