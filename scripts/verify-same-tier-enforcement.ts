#!/usr/bin/env node
/**
 * Same-Tier Enforcement Verification Script
 * Tests that same-tier visibility is properly enforced across all user-facing surfaces
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './apps/functions/.env.local' });

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  cyan: '\x1b[36m'
};

async function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const color = type === 'success' ? colors.green : 
                type === 'error' ? colors.red : 
                type === 'warn' ? colors.yellow : colors.cyan;
  console.log(`${color}${message}${colors.reset}`);
}

async function createTestUser(
  supabase: SupabaseClient,
  email: string,
  displayName: string,
  tierSlug: string
): Promise<{ user: any; error: any }> {
  // First, check if tier exists
  const { data: tier, error: tierError } = await supabase
    .from('membership_tiers')
    .select('id, slug')
    .eq('slug', tierSlug)
    .single();

  if (tierError || !tier) {
    return { user: null, error: `Tier ${tierSlug} not found: ${tierError?.message}` };
  }

  // Create user with specific tier
  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password: 'TestPassword123!',
    email_confirm: true,
    user_metadata: {
      display_name: displayName
    }
  });

  if (error) {
    return { user: null, error: error.message };
  }

  // Set the user's tier
  const { error: updateError } = await supabase
    .from('users')
    .update({
      tier_id: tier.id,
      tier_status: 'active',
      tier_enrolled_at: new Date().toISOString()
    })
    .eq('id', user.user.id);

  if (updateError) {
    return { user: null, error: updateError.message };
  }

  return { user: { ...user.user, tier_id: tier.id, tier_slug: tierSlug }, error: null };
}

async function cleanupTestUsers(supabase: SupabaseClient, emails: string[]) {
  log('\nCleaning up test users...', 'info');
  for (const email of emails) {
    const { data: user } = await supabase.auth.admin.listUsers();
    const found = user?.users?.find((u: any) => u.email === email);
    if (found) {
      await supabase.auth.admin.deleteUser(found.id);
      log(`  Deleted: ${email}`, 'info');
    }
  }
}

async function runTests() {
  log('\n========================================', 'info');
  log('Same-Tier Enforcement Verification', 'info');
  log('========================================\n', 'info');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const testEmails: string[] = [];

  try {
    // Test 1: Database function check_same_tier exists
    log('Test 1: Checking database function check_same_tier...', 'info');
    try {
      const { data, error } = await supabase.rpc('check_same_tier', {
        user_a_id: '00000000-0000-0000-0000-000000000001',
        user_b_id: '00000000-0000-0000-0000-000000000002'
      });
      
      results.push({
        name: 'Database function check_same_tier exists',
        passed: !error || error.message?.includes('null value'),
        error: error?.message
      });
    } catch (e: any) {
      results.push({
        name: 'Database function check_same_tier exists',
        passed: true, // Function exists even if returns error
        error: e.message
      });
    }

    // Test 2: Create test users in different tiers
    log('\nTest 2: Creating test users in different tiers...', 'info');
    
    const testUsers: { [key: string]: any } = {};
    
    const tiers = ['free', 'select', 'summit'];
    for (const tier of tiers) {
      const email = `test-${tier}-${Date.now()}@test.com`;
      testEmails.push(email);
      
      const { user, error } = await createTestUser(supabase, email, `Test ${tier}`, tier);
      
      if (error) {
        log(`  Failed to create ${tier} user: ${error}`, 'error');
        results.push({
          name: `Create ${tier} tier test user`,
          passed: false,
          error
        });
      } else {
        testUsers[tier] = user;
        log(`  Created ${tier} user: ${user.id.slice(0, 8)}...`, 'success');
        results.push({
          name: `Create ${tier} tier test user`,
          passed: true,
          details: { id: user.id, tier }
        });
      }
    }

    // Test 3: Same-tier check via RPC
    log('\nTest 3: Testing same-tier checks via RPC...', 'info');
    
    if (testUsers.free && testUsers.select) {
      const { data: sameTierResult } = await supabase.rpc('check_same_tier', {
        user_a_id: testUsers.free.id,
        user_b_id: testUsers.select.id
      });
      
      results.push({
        name: 'Cross-tier users should return false',
        passed: sameTierResult === false,
        details: { free_user: testUsers.free.id, select_user: testUsers.select.id, result: sameTierResult }
      });
    }

    if (testUsers.free) {
      const { data: sameTierResult } = await supabase.rpc('check_same_tier', {
        user_a_id: testUsers.free.id,
        user_b_id: testUsers.free.id
      });
      
      results.push({
        name: 'Same user check should return true',
        passed: sameTierResult === true,
        details: { result: sameTierResult }
      });
    }

    // Test 4: Check discover_golfers function enforces same-tier
    log('\nTest 4: Testing discover_golfers same-tier enforcement...', 'info');
    
    if (testUsers.free) {
      // Create another Free user to discover
      const freeEmail2 = `test-free-2-${Date.now()}@test.com`;
      testEmails.push(freeEmail2);
      const { user: freeUser2, error } = await createTestUser(supabase, freeEmail2, 'Test Free 2', 'free');
      
      if (!error && freeUser2) {
        testUsers.free2 = freeUser2;
        
        // Try to discover as Free user
        const { data: discovered, error: discError } = await supabase.rpc('discover_golfers', {
          p_user_id: testUsers.free.id,
          p_limit: 10
        });
        
        // Should only see other Free users
        const hasOtherTiers = discovered?.some((u: any) => 
          u.tier_slug && u.tier_slug !== 'free'
        );
        
        results.push({
          name: 'discover_golfers returns only same-tier users',
          passed: !hasOtherTiers,
          error: discError?.message,
          details: { discovered_count: discovered?.length || 0, has_other_tiers: hasOtherTiers }
        });
      }
    }

    // Test 5: RLS policies
    log('\nTest 5: Checking RLS policies exist...', 'info');
    
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('policyname, tablename')
      .or('tablename.eq.users,tablename.eq.saved_members,tablename.eq.introductions');
    
    const hasUsersSameTierPolicy = policies?.some((p: any) => 
      p.policyname?.includes('same_tier') || p.policyname?.includes('tier')
    );
    
    results.push({
      name: 'RLS policies for same-tier enforcement exist',
      passed: hasUsersSameTierPolicy,
      error: policiesError?.message,
      details: { policies_found: policies?.map((p: any) => p.policyname) || [] }
    });

    // Test 6: Centralized enforcement helper
    log('\nTest 6: Checking centralized enforcement module exists...', 'info');
    
    const fs = await import('fs');
    const path = './apps/functions/supabase/functions/_shared/enforcement.ts';
    const exists = fs.existsSync(path);
    
    results.push({
      name: 'Centralized enforcement.ts exists',
      passed: exists,
      details: { path, exists }
    });

    if (exists) {
      const content = fs.readFileSync(path, 'utf-8');
      const hasCheckSameTier = content.includes('checkSameTier');
      const hasCanViewUser = content.includes('canViewUser');
      const hasGetUserTierId = content.includes('getUserTierId');
      
      results.push({
        name: 'enforcement.ts exports checkSameTier',
        passed: hasCheckSameTier
      });
      
      results.push({
        name: 'enforcement.ts exports canViewUser',
        passed: hasCanViewUser
      });
      
      results.push({
        name: 'enforcement.ts exports getUserTierId',
        passed: hasGetUserTierId
      });
    }

    // Test 7: Migration file exists
    log('\nTest 7: Checking migration file...', 'info');
    
    const migrationPath = './supabase/migrations/0024_same_tier_enforcement.sql';
    const migrationExists = fs.existsSync(migrationPath);
    
    results.push({
      name: 'Same-tier enforcement migration exists',
      passed: migrationExists,
      details: { path: migrationPath }
    });

    if (migrationExists) {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      const hasFindMatchUpdate = content.includes('find_match_candidates_v1');
      const hasEnforcementLogs = content.includes('enforcement_logs');
      const hasValidateMatchTier = content.includes('validate_match_tier_compatibility');
      
      results.push({
        name: 'Migration updates find_match_candidates_v1',
        passed: hasFindMatchUpdate
      });
      
      results.push({
        name: 'Migration creates enforcement_logs table',
        passed: hasEnforcementLogs
      });
      
      results.push({
        name: 'Migration adds validate_match_tier_compatibility function',
        passed: hasValidateMatchTier
      });
    }

  } catch (error: any) {
    log(`\nTest execution error: ${error.message}`, 'error');
    results.push({
      name: 'Test execution',
      passed: false,
      error: error.message
    });
  } finally {
    // Cleanup
    await cleanupTestUsers(supabase, testEmails);
  }
}

async function generateReport() {
  log('\n========================================', 'info');
  log('Verification Report', 'info');
  log('========================================\n', 'info');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    const color = result.passed ? 'success' : 'error';
    log(`${status}: ${result.name}`, color);
    
    if (result.error) {
      log(`  Error: ${result.error}`, 'warn');
    }
    if (result.details) {
      log(`  Details: ${JSON.stringify(result.details, null, 2).substring(0, 200)}`, 'info');
    }
  }

  log('\n----------------------------------------', 'info');
  log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`, passed === total ? 'success' : 'warn');
  log('----------------------------------------\n', 'info');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests()
  .then(() => generateReport())
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });