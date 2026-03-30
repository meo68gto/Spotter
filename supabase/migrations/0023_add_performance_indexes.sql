-- Migration: 0023_add_performance_indexes.sql
-- Purpose: Add composite indexes for high-frequency query patterns identified in index audit.
-- Created: 2026-03-29

-- =============================================================================
-- MATCHES table indexes
-- Query pattern: WHERE requester_user_id = X AND status = Y
-- =============================================================================
create index if not exists idx_matches_requester_status
  on public.matches(requester_user_id, status)
  where status in ('pending', 'accepted', 'rejected');

create index if not exists idx_matches_candidate_status
  on public.matches(candidate_user_id, status)
  where status in ('pending', 'accepted', 'rejected');

-- Unique pair check (pending/accepted only)
create index if not exists idx_matches_pair
  on public.matches(requester_user_id, candidate_user_id)
  where status in ('pending', 'accepted');

-- =============================================================================
-- ORGANIZER_MEMBERS table indexes
-- =============================================================================
-- Active members lookup per organizer
create index if not exists idx_organizer_members_active
  on public.organizer_members(organizer_id)
  where is_active = true;

-- User's active org memberships
create index if not exists idx_organizer_members_user_active
  on public.organizer_members(user_id)
  where is_active = true;

-- Role-based active member query
create index if not exists idx_organizer_members_role_active
  on public.organizer_members(organizer_id, role)
  where is_active = true;

-- =============================================================================
-- USERS table — discovery / EPIC 7 visibility indexes
-- =============================================================================
-- Tier + visibility filter (core discovery scan)
create index if not exists idx_users_tier_visibility
  on public.users(tier_id, profile_visibility)
  where deleted_at is null;

-- Visibility + hunt mode (discovery with hunt enabled)
create index if not exists idx_users_visibility_hunt
  on public.users(profile_visibility, hunt_mode_enabled)
  where deleted_at is null;

-- Full discovery scan (covers discover_golfers() common path)
create index if not exists idx_users_discovery_scan
  on public.users(tier_id, profile_visibility, appear_in_lower_tier_search, hunt_mode_enabled)
  where deleted_at is null;

-- =============================================================================
-- SWINGS table (conditional — may not exist in all environments)
-- =============================================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'swings') then
    create index if not exists idx_swings_user_created
      on public.swings(user_id, created_at desc);

    create index if not exists idx_swings_user_activity
      on public.swings(user_id, activity_id);
  end if;
end
$$;

-- =============================================================================
-- SWING_POSE_KEYPOINTS table (conditional)
-- =============================================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'swing_pose_keypoints') then
    create index if not exists idx_swing_pose_keypoints_swing
      on public.swing_pose_keypoints(swing_id);
  end if;
end
$$;

-- =============================================================================
-- Search boost composite
-- =============================================================================
create index if not exists idx_users_search_boost_tier
  on public.users(search_boosted, tier_id)
  where search_boosted = true and deleted_at is null;
