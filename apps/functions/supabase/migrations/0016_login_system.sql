-- Login System Schema with Fake Credentials
-- For development and testing purposes
-- UPDATED: Works with existing users table

-- ============================================
-- EXTEND EXISTING USERS TABLE
-- ============================================

-- Add login-related columns to existing users table
alter table public.users
  add column if not exists is_active boolean default true,
  add column if not exists is_verified boolean default false,
  add column if not exists is_admin boolean default false,
  add column if not exists last_login_at timestamptz,
  add column if not exists login_count integer default 0,
  add column if not exists failed_login_attempts integer default 0,
  add column if not exists locked_until timestamptz;

-- ============================================
-- USER SESSIONS
-- ============================================

create table if not exists public.user_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    
    -- Session tokens
    access_token varchar(255) unique not null,
    refresh_token varchar(255) unique not null,
    
    -- Session metadata
    device_info jsonb,
    ip_address inet,
    
    -- Expiration
    expires_at timestamptz not null,
    created_at timestamptz default now(),
    last_used_at timestamptz default now()
);

-- Indexes for user sessions
create index if not exists idx_sessions_user on public.user_sessions(user_id);
create index if not exists idx_sessions_token on public.user_sessions(access_token);
create index if not exists idx_sessions_expires on public.user_sessions(expires_at);

-- ============================================
-- LOGIN AUDIT LOG
-- ============================================

create table if not exists public.login_audit (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    
    -- Login attempt details
    email_attempted varchar(255),
    success boolean not null,
    failure_reason varchar(100),
    
    -- Request metadata
    ip_address inet,
    user_agent text,
    device_fingerprint varchar(255),
    
    -- Timestamp
    attempted_at timestamptz default now()
);

-- Indexes for audit log
create index if not exists idx_audit_user on public.login_audit(user_id);
create index if not exists idx_audit_attempted on public.login_audit(attempted_at);

-- ============================================
-- PASSWORD RESET TOKENS
-- ============================================

create table if not exists public.password_resets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    
    token varchar(255) unique not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    
    created_at timestamptz default now()
);

-- Indexes for password resets
create index if not exists idx_resets_token on public.password_resets(token);
create index if not exists idx_resets_user on public.password_resets(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on tables
alter table public.user_sessions enable row level security;
alter table public.login_audit enable row level security;
alter table public.password_resets enable row level security;

-- User sessions: users can only see their own sessions
create policy sessions_select_own on public.user_sessions
    for select using (user_id = auth.uid());

create policy sessions_delete_own on public.user_sessions
    for delete using (user_id = auth.uid());

-- Audit: users can only see their own login history
create policy audit_select_own on public.login_audit
    for select using (user_id = auth.uid());

-- Password resets: users can only see their own
create policy resets_select_own on public.password_resets
    for select using (user_id = auth.uid());

-- ============================================
-- STORED PROCEDURES FOR LOGIN
-- ============================================

-- Function to authenticate user (simplified for demo)
-- In production, use Supabase Auth

create or replace function public.authenticate_user(
    p_email varchar,
    p_password varchar
)
returns table (
    user_id uuid,
    display_name text,
    is_active boolean,
    is_verified boolean,
    is_admin boolean,
    login_success boolean,
    error_message varchar
) as $$
declare
    v_user record;
begin
    -- Find user by ID (simplified - in production, lookup by email in auth.users)
    select * into v_user
    from public.users
    where id in (
        select id from auth.users where email = p_email
    );
    
    if v_user is null then
        return query select 
            null::uuid, null::text, false, false, false, false, 'Invalid credentials'::varchar;
        return;
    end if;
    
    -- Check if account is locked
    if v_user.locked_until is not null and v_user.locked_until > now() then
        return query select 
            v_user.id, v_user.display_name, v_user.is_active, v_user.is_verified, 
            v_user.is_admin, false, ('Account locked until ' || v_user.locked_until)::varchar;
        return;
    end if;
    
    -- Check if account is active
    if not v_user.is_active then
        return query select 
            v_user.id, v_user.display_name, v_user.is_active, v_user.is_verified, 
            v_user.is_admin, false, 'Account is inactive'::varchar;
        return;
    end if;
    
    -- In production, verify password against auth.users encrypted_password
    -- For demo, we accept any password except 'wrong'
    if p_password = 'wrong' then
        update public.users 
        set failed_login_attempts = failed_login_attempts + 1,
            locked_until = case when failed_login_attempts >= 4 then now() + interval '1 hour' else locked_until end
        where id = v_user.id;
        
        return query select 
            v_user.id, v_user.display_name, v_user.is_active, v_user.is_verified, 
            v_user.is_admin, false, 'Invalid credentials'::varchar;
        return;
    end if;
    
    -- Successful login
    update public.users 
    set last_login_at = now(),
        login_count = login_count + 1,
        failed_login_attempts = 0,
        locked_until = null
    where id = v_user.id;
    
    return query select 
        v_user.id, v_user.display_name, v_user.is_active, v_user.is_verified, 
        v_user.is_admin, true, null::varchar;
end;
$$ language plpgsql security definer;

-- ============================================
-- TEST USERS SETUP INSTRUCTIONS
-- ============================================

-- NOTE: To create test users, use Supabase Auth API or Dashboard:

-- 1. Create users in auth.users (via Supabase Dashboard or API):
--    Email: admin@spotter.test, Password: Admin123!
--    Email: test1@spotter.test, Password: Test123!
--    Email: test2@spotter.test, Password: Test123!
--    Email: locked@spotter.test, Password: Test123!
--    Email: inactive@spotter.test, Password: Test123!

-- 2. Then run this SQL to set up their public.users data:

/*
-- After creating auth.users, run this to set up test data:

-- Update existing users with test data
update public.users set 
    display_name = 'Admin User',
    bio = 'Platform administrator',
    is_active = true,
    is_verified = true,
    is_admin = true
where id = (select id from auth.users where email = 'admin@spotter.test');

update public.users set 
    display_name = 'Test User 1',
    bio = 'Regular test user',
    is_active = true,
    is_verified = true
where id = (select id from auth.users where email = 'test1@spotter.test');

update public.users set 
    display_name = 'Test User 2',
    bio = 'Another test user',
    is_active = true,
    is_verified = true
where id = (select id from auth.users where email = 'test2@spotter.test');

-- Set locked user
update public.users set 
    display_name = 'Locked User',
    bio = 'Account locked for testing',
    is_active = true,
    is_verified = true,
    failed_login_attempts = 5,
    locked_until = now() + interval '1 hour'
where id = (select id from auth.users where email = 'locked@spotter.test');

-- Set inactive user
update public.users set 
    display_name = 'Inactive User',
    bio = 'Inactive account for testing',
    is_active = false,
    is_verified = true
where id = (select id from auth.users where email = 'inactive@spotter.test');
*/

-- ============================================
-- TESTING
-- ============================================

-- Test successful login (after creating auth.users and running setup above)
-- select * from public.authenticate_user('admin@spotter.test', 'Admin123!');

-- Test failed login
-- select * from public.authenticate_user('admin@spotter.test', 'wrong');

-- Test locked account
-- select * from public.authenticate_user('locked@spotter.test', 'Test123!');

-- Test inactive account
-- select * from public.authenticate_user('inactive@spotter.test', 'Test123!');
