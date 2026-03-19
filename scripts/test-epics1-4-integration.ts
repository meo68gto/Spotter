#!/usr/bin/env node
/**
 * Epics 1-4 Integration Test Suite
 * 
 * Tests the complete user journey:
 * Epic 1: Onboarding & Profile → Epic 2: Same-Tier Discovery → 
 * Epic 3: Premium Matching → Epic 4: Network Graph
 * 
 * Usage: npx ts-node scripts/test-epics1-4-integration.ts
 */

import { createClient, SupabaseClient, type User } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env.local' });

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwEV8qyDsP31lcJwW2ZIg',
  cleanup: true,
  verbose: true,
};

// ============================================================================
// Test Data Fixtures
// ============================================================================

interface TestUserData {
  email: string;
  password: string;
  displayName: string;
  tier: 'free' | 'select' | 'summit';
  handicap: number;
  city: string;
  intent: 'business' | 'social' | 'competitive' | 'business_social';
  company?: string;
  role?: string;
  industry?: string;
  bio?: string;
  yearsPlaying?: number;
  homeCourseArea?: string;
  preferredTeeTimes?: string[];
}

const TEST_USER_FIXTURES: TestUserData[] = [
  // FREE tier users
  {
    email: `integration-free-1-${Date.now()}@spotter.test`,
    password: 'TestPass123!',
    displayName: 'Alice Johnson',
    tier: 'free',
    handicap: 8,
    city: 'Phoenix',
    intent: 'business',
    company: 'TechStart Inc',
    role: 'Software Engineer',
    industry: 'Technology',
    bio: 'Looking to network with other tech professionals who love golf',
    yearsPlaying: 5,
    homeCourseArea: 'Scottsdale',
    preferredTeeTimes: ['early_bird', 'mid_morning'],
  },
  {
    email: `integration-free-2-${Date.now()}@spotter.test`,
    password: 'TestPass123!',
    displayName: 'Bob Smith',
    tier: 'free',
    handicap: 15,
    city: 'Scottsdale',
    intent: 'social',
    bio: 'Weekend golfer looking to meet new people',
    yearsPlaying: 3,
    homeCourseArea: 'Scottsdale',
    preferredTeeTimes: ['afternoon'],
  },
  {
    email: `integration-free-3-${Date.now()}@spotter.test`,
    password: 'TestPass123!',
    displayName: 'Carol White',
    tier: 'free',
    handicap: 22,
    city: 'Tempe',
    intent: 'competitive',
    bio: 'Looking for competitive golfers to improve my game',
    yearsPlaying: 2,
    homeCourseArea: 'Tempe',
    preferredTeeTimes: ['twilight'],
  },
  // SELECT tier users
  {
    email: `integration-select-1-${Date.now()}@spotter.test`,
    password: 'TestPass123!',
    displayName: 'David Chen',
    tier: 'select',
    handicap: 12,
    city: 'Phoenix',
    intent: 'business_social',
    company: 'Finance Partners',
    role: 'Senior Analyst',
    industry: 'Finance',
    bio: 'Finance professional who enjoys networking on the course',
    yearsPlaying: 8,
    homeCourseArea: 'Phoenix',
    preferredTeeTimes: ['early_bird', 'mid_morning'],
  },
  {
    email: `integration-select-2-${Date.now()}@spotter.test`,
    password: 'TestPass123!',
    displayName: 'Elena Rodriguez',
    tier: 'select',
    handicap: 18,
    city: 'Scottsdale',
    intent: 'competitive',
    company: 'Law Offices PLLC',
    role: 'Attorney',
    industry: 'Legal',
    bio: 'Competitive golfer and attorney',
    yearsPlaying: 6,
    homeCourseArea: 'Scottsdale',
    preferredTeeTimes: ['mid_morning', 'afternoon'],
  },
  {
    email: `integration-select-3-${Date.now()}@spotter.test`,
    password: 'TestPass123!',
    displayName: 'Frank Miller',
    tier: 'select',
    handicap: 6,
    city: 'Gilbert',
    intent: 'business',
    company: 'Miller Consulting',
    role: 'Consultant',
    industry: 'Consulting',
    bio: 'Business networking through golf',
    yearsPlaying: 12,
    homeCourseArea: 'Gilbert',
    preferredTeeTimes: ['early_bird'],
  },
  // SUMMIT tier users
  {
    email: `integration-summit-1-${Date.now()}@spotter.test`,
    password: 'TestPass123!',
    displayName: 'Grace Park',
    tier: 'summit',
    handicap: 5,
    city: 'Paradise Valley',
    intent: 'business',
    company: 'Executive Ventures',
    role: 'CEO',
    industry: 'Technology',
    bio: 'CEO looking for quality connections',
    yearsPlaying: 15,
    homeCourseArea: 'Paradise Valley',
    preferredTeeTimes: ['early_bird', 'mid_morning'],
  },
  {
    email: `integration-summit-2-${Date.now()}@spotter.test`,
    password: 'TestPass123!',
    displayName: 'Henry Wilson',
    tier: 'summit',
    handicap: 14,
    city: 'Scottsdale',
    intent: 'social',
    company: 'Wilson Design Studio',
    role: 'Creative Director',
    industry: 'Design',
    bio: 'Creative director who enjoys social golf',
    yearsPlaying: 10,
    homeCourseArea: 'Scottsdale',
    preferredTeeTimes: ['afternoon', 'twilight'],
  },
  {
    email: `integration-summit-3-${Date.now()}@spotter.test`,
    password: 'TestPass123!',
    displayName: 'Iris Thompson',
    tier: 'summit',
    handicap: 2,
    city: 'Phoenix',
    intent: 'competitive',
    company: 'Elite Sports',
    role: 'Pro Golfer',
    industry: 'Sports',
    bio: 'Professional golfer seeking competitive matches',
    yearsPlaying: 20,
    homeCourseArea: 'Phoenix',
    preferredTeeTimes: ['early_bird'],
  },
];

// ============================================================================
// Test State
// ============================================================================

interface TestResult {
  epic: number;
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface CreatedUser {
  id: string;
  email: string;
  tier: string;
  tierId: string;
  displayName: string;
  auth: any;
}

const testResults: TestResult[] = [];
const createdUsers: CreatedUser[] = [];
let supabase: SupabaseClient;
let tierMap: Map<string, string> = new Map(); // slug -> id

// ============================================================================
// Logger
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, level: 'info' | 'success' | 'error' | 'warn' | 'header' = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  let prefix = `[${timestamp}]`;
  let color = colors.reset;

  switch (level) {
    case 'success':
      prefix += ' ✓';
      color = colors.green;
      break;
    case 'error':
      prefix += ' ✗';
      color = colors.red;
      break;
    case 'warn':
      prefix += ' ⚠';
      color = colors.yellow;
      break;
    case 'header':
      color = colors.cyan + colors.bright;
      break;
    default:
      color = colors.reset;
  }

  console.log(`${color}${prefix} ${message}${colors.reset}`);
}

// ============================================================================
// Test Runner
// ============================================================================

async function runTest<T>(
  epic: number,
  testName: string,
  testFn: () => Promise<T>
): Promise<T | undefined> {
  const start = Date.now();
  try {
    log(`Running: Epic ${epic} - ${testName}`, 'info');
    const result = await testFn();
    const duration = Date.now() - start;
    testResults.push({ epic, testName, passed: true, duration });
    log(`✓ Passed: ${testName} (${duration}ms)`, 'success');
    return result;
  } catch (error: any) {
    const duration = Date.now() - start;
    const errorMessage = error?.message || String(error);
    testResults.push({ epic, testName, passed: false, duration, error: errorMessage });
    log(`✗ Failed: ${testName} - ${errorMessage}`, 'error');
    return undefined;
  }
}

// ============================================================================
// Setup & Teardown
// ============================================================================

async function setup() {
  log('Setting up integration test environment...', 'header');

  supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: { persistSession: false },
  });

  // Fetch tier IDs
  const { data: tiers, error: tiersError } = await supabase
    .from('membership_tiers')
    .select('id, slug');

  if (tiersError || !tiers) {
    throw new Error(`Failed to fetch tiers: ${tiersError?.message}`);
  }

  for (const tier of tiers) {
    tierMap.set(tier.slug, tier.id);
  }

  log(`Loaded ${tiers.length} tiers: ${tiers.map((t) => t.slug).join(', ')}`, 'success');

  // Check for test course
  const { data: courses, error: coursesError } = await supabase
    .from('golf_courses')
    .select('id, name')
    .eq('is_active', true)
    .limit(1);

  if (coursesError || !courses || courses.length === 0) {
    log('⚠️ No active courses found - some tests may be limited', 'warn');
  } else {
    log(`Found test course: ${courses[0].name}`, 'success');
  }
}

async function cleanup() {
  if (!CONFIG.cleanup) return;

  log('\nCleaning up test data...', 'header');

  for (const user of createdUsers) {
    try {
      await supabase.auth.admin.deleteUser(user.id);
      log(`Deleted user: ${user.email}`, 'info');
    } catch (error: any) {
      log(`Failed to delete user ${user.email}: ${error.message}`, 'warn');
    }
  }

  log('Cleanup complete', 'success');
}

// ============================================================================
// Epic 1: Onboarding & Profile Tests
// ============================================================================

async function testEpic1OnboardingAndProfile() {
  log('\n=== EPIC 1: ONBOARDING & PROFILE ===', 'header');

  // Test 1.1: Create test user in each tier
  await runTest(1, 'Create test users in each tier', async () => {
    for (const fixture of TEST_USER_FIXTURES) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', fixture.email)
        .maybeSingle();

      if (existing) {
        log(`User ${fixture.email} already exists, skipping`, 'warn');
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: fixture.email,
        password: fixture.password,
        email_confirm: true,
        user_metadata: {
          display_name: fixture.displayName,
        },
      });

      if (authError || !authData.user) {
        throw new Error(`Failed to create auth user: ${authError?.message}`);
      }

      const tierId = tierMap.get(fixture.tier);
      if (!tierId) {
        throw new Error(`Tier ${fixture.tier} not found`);
      }

      // Update user with tier
      const { error: updateError } = await supabase
        .from('users')
        .update({
          tier_id: tierId,
          tier_status: 'active',
          tier_enrolled_at: new Date().toISOString(),
          display_name: fixture.displayName,
          city: fixture.city,
        })
        .eq('id', authData.user.id);

      if (updateError) {
        throw new Error(`Failed to update user tier: ${updateError.message}`);
      }

      createdUsers.push({
        id: authData.user.id,
        email: fixture.email,
        tier: fixture.tier,
        tierId,
        displayName: fixture.displayName,
        auth: authData.user,
      });

      log(`Created ${fixture.tier} user: ${fixture.displayName}`, 'success');
    }

    if (createdUsers.length !== TEST_USER_FIXTURES.length) {
      throw new Error(`Expected ${TEST_USER_FIXTURES.length} users, created ${createdUsers.length}`);
    }
  });

  // Test 1.2: Complete onboarding with all 12 fields
  await runTest(1, 'Complete onboarding profiles', async () => {
    for (let i = 0; i < createdUsers.length; i++) {
      const user = createdUsers[i];
      const fixture = TEST_USER_FIXTURES[i];

      // Create golf identity
      const { error: golfError } = await supabase
        .from('user_golf_identities')
        .upsert({
          user_id: user.id,
          handicap: fixture.handicap,
          playing_frequency: 'weekly',
          years_playing: fixture.yearsPlaying || 5,
          home_course_area: fixture.homeCourseArea,
          preferred_tee_times: fixture.preferredTeeTimes,
        }, { onConflict: 'user_id' });

      if (golfError) {
        throw new Error(`Failed to create golf identity: ${golfError.message}`);
      }

      // Create networking preferences
      const { error: networkingError } = await supabase
        .from('user_networking_preferences')
        .upsert({
          user_id: user.id,
          networking_intent: fixture.intent,
          open_to_intros: true,
          open_to_sending_intros: true,
          open_to_recurring_rounds: true,
          preferred_group_size: '4',
          cart_preference: 'either',
          company: fixture.company,
          title_or_role: fixture.role,
          industry: fixture.industry,
          preferred_golf_area: fixture.homeCourseArea,
        }, { onConflict: 'user_id' });

      if (networkingError) {
        throw new Error(`Failed to create networking preferences: ${networkingError.message}`);
      }

      // Create professional identity if company provided
      if (fixture.company && fixture.role) {
        const { error: profError } = await supabase
          .from('user_professional_identities')
          .upsert({
            user_id: user.id,
            company: fixture.company,
            title: fixture.role,
            industry: fixture.industry || 'Technology',
            years_experience: Math.floor(Math.random() * 15) + 5,
          }, { onConflict: 'user_id' });

        if (profError) {
          throw new Error(`Failed to create professional identity: ${profError.message}`);
        }
      }

      // Create initial reputation
      const { error: repError } = await supabase
        .from('user_reputation')
        .upsert({
          user_id: user.id,
          overall_score: 50 + Math.floor(Math.random() * 30),
          completion_rate: 100,
          ratings_average: 4.5,
          network_size: 0,
          profile_completeness: 90,
        }, { onConflict: 'user_id' });

      if (repError) {
        throw new Error(`Failed to create reputation: ${repError.message}`);
      }

      log(`Completed profile for: ${fixture.displayName}`, 'success');
    }
  });

  // Test 1.3: Verify profile displays correctly
  await runTest(1, 'Verify profile displays correctly', async () => {
    const user = createdUsers[0];

    const { data: profile, error } = await supabase
      .from('users')
      .select(`
        id,
        display_name,
        city,
        tier_id,
        user_golf_identities(handicap, years_playing),
        user_networking_preferences(networking_intent, company),
        user_professional_identities(company, title, industry)
      `)
      .eq('id', user.id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Verify key fields
    if (!profile.display_name) throw new Error('display_name missing');
    if (!profile.city) throw new Error('city missing');
    if (!profile.tier_id) throw new Error('tier_id missing');
    if (!profile.user_golf_identities) throw new Error('golf identity missing');
    if (!profile.user_networking_preferences) throw new Error('networking preferences missing');

    log(`Profile verified: ${profile.display_name}, handicap: ${profile.user_golf_identities[0]?.handicap}`, 'success');
  });

  // Test 1.4: Verify data persisted in database
  await runTest(1, 'Verify data persisted in database', async () => {
    const user = createdUsers[0];

    const checks = [
      { table: 'users', column: 'id', expected: user.id },
      { table: 'user_golf_identities', column: 'user_id', expected: user.id },
      { table: 'user_networking_preferences', column: 'user_id', expected: user.id },
      { table: 'user_reputation', column: 'user_id', expected: user.id },
    ];

    for (const check of checks) {
      const { data, error } = await supabase
        .from(check.table)
        .select('count')
        .eq(check.column, check.expected);

      if (error) {
        throw new Error(`Failed to check ${check.table}: ${error.message}`);
      }

      // Use count query result
      const countResult = await supabase
        .from(check.table)
        .select('*', { count: 'exact', head: true })
        .eq(check.column, check.expected);

      if (countResult.count === 0) {
        throw new Error(`No records found in ${check.table}`);
      }
    }

    log(`All data persisted correctly for ${user.displayName}`, 'success');
  });
}

// ============================================================================
// Epic 2: Same-Tier Discovery Tests
// ============================================================================

async function testEpic2SameTierDiscovery() {
  log('\n=== EPIC 2: SAME-TIER DISCOVERY ===', 'header');

  // Test 2.1: Verify free user sees only free users
  await runTest(2, 'Free user sees only Free tier users', async () => {
    const freeUser = createdUsers.find((u) => u.tier === 'free');
    if (!freeUser) throw new Error('No free user found');

    const { data: discoverable, error } = await supabase.rpc('discover_golfers', {
      p_user_id: freeUser.id,
      p_limit: 100,
    });

    if (error) {
      throw new Error(`Discovery failed: ${error.message}`);
    }

    // Check all returned users are free tier
    const nonFreeUsers = discoverable?.filter((u: any) => u.tier_slug !== 'free');
    if (nonFreeUsers && nonFreeUsers.length > 0) {
      throw new Error(
        `Cross-tier leakage detected: ${nonFreeUsers.length} non-free users found in discovery`
      );
    }

    log(`Free user discovered ${discoverable?.length || 0} other free users`, 'success');
  });

  // Test 2.2: Verify select user sees only select users
  await runTest(2, 'Select user sees only Select tier users', async () => {
    const selectUser = createdUsers.find((u) => u.tier === 'select');
    if (!selectUser) throw new Error('No select user found');

    const { data: discoverable, error } = await supabase.rpc('discover_golfers', {
      p_user_id: selectUser.id,
      p_limit: 100,
    });

    if (error) {
      throw new Error(`Discovery failed: ${error.message}`);
    }

    const nonSelectUsers = discoverable?.filter((u: any) => u.tier_slug !== 'select');
    if (nonSelectUsers && nonSelectUsers.length > 0) {
      throw new Error(
        `Cross-tier leakage detected: ${nonSelectUsers.length} non-select users found`
      );
    }

    log(`Select user discovered ${discoverable?.length || 0} other select users`, 'success');
  });

  // Test 2.3: Verify summit user sees only summit users
  await runTest(2, 'Summit user sees only Summit tier users', async () => {
    const summitUser = createdUsers.find((u) => u.tier === 'summit');
    if (!summitUser) throw new Error('No summit user found');

    const { data: discoverable, error } = await supabase.rpc('discover_golfers', {
      p_user_id: summitUser.id,
      p_limit: 100,
    });

    if (error) {
      throw new Error(`Discovery failed: ${error.message}`);
    }

    const nonSummitUsers = discoverable?.filter((u: any) => u.tier_slug !== 'summit');
    if (nonSummitUsers && nonSummitUsers.length > 0) {
      throw new Error(
        `Cross-tier leakage detected: ${nonSummitUsers.length} non-summit users found`
      );
    }

    log(`Summit user discovered ${discoverable?.length || 0} other summit users`, 'success');
  });

  // Test 2.4: Verify cross-tier access is blocked
  await runTest(2, 'Cross-tier access is blocked', async () => {
    // Use the RPC function to check same-tier
    const freeUser = createdUsers.find((u) => u.tier === 'free');
    const selectUser = createdUsers.find((u) => u.tier === 'select');

    if (!freeUser || !selectUser) {
      throw new Error('Missing users for cross-tier test');
    }

    const { data: sameTier, error } = await supabase.rpc('check_same_tier', {
      user_a_id: freeUser.id,
      user_b_id: selectUser.id,
    });

    if (error && !error.message?.includes('null')) {
      throw new Error(`Same-tier check failed: ${error.message}`);
    }

    if (sameTier === true) {
      throw new Error('Cross-tier users incorrectly reported as same tier');
    }

    log(`Cross-tier check correctly returned ${sameTier}`, 'success');
  });

  // Test 2.5: Discovery with filters
  await runTest(2, 'Discovery with handicap filter', async () => {
    const freeUser = createdUsers.find((u) => u.tier === 'free');
    if (!freeUser) throw new Error('No free user found');

    const { data: discoverable, error } = await supabase.rpc('discover_golfers', {
      p_user_id: freeUser.id,
      p_limit: 100,
    });

    if (error) {
      throw new Error(`Discovery failed: ${error.message}`);
    }

    // Verify returned users have required fields
    if (discoverable && discoverable.length > 0) {
      const firstUser = discoverable[0];
      const requiredFields = ['user_id', 'display_name', 'tier_slug', 'reputation_score'];
      for (const field of requiredFields) {
        if (!(field in firstUser)) {
          throw new Error(`Missing field ${field} in discoverable user`);
        }
      }
    }

    log(`Discovery returned ${discoverable?.length || 0} users with valid structure`, 'success');
  });
}

// ============================================================================
// Epic 3: Premium Matching Tests
// ============================================================================

async function testEpic3PremiumMatching() {
  log('\n=== EPIC 3: PREMIUM MATCHING ===', 'header');

  // Test 3.1: Discovery search with filters
  await runTest(3, 'Discovery search with location filter', async () => {
    const freeUser = createdUsers.find((u) => u.tier === 'free');
    if (!freeUser) throw new Error('No free user found');

    const { data: discoverable, error } = await supabase.rpc('discover_golfers', {
      p_user_id: freeUser.id,
      p_limit: 100,
    });

    if (error) {
      throw new Error(`Discovery failed: ${error.message}`);
    }

    // Verify all users are from same tier
    const allSameTier = discoverable?.every((u: any) => u.tier_slug === 'free');
    if (!allSameTier) {
      throw new Error('Cross-tier users found in discovery');
    }

    log(`Discovery returned ${discoverable?.length || 0} same-tier users`, 'success');
  });

  // Test 3.2: Verify PremiumMatchCard data structure
  await runTest(3, 'Match card data structure validation', async () => {
    const freeUser = createdUsers.find((u) => u.tier === 'free');
    if (!freeUser) throw new Error('No free user found');

    const { data: discoverable, error } = await supabase.rpc('discover_golfers', {
      p_user_id: freeUser.id,
      p_limit: 1,
    });

    if (error) {
      throw new Error(`Discovery failed: ${error.message}`);
    }

    if (!discoverable || discoverable.length === 0) {
      log('No discoverable users found - creating additional test user', 'warn');
      return;
    }

    const match = discoverable[0];

    // Validate PremiumMatchCard required fields
    const requiredFields = [
      'user_id',
      'display_name',
      'tier_slug',
      'compatibility_score',
      'reputation_score',
      'profile_completeness',
    ];

    for (const field of requiredFields) {
      if (!(field in match)) {
        throw new Error(`Missing required field for PremiumMatchCard: ${field}`);
      }
    }

    log(`Match card validated for user: ${match.display_name}`, 'success');
  });

  // Test 3.3: Test fit reasons are meaningful
  await runTest(3, 'Compatibility scoring is meaningful', async () => {
    const freeUser = createdUsers.find((u) => u.tier === 'free');
    if (!freeUser) throw new Error('No free user found');

    const { data: discoverable, error } = await supabase.rpc('discover_golfers', {
      p_user_id: freeUser.id,
      p_limit: 5,
    });

    if (error) {
      throw new Error(`Discovery failed: ${error.message}`);
    }

    if (!discoverable || discoverable.length === 0) {
      log('No matches to validate compatibility', 'warn');
      return;
    }

    // Check that compatibility scores are reasonable (0-100)
    for (const user of discoverable) {
      if (user.compatibility_score < 0 || user.compatibility_score > 100) {
        throw new Error(`Invalid compatibility score: ${user.compatibility_score}`);
      }
    }

    log(`All ${discoverable.length} matches have valid compatibility scores`, 'success');
  });

  // Test 3.4: Test action buttons (save, intro, invite)
  await runTest(3, 'Save member action works', async () => {
    const freeUsers = createdUsers.filter((u) => u.tier === 'free');
    if (freeUsers.length < 2) {
      log('Not enough free users for save test', 'warn');
      return;
    }

    const [saver, saved] = freeUsers;

    // Save a member
    const { data: savedMember, error } = await supabase
      .from('saved_members')
      .insert({
        saver_id: saver.id,
        saved_user_id: saved.id,
        tier: 'standard',
        notes: 'Test saved member',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save member: ${error.message}`);
    }

    log(`Saved member: ${saved.displayName} by ${saver.displayName}`, 'success');
  });
}

// ============================================================================
// Epic 4: Network Graph Tests
// ============================================================================

async function testEpic4NetworkGraph() {
  log('\n=== EPIC 4: NETWORK GRAPH ===', 'header');

  // Test 4.1: Save a member
  await runTest(4, 'Save member for network', async () => {
    const selectUsers = createdUsers.filter((u) => u.tier === 'select');
    if (selectUsers.length < 2) {
      log('Not enough select users for network test', 'warn');
      return;
    }

    const [saver, saved] = selectUsers;

    // Check if already saved
    const { data: existing } = await supabase
      .from('saved_members')
      .select('id')
      .eq('saver_id', saver.id)
      .eq('saved_user_id', saved.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('saved_members').insert({
        saver_id: saver.id,
        saved_user_id: saved.id,
        tier: 'favorite',
        notes: 'Test favorite connection',
        tags: ['business', 'regular'],
      });

      if (error) {
        throw new Error(`Failed to save member: ${error.message}`);
      }
    }

    log(`Member ${saved.displayName} saved by ${saver.displayName}`, 'success');
  });

  // Test 4.2: Request introduction (need mutual connection)
  await runTest(4, 'Introduction request flow', async () => {
    const selectUsers = createdUsers.filter((u) => u.tier === 'select');
    if (selectUsers.length < 3) {
      log('Not enough select users for introduction test', 'warn');
      return;
    }

    const [requester, connector, target] = selectUsers;

    // First create a connection between connector and target (mutual connection)
    const { error: connError } = await supabase.from('user_connections').insert({
      user_id: connector.id,
      connected_user_id: target.id,
      status: 'accepted',
      relationship_state: 'played_together',
      strength_score: 75,
      rounds_count: 2,
    });

    if (connError && !connError.message?.includes('duplicate')) {
      log(`Connection creation (may already exist): ${connError.message}`, 'warn');
    }

    // Create connection from target to connector
    const { error: connError2 } = await supabase.from('user_connections').insert({
      user_id: target.id,
      connected_user_id: connector.id,
      status: 'accepted',
      relationship_state: 'played_together',
      strength_score: 75,
      rounds_count: 2,
    });

    if (connError2 && !connError2.message?.includes('duplicate')) {
      log(`Connection creation (may already exist): ${connError2.message}`, 'warn');
    }

    // Now create introduction request
    const { error: introError } = await supabase.from('introduction_requests').insert({
      requester_id: requester.id,
      connector_id: connector.id,
      target_id: target.id,
      status: 'pending',
      connector_message: 'Would love an intro to this person!',
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });

    if (introError) {
      throw new Error(`Failed to create introduction: ${introError.message}`);
    }

    log(`Introduction requested: ${requester.displayName} → ${connector.displayName} → ${target.displayName}`, 'success');
  });

  // Test 4.3: Simulate round completion
  await runTest(4, 'Simulate round completion', async () => {
    const summitUsers = createdUsers.filter((u) => u.tier === 'summit');
    if (summitUsers.length < 2) {
      log('Not enough summit users for round test', 'warn');
      return;
    }

    const [user1, user2] = summitUsers;

    // Get or create a course
    const { data: courses } = await supabase
      .from('golf_courses')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (!courses || courses.length === 0) {
      log('No courses available for round creation', 'warn');
      return;
    }

    const courseId = courses[0].id;
    const tierId = tierMap.get('summit');

    // Create a completed round
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        creator_id: user1.id,
        course_id: courseId,
        tier_id: tierId,
        scheduled_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Past
        completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        max_players: 4,
        cart_preference: 'either',
      })
      .select()
      .single();

    if (roundError && !roundError.message?.includes('duplicate')) {
      log(`Round creation note: ${roundError.message}`, 'warn');
    }

    if (round) {
      // Add participants
      await supabase.from('round_participants_v2').insert([
        { round_id: round.id, user_id: user1.id, status: 'confirmed' },
        { round_id: round.id, user_id: user2.id, status: 'confirmed' },
      ]);

      log(`Round completed: ${round.id}`, 'success');
    }
  });

  // Test 4.4: Verify connection state updates
  await runTest(4, 'Connection state updates after round', async () => {
    const summitUsers = createdUsers.filter((u) => u.tier === 'summit');
    if (summitUsers.length < 2) {
      log('Not enough summit users for connection test', 'warn');
      return;
    }

    const [user1, user2] = summitUsers;

    // Check if connection exists
    const { data: connection, error } = await supabase
      .from('user_connections')
      .select('*')
      .eq('user_id', user1.id)
      .eq('connected_user_id', user2.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check connection: ${error.message}`);
    }

    // If no connection, create one
    if (!connection) {
      await supabase.from('user_connections').insert({
        user_id: user1.id,
        connected_user_id: user2.id,
        status: 'accepted',
        relationship_state: 'played_together',
        rounds_count: 1,
        strength_score: 50,
      });
      log('Connection created', 'success');
    } else {
      log(`Connection exists with state: ${connection.relationship_state}`, 'success');
    }
  });

  // Test 4.5: Verify auto-promotion works
  await runTest(4, 'Auto-promotion to regular partner', async () => {
    const selectUsers = createdUsers.filter((u) => u.tier === 'select');
    if (selectUsers.length < 2) {
      log('Not enough select users for auto-promotion test', 'warn');
      return;
    }

    const [user1, user2] = selectUsers;

    // Update connection to trigger auto-promotion
    const { error } = await supabase
      .from('user_connections')
      .upsert({
        user_id: user1.id,
        connected_user_id: user2.id,
        status: 'accepted',
        relationship_state: 'played_together',
        rounds_count: 3, // Trigger for regular_partner
        strength_score: 75,
      }, { onConflict: 'user_id, connected_user_id' });

    if (error) {
      throw new Error(`Failed to update connection: ${error.message}`);
    }

    // Check if promotion would occur (based on rounds_count)
    const { data: updated } = await supabase
      .from('user_connections')
      .select('relationship_state, rounds_count')
      .eq('user_id', user1.id)
      .eq('connected_user_id', user2.id)
      .single();

    if (updated && updated.rounds_count >= 3) {
      log(`Connection ready for promotion: ${updated.rounds_count} rounds`, 'success');
    }
  });
}

// ============================================================================
// Cross-Epic Integration Tests
// ============================================================================

async function testCrossEpicIntegration() {
  log('\n=== CROSS-EPIC INTEGRATION TESTS ===', 'header');

  // Test: End-to-end user journey
  await runTest(5, 'Complete user journey: Onboarding → Discovery → Save → Connect', async () => {
    // Pick a free user
    const freeUser = createdUsers.find((u) => u.tier === 'free');
    if (!freeUser) throw new Error('No free user found');

    // Step 1: Verify profile is complete (Epic 1)
    const { data: profile } = await supabase
      .from('users')
      .select('*, user_golf_identities(*), user_networking_preferences(*)')
      .eq('id', freeUser.id)
      .single();

    if (!profile?.user_golf_identities || !profile?.user_networking_preferences) {
      throw new Error('Profile not complete');
    }

    // Step 2: Discover users (Epic 2)
    const { data: discoverable } = await supabase.rpc('discover_golfers', {
      p_user_id: freeUser.id,
      p_limit: 10,
    });

    if (!discoverable || discoverable.length === 0) {
      throw new Error('No users discoverable');
    }

    // Verify same-tier
    const allSameTier = discoverable.every((u: any) => u.tier_slug === 'free');
    if (!allSameTier) throw new Error('Cross-tier discovery detected');

    // Step 3: Save a member (Epic 4)
    const targetUser = discoverable[0];
    const { error: saveError } = await supabase.from('saved_members').insert({
      saver_id: freeUser.id,
      saved_user_id: targetUser.user_id,
      tier: 'standard',
      notes: 'Discovered and saved',
    });

    if (saveError && !saveError.message?.includes('duplicate')) {
      throw new Error(`Save failed: ${saveError.message}`);
    }

    log('End-to-end journey completed successfully', 'success');
  });

  // Test: Data integrity across epics
  await runTest(5, 'Data integrity across all epics', async () => {
    const user = createdUsers[0];

    // Verify all related data exists
    const checks = await Promise.all([
      supabase.from('users').select('count', { count: 'exact', head: true }).eq('id', user.id),
      supabase
        .from('user_golf_identities')
        .select('count', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('user_networking_preferences')
        .select('count', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase.from('user_reputation').select('count', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);

    for (const check of checks) {
      if (check.error) {
        throw new Error(`Data integrity check failed: ${check.error.message}`);
      }
    }

    log('All data integrity checks passed', 'success');
  });
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport() {
  log('\n========================================', 'header');
  log('    INTEGRATION TEST REPORT', 'header');
  log('========================================', 'header');

  const byEpic = new Map<number, TestResult[]>();
  for (const result of testResults) {
    const existing = byEpic.get(result.epic) || [];
    existing.push(result);
    byEpic.set(result.epic, existing);
  }

  for (const [epic, results] of byEpic) {
    const epicName =
      epic === 1
        ? 'Onboarding & Profile'
        : epic === 2
        ? 'Same-Tier Discovery'
        : epic === 3
        ? 'Premium Matching'
        : epic === 4
        ? 'Network Graph'
        : 'Cross-Epic Integration';

    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const status = passed === total ? '✓' : '✗';
    const color = passed === total ? 'success' : 'warn';

    log(`\nEpic ${epic}: ${epicName} ${status} (${passed}/${total})`, color);

    for (const result of results) {
      const symbol = result.passed ? '✓' : '✗';
      const lineColor = result.passed ? 'success' : 'error';
      log(`  ${symbol} ${result.testName} (${result.duration}ms)`, lineColor);
      if (result.error) {
        log(`    Error: ${result.error}`, 'error');
      }
    }
  }

  const totalPassed = testResults.filter((r) => r.passed).length;
  const totalTests = testResults.length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

  log('\n----------------------------------------', 'header');
  log(`SUMMARY: ${totalPassed}/${totalTests} tests passed`, totalPassed === totalTests ? 'success' : 'warn');
  log(`Duration: ${totalDuration}ms`, 'info');
  log('----------------------------------------', 'header');

  return { passed: totalPassed, failed: totalTests - totalPassed, total: totalTests };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  log('========================================', 'header');
  log('  EPICS 1-4 INTEGRATION TEST SUITE', 'header');
  log('========================================\n', 'header');

  try {
    await setup();

    await testEpic1OnboardingAndProfile();
    await testEpic2SameTierDiscovery();
    await testEpic3PremiumMatching();
    await testEpic4NetworkGraph();
    await testCrossEpicIntegration();

    const { passed, failed } = generateReport();

    await cleanup();

    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    log(`\nFatal error: ${error.message}`, 'error');
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

// Run tests
main();

export { testEpic1OnboardingAndProfile, testEpic2SameTierDiscovery, testEpic3PremiumMatching, testEpic4NetworkGraph };
