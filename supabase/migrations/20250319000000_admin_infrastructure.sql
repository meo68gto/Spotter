-- Admin Users and Audit Infrastructure
-- Creates tables for admin users, audit logs, job runs, and user suspensions

-- Admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'admin',
    permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Admin audit logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action text NOT NULL,
    status text NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin job runs table
CREATE TABLE IF NOT EXISTS public.admin_job_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    output text,
    error text,
    triggered_by text NOT NULL CHECK (triggered_by IN ('schedule', 'manual')),
    triggered_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.admin_job_runs ENABLE ROW LEVEL SECURITY;

-- User suspensions table
CREATE TABLE IF NOT EXISTS public.user_suspensions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    suspended_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason text NOT NULL,
    suspended_at timestamptz NOT NULL DEFAULT now(),
    lifted_at timestamptz,
    lifted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

-- Error logs table (if not exists)
CREATE TABLE IF NOT EXISTS public.error_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    error_type text NOT NULL,
    message text NOT NULL,
    stack_trace text,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON public.admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_job_runs_job_id ON public.admin_job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_admin_job_runs_started_at ON public.admin_job_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_user_id ON public.user_suspensions(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);

-- RLS Policies for admin_users
CREATE POLICY admin_users_select_self ON public.admin_users
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY admin_users_select_all ON public.admin_users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
        )
    );

-- RLS Policies for admin_audit_logs
CREATE POLICY admin_audit_logs_select ON public.admin_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
        )
    );

CREATE POLICY admin_audit_logs_insert_service ON public.admin_audit_logs
    FOR INSERT WITH CHECK (true);

-- RLS Policies for admin_job_runs
CREATE POLICY admin_job_runs_select ON public.admin_job_runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
        )
    );

CREATE POLICY admin_job_runs_insert_service ON public.admin_job_runs
    FOR INSERT WITH CHECK (true);

-- RLS Policies for user_suspensions
CREATE POLICY user_suspensions_select_admin ON public.user_suspensions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
        )
    );

CREATE POLICY user_suspensions_insert_admin ON public.user_suspensions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
        )
    );

CREATE POLICY user_suspensions_delete_admin ON public.user_suspensions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
        )
    );

-- RLS Policies for error_logs
CREATE POLICY error_logs_select_admin ON public.error_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.user_id = auth.uid()
        )
    );

-- Add feature_flags updated_by foreign key if not exists
ALTER TABLE public.feature_flags
    ADD CONSTRAINT IF NOT EXISTS feature_flags_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.admin_users IS 'Table storing admin user assignments and roles';
COMMENT ON TABLE public.admin_audit_logs IS 'Audit trail for all admin actions';
COMMENT ON TABLE public.admin_job_runs IS 'History of scheduled and manual job executions';
COMMENT ON TABLE public.user_suspensions IS 'User account suspension records';
COMMENT ON TABLE public.error_logs IS 'Application error tracking for admin monitoring';