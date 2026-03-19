#!/usr/bin/env ts-node
// ============================================================================
// Epic 1 Persistence Verification Script
// Tests that all 12 premium member identity fields round-trip correctly
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpNhqIU';

// The 12 required fields from Epic 1
const REQUIRED_FIELDS = {
  // Tier/Identity
  membership_tier: 'select',
  handicap_band: 'intermediate',
  home_course_area: 'Scottsdale, AZ',
  
  // Networking preferences
  networking_intent: 'business_social',
  industry: 'Technology',
  company: 'TestCorp',
  title_or_role: 'Senior Engineer',
  open_to_introductions: true,
  open_to_recurring_rounds: true,
  preferred_group_size: '4',
  round_frequency: 'weekly',
  
  // Preferences
  preferred_tee_time_window: 'mid_morning',
  mobility_preference: 'walking_preferred',
} as const;

interface TestResult {
  field: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  error?: string;
}

interface VerificationReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: TestResult[];
  missingFields: string[];
  mismatchedFields: string[];
}

async function createTestUser(supabase: SupabaseClient): Promise<string> {
  const email = `test-${randomUUID().slice(0, 8)}@spotter.test`;
  const { data: auth, error } = await supabase.auth.admin.createUser({
    email,
    password: 'TestPassword123!',
    email_confirm: true,
  });
  
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  return auth.user!.id;
}

async function cleanupTestUser(supabase: SupabaseClient, userId: string): Promise<void> {
  // Delete in correct order to respect FK constraints
  await supabase.from('user_networking_preferences').delete().eq('user_id', userId);
  await supabase.from('user_golf_identities').delete().eq('user_id', userId);
  await supabase.from('user_professional_identities').delete().eq('user_id', userId);
  await supabase.from('user_reputation').delete().eq('user_id', userId);
  await supabase.from('tier_history').delete().eq('user_id', userId);
  await supabase.from('users').delete().eq('id', userId);
  await supabase.auth.admin.deleteUser(userId);
}

async function runOnboarding(supabase: SupabaseClient, userId: string): Promise<void> {
  // Get tier ID
  const { data: tier } = await supabase
    .from('membership_tiers')
    .select('id')
    .eq('slug', REQUIRED_FIELDS.membership_tier)
    .single();
  
  if (!tier) throw new Error('Tier not found');
  
  // Update user tier
  const { error: userError } = await supabase
    .from('users')
    .update({
      tier_id: tier.id,
      tier_enrolled_at: new Date().toISOString(),
      tier_status: 'active',
    })
    .eq('id', userId);
  
  if (userError) throw new Error(`Failed to update user: ${userError.message}`);
  
  // Create golf identity
  const { error: golfError } = await supabase
    .from('user_golf_identities')
    .upsert({
      user_id: userId,
      handicap_band: REQUIRED_FIELDS.handicap_band,
      home_course_area: REQUIRED_FIELDS.home_course_area,
      play_frequency: 'weekly',
    });
  
  if (golfError) throw new Error(`Failed to create golf identity: ${golfError.message}`);
  
  // Create professional identity
  const { error: profError } = await supabase
    .from('user_professional_identities')
    .upsert({
      user_id: userId,
      company: REQUIRED_FIELDS.company,
      title: REQUIRED_FIELDS.title_or_role,
      industry: REQUIRED_FIELDS.industry,
    });
  
  if (profError) throw new Error(`Failed to create professional identity: ${profError.message}`);
  
  // Create networking preferences
  const { error: netError } = await supabase
    .from('user_networking_preferences')
    .upsert({
      user_id: userId,
      networking_intent: REQUIRED_FIELDS.networking_intent,
      industry: REQUIRED_FIELDS.industry,
      company: REQUIRED_FIELDS.company,
      title_or_role: REQUIRED_FIELDS.title_or_role,
      open_to_intros: REQUIRED_FIELDS.open_to_introductions,
      open_to_recurring_rounds: REQUIRED_FIELDS.open_to_recurring_rounds,
      preferred_group_size: REQUIRED_FIELDS.preferred_group_size,
      round_frequency: REQUIRED_FIELDS.round_frequency,
      preferred_tee_time_window: REQUIRED_FIELDS.preferred_tee_time_window,
      mobility_preference: REQUIRED_FIELDS.mobility_preference,
    });
  
  if (netError) throw new Error(`Failed to create networking preferences: ${netError.message}`);
}

async function verifyPersistence(supabase: SupabaseClient, userId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Fetch user data
  const { data: user } = await supabase
    .from('users')
    .select('*, membership_tiers!inner(slug)')
    .eq('id', userId)
    .single();
  
  const { data: golfIdentity } = await supabase
    .from('user_golf_identities')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  const { data: profIdentity } = await supabase
    .from('user_professional_identities')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  const { data: netPrefs } = await supabase
    .from('user_networking_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // Verify each field
  const checks: Array<{ field: keyof typeof REQUIRED_FIELDS; source: unknown; key: string }> = [
    { field: 'membership_tier', source: user?.membership_tiers?.slug, key: 'tier slug' },
    { field: 'handicap_band', source: golfIdentity?.handicap_band, key: 'handicap_band' },
    { field: 'home_course_area', source: golfIdentity?.home_course_area, key: 'home_course_area' },
    { field: 'networking_intent', source: netPrefs?.networking_intent, key: 'networking_intent' },
    { field: 'industry', source: netPrefs?.industry || profIdentity?.industry, key: 'industry' },
    { field: 'company', source: netPrefs?.company || profIdentity?.company, key: 'company' },
    { field: 'title_or_role', source: netPrefs?.title_or_role || profIdentity?.title, key: 'title_or_role/title' },
    { field: 'open_to_introductions', source: netPrefs?.open_to_intros, key: 'open_to_intros' },
    { field: 'open_to_recurring_rounds', source: netPrefs?.open_to_recurring_rounds, key: 'open_to_recurring_rounds' },
    { field: 'preferred_group_size', source: netPrefs?.preferred_group_size, key: 'preferred_group_size' },
    { field: 'round_frequency', source: netPrefs?.round_frequency, key: 'round_frequency' },
    { field: 'preferred_tee_time_window', source: netPrefs?.preferred_tee_time_window, key: 'preferred_tee_time_window' },
    { field: 'mobility_preference', source: netPrefs?.mobility_preference, key: 'mobility_preference' },
  ];
  
  for (const check of checks) {
    const expected = REQUIRED_FIELDS[check.field];
    const actual = check.source;
    
    results.push({
      field: check.field,
      expected,
      actual,
      passed: JSON.stringify(actual) === JSON.stringify(expected),
      error: actual !== expected ? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` : undefined,
    });
  }
  
  return results;
}

async function verifyDatabaseSchema(supabase: SupabaseClient): Promise<{ exists: boolean; missing: string[] }> {
  const requiredColumns = [
    { table: 'user_golf_identities', column: 'handicap_band' },
    { table: 'user_golf_identities', column: 'home_course_area' },
    { table: 'user_networking_preferences', column: 'preferred_tee_time_window' },
    { table: 'user_networking_preferences', column: 'round_frequency' },
    { table: 'user_networking_preferences', column: 'mobility_preference' },
    { table: 'user_networking_preferences', column: 'title_or_role' },
    { table: 'user_networking_preferences', column: 'industry' },
    { table: 'user_networking_preferences', column: 'company' },
  ];
  
  const missing: string[] = [];
  
  for (const { table, column } of requiredColumns) {
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', table)
      .eq('column_name', column)
      .single();
    
    if (error || !data) {
      missing.push(`${table}.${column}`);
    }
  }
  
  return { exists: missing.length === 0, missing };
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Epic 1 Persistence Verification Script                     ║');
  console.log('║     Testing all 12 premium member identity fields              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  let userId: string | null = null;
  
  try {
    // Step 1: Verify database schema
    console.log('📋 Step 1: Verifying database schema...');
    const schemaCheck = await verifyDatabaseSchema(supabase);
    if (!schemaCheck.exists) {
      console.log('❌ Missing columns detected:', schemaCheck.missing.join(', '));
    } else {
      console.log('✅ All required database columns exist\n');
    }
    
    // Step 2: Create test user
    console.log('👤 Step 2: Creating test user...');
    userId = await createTestUser(supabase);
    console.log(`✅ Test user created: ${userId}\n`);
    
    // Step 3: Run onboarding
    console.log('📝 Step 3: Running onboarding with all 12 fields...');
    await runOnboarding(supabase, userId);
    console.log('✅ Onboarding completed\n');
    
    // Step 4: Verify persistence
    console.log('🔍 Step 4: Verifying field persistence...\n');
    const results = await verifyPersistence(supabase, userId);
    
    // Generate report
    const report: VerificationReport = {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results,
      missingFields: results.filter(r => r.actual === null || r.actual === undefined).map(r => r.field),
      mismatchedFields: results.filter(r => !r.passed && r.actual !== null && r.actual !== undefined).map(r => r.field),
    };
    
    // Print results
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('RESULTS:');
    console.log('══════════════════════════════════════════════════════════════════\n');
    
    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      const status = result.passed ? 'PASS' : 'FAIL';
      console.log(`${icon} ${result.field.padEnd(30)} | ${status}`);
      if (!result.passed && result.error) {
        console.log(`   └─ ${result.error}`);
      }
    }
    
    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log('SUMMARY:');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log(`Total Tests:  ${report.totalTests}`);
    console.log(`Passed:       ${report.passed} ✅`);
    console.log(`Failed:       ${report.failed} ❌`);
    console.log(`Success Rate: ${((report.passed / report.totalTests) * 100).toFixed(1)}%`);
    
    if (report.missingFields.length > 0) {
      console.log(`\n⚠️  Fields not persisted (null/undefined): ${report.missingFields.join(', ')}`);
    }
    if (report.mismatchedFields.length > 0) {
      console.log(`\n⚠️  Fields with mismatched values: ${report.mismatchedFields.join(', ')}`);
    }
    
    console.log('\n══════════════════════════════════════════════════════════════════');
    
    if (report.failed === 0) {
      console.log('\n✅ ALL TESTS PASSED - Epic 1 persistence is working correctly!');
      process.exit(0);
    } else {
      console.log(`\n❌ ${report.failed} TESTS FAILED - Review failures above`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Verification failed with error:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (userId) {
      console.log('\n🧹 Cleaning up test user...');
      await cleanupTestUser(supabase, userId);
      console.log('✅ Cleanup complete');
    }
  }
}

// Run if called directly
main();

export { verifyPersistence, runOnboarding, REQUIRED_FIELDS };
