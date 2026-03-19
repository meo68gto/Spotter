-- Error Logging and Performance Monitoring Migration
-- Creates tables for tracking errors and query performance

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create error_logs table for tracking function errors
CREATE TABLE IF NOT EXISTS public.error_logs (
  id TEXT PRIMARY KEY,
  function_name TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('fatal', 'error', 'warning', 'info')),
  environment TEXT NOT NULL DEFAULT 'production',
  extra JSONB DEFAULT '{}',
  tags JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT
);

-- 2. Create query_performance_logs table for slow query tracking
CREATE TABLE IF NOT EXISTS public.query_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT,
  query_text TEXT,
  function_name TEXT,
  duration_ms INTEGER NOT NULL,
  rows_affected INTEGER,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create function_health_checks table for storing health check results
CREATE TABLE IF NOT EXISTS public.function_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  response_time_ms INTEGER,
  details JSONB DEFAULT '{}',
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_logs_function ON public.error_logs(function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON public.error_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON public.error_logs(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_perf_function ON public.query_performance_logs(function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_perf_duration ON public.query_performance_logs(duration_ms DESC) WHERE duration_ms > 1000;
CREATE INDEX IF NOT EXISTS idx_query_perf_created_at ON public.query_performance_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_checks_function ON public.function_health_checks(function_name, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON public.function_health_checks(status, checked_at DESC);

-- 5. Enable RLS on new tables
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.function_health_checks ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
-- Only admins can view error logs (using a simple check that only matches never)
-- In production, this would check for an admin role
CREATE POLICY error_logs_select_admin ON public.error_logs
  FOR SELECT USING (false);

CREATE POLICY error_logs_insert_system ON public.error_logs
  FOR INSERT WITH CHECK (true); -- Allow system inserts

CREATE POLICY error_logs_update_admin ON public.error_logs
  FOR UPDATE USING (false) WITH CHECK (false);

-- Query performance logs - similar restrictions
CREATE POLICY query_perf_select_admin ON public.query_performance_logs
  FOR SELECT USING (false);

CREATE POLICY query_perf_insert_system ON public.query_performance_logs
  FOR INSERT WITH CHECK (true);

-- Health checks - readable by all, insert by system
CREATE POLICY health_checks_select_all ON public.function_health_checks
  FOR SELECT USING (true);

CREATE POLICY health_checks_insert_system ON public.function_health_checks
  FOR INSERT WITH CHECK (true);

-- 7. Create helper function to get slow queries
CREATE OR REPLACE FUNCTION public.get_slow_queries(threshold_ms INTEGER DEFAULT 1000)
RETURNS TABLE (
  query_hash TEXT,
  avg_duration_ms NUMERIC,
  max_duration_ms INTEGER,
  call_count BIGINT,
  last_called TIMESTAMPTZ
) LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    query_hash,
    AVG(duration_ms)::NUMERIC as avg_duration_ms,
    MAX(duration_ms) as max_duration_ms,
    COUNT(*) as call_count,
    MAX(created_at) as last_called
  FROM public.query_performance_logs
  WHERE duration_ms >= threshold_ms
    AND created_at > NOW() - INTERVAL '24 hours'
  GROUP BY query_hash
  ORDER BY avg_duration_ms DESC
  LIMIT 20;
$$;

-- 8. Create helper function to get error summary
CREATE OR REPLACE FUNCTION public.get_error_summary(hours INTEGER DEFAULT 24)
RETURNS TABLE (
  function_name TEXT,
  error_count BIGINT,
  fatal_count BIGINT,
  warning_count BIGINT,
  last_error_at TIMESTAMPTZ
) LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    error_logs.function_name,
    COUNT(*) as error_count,
    COUNT(*) FILTER (WHERE severity = 'fatal') as fatal_count,
    COUNT(*) FILTER (WHERE severity = 'warning') as warning_count,
    MAX(created_at) as last_error_at
  FROM public.error_logs
  WHERE created_at > NOW() - (hours || ' hours')::INTERVAL
    AND resolved_at IS NULL
  GROUP BY error_logs.function_name
  ORDER BY error_count DESC;
$$;

-- 9. Create helper function to log query performance
CREATE OR REPLACE FUNCTION public.log_slow_query(
  p_query_hash TEXT,
  p_query_text TEXT,
  p_function_name TEXT,
  p_duration_ms INTEGER,
  p_rows_affected INTEGER DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.query_performance_logs (
    query_hash, query_text, function_name, duration_ms, rows_affected, user_id
  ) VALUES (
    p_query_hash, p_query_text, p_function_name, p_duration_ms, p_rows_affected, p_user_id
  );
END;
$$;

-- 10. Add realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.error_logs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.query_performance_logs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.function_health_checks;
  END IF;
END $$;

-- ============================================
-- DOWN MIGRATION
-- ============================================
/*
-- Remove realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.error_logs;
    ALTER PUBLICATION supabase_realtime DROP TABLE public.query_performance_logs;
    ALTER PUBLICATION supabase_realtime DROP TABLE public.function_health_checks;
  END IF;
END $$;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_slow_queries(INTEGER);
DROP FUNCTION IF EXISTS public.get_error_summary(INTEGER);
DROP FUNCTION IF EXISTS public.log_slow_query(TEXT, TEXT, TEXT, INTEGER, INTEGER, UUID);

-- Drop policies
DROP POLICY IF EXISTS error_logs_select_admin ON public.error_logs;
DROP POLICY IF EXISTS error_logs_insert_system ON public.error_logs;
DROP POLICY IF EXISTS error_logs_update_admin ON public.error_logs;
DROP POLICY IF EXISTS query_perf_select_admin ON public.query_performance_logs;
DROP POLICY IF EXISTS query_perf_insert_system ON public.query_performance_logs;
DROP POLICY IF EXISTS health_checks_select_all ON public.function_health_checks;
DROP POLICY IF EXISTS health_checks_insert_system ON public.function_health_checks;

-- Disable RLS
ALTER TABLE public.error_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_performance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.function_health_checks DISABLE ROW LEVEL SECURITY;

-- Drop indexes
DROP INDEX IF EXISTS idx_error_logs_function;
DROP INDEX IF EXISTS idx_error_logs_user;
DROP INDEX IF EXISTS idx_error_logs_severity;
DROP INDEX IF EXISTS idx_error_logs_unresolved;
DROP INDEX IF EXISTS idx_error_logs_created_at;
DROP INDEX IF EXISTS idx_query_perf_function;
DROP INDEX IF EXISTS idx_query_perf_duration;
DROP INDEX IF EXISTS idx_query_perf_created_at;
DROP INDEX IF EXISTS idx_health_checks_function;
DROP INDEX IF EXISTS idx_health_checks_status;

-- Drop tables
DROP TABLE IF EXISTS public.function_health_checks;
DROP TABLE IF EXISTS public.query_performance_logs;
DROP TABLE IF EXISTS public.error_logs;
*/
