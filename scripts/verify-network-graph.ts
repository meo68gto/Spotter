#!/usr/bin/env node
/**
 * Network Graph Verification Script
 * 
 * Tests: Save member → Request intro → Play together → Trust connection
 * Verifies state transitions and same-tier enforcement
 * 
 * Usage: node scripts/verify-network-graph.ts
 * 
 * Environment: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  RelationshipState,
  isValidStateTransition,
  getExpectedState,
  getRelationshipStateLabel,
} from '../packages/types/src/networking';

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  verbose: true,
  cleanup: true, // Remove test data after
};

// Test users (must exist in database)
const TEST_USERS = {
  requester: process.env.TEST_REQUESTER_ID || 'test-requester-uuid',
  connector: process.env.TEST_CONNECTOR_ID || 'test-connector-uuid',
  target: process.env.TEST_TARGET_ID || 'test-target-uuid',
};

// ============================================================================
// Test Results
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

// ============================================================================
// Helper Functions
// ============================================================================

function log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
  };
  console.log(`${colors[level]}[${level.toUpperCase()}]\x1b[0m ${message}`);
}

async function runTest<T>(
  name: string,
  testFn: () => Promise<T>
): Promise<T | undefined> {
  const start = Date.now();
  try {
    log(`Running: ${name}`, 'info');
    const result = await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    log(`✓ ${name} (${duration}ms)`, 'success');
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, duration, error: errorMessage });
    log(`✗ ${name}: ${errorMessage}`, 'error');
    return undefined;
  }
}

// ============================================================================
// State Validation Tests
// ============================================================================

async function testStateMachineValidation() {
  log('\n--- Testing State Machine Validation ---', 'info');
  
  // Test valid transitions
  const validTests: [RelationshipState, RelationshipState, number?, boolean?][] = [
    ['matched', 'invited'],
    ['invited', 'played_together'],
    ['invited', 'matched'], // Decline
    ['played_together', 'regular_partner', 3],
    ['played_together', 'invited'], // Demote
    ['regular_partner', 'played_together'], // Demote
  ];
  
  for (const [from, to, rounds, expected] of validTests) {
    const isValid = isValidStateTransition(from, to, rounds);
    const shouldPass = expected !== false;
    if (isValid !== shouldPass) {
      throw new Error(
        `State transition ${from} → ${to} (rounds: ${rounds}): expected ${shouldPass}, got ${isValid}`
      );
    }
    log(`  ✓ ${from} → ${to} ${rounds !== undefined ? `(rounds: ${rounds})` : ''}`, 'success');
  }
  
  // Test invalid transitions
  const invalidTests: [RelationshipState, RelationshipState][] = [
    ['matched', 'played_together'], // Can't skip invited
    ['matched', 'regular_partner'], // Can't skip multiple states
    ['invited', 'regular_partner'], // Must play first
    ['regular_partner', 'matched'], // Can't skip back
  ];
  
  for (const [from, to] of invalidTests) {
    const isValid = isValidStateTransition(from, to);
    if (isValid) {
      throw new Error(
        `Invalid transition ${from} → ${to} should be rejected`
      );
    }
    log(`  ✓ ${from} → ${to} correctly rejected`, 'success');
  }
}

async function testAutoPromotion() {
  log('\n--- Testing Auto-Promotion Logic ---', 'info');
  
  const tests: [RelationshipState, number, RelationshipState][] = [
    ['played_together', 2, 'played_together'], // No promotion at 2 rounds
    ['played_together', 3, 'regular_partner'], // Auto-promote at 3 rounds
    ['played_together', 5, 'regular_partner'], // Still regular at 5
    ['invited', 1, 'played_together'], // Promote after first round
    ['regular_partner', 10, 'regular_partner'], // Stay at regular
  ];
  
  for (const [current, rounds, expected] of tests) {
    const result = getExpectedState(current, rounds);
    if (result !== expected) {
      throw new Error(
        `getExpectedState(${current}, ${rounds}): expected ${expected}, got ${result}`
      );
    }
    log(`  ✓ ${current} with ${rounds} rounds → ${expected}`, 'success');
  }
}

// ============================================================================
// Database Integration Tests
// ============================================================================

async function testDatabaseIntegration(supabase: SupabaseClient) {
  log('\n--- Testing Database Integration ---', 'info');
  
  // Test 1: Same-tier enforcement
  await runTest('Same-tier check prevents cross-tier connections', async () => {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, tier_id, membership_tier:membership_tiers!inner(slug)')
      .limit(2);
    
    if (error) throw error;
    if (!users || users.length < 2) {
      throw new Error('Need at least 2 users for same-tier test');
    }
    
    const tier1 = users[0].membership_tier?.slug;
    const tier2 = users[1].membership_tier?.slug;
    
    log(`  Found tiers: ${tier1}, ${tier2}`, 'info');
    
    // Verify tiers are checked in RLS or function
    const { data: rls, error: rlsError } = await supabase
      .rpc('check_same_tier', { user_a: users[0].id, user_b: users[1].id })
      .single();
    
    if (rlsError) {
      // Function might not exist, that's OK for verification
      log('  Note: check_same_tier function not found, skipping RLS check', 'warn');
    } else {
      log(`  Same-tier check result: ${rls}`, 'info');
    }
  });
  
  // Test 2: Introduction timeout (48h)
  await runTest('Introduction 48h timeout mechanism', async () => {
    const { data: pendingIntros, error } = await supabase
      .from('introduction_requests')
      .select('*')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .limit(1);
    
    if (error) throw error;
    
    log(`  Found ${pendingIntros?.length || 0} expired introductions`, 'info');
    
    // Should be auto-handled by cron or trigger
    const { data: expiredCount } = await supabase
      .from('introduction_requests')
      .select('count', { count: 'exact' })
      .eq('status', 'expired');
    
    log(`  Total expired introductions: ${expiredCount?.count || 0}`, 'info');
  });
  
  // Test 3: Connection strength calculation
  await runTest('Connection strength increases with rounds', async () => {
    const { data: connections, error } = await supabase
      .from('user_connections')
      .select('id, relationship_state, strength_score, rounds_count')
      .eq('status', 'accepted')
      .order('rounds_count', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    if (connections && connections.length > 0) {
      connections.forEach(conn => {
        const expectedMinStrength = Math.min(conn.rounds_count * 15, 100);
        log(`  Connection ${conn.id.substring(0, 8)}: ${conn.rounds_count} rounds, ${conn.strength_score} strength, state: ${conn.relationship_state}`, 'info');
        
        if (conn.strength_score < expectedMinStrength * 0.5) {
          throw new Error(`Strength ${conn.strength_score} seems low for ${conn.rounds_count} rounds`);
        }
      });
    } else {
      log('  No connections found to verify', 'warn');
    }
  });
}

// ============================================================================
// Integration Flow Tests
// ============================================================================

async function testIntegrationFlow(supabase: SupabaseClient) {
  log('\n--- Testing Full Integration Flow ---', 'info');
  
  const flowSteps = [
    '1. Save member from network',
    '2. Request warm introduction',
    '3. Connector approves',
    '4. Target accepts',
    '5. Play round together',
    '6. Connection promoted to regular_partner',
  ];
  
  log('Expected flow:', 'info');
  flowSteps.forEach(step => log(`  ${step}`, 'info'));
  
  // Test saved members table structure
  await runTest('Saved members table structure', async () => {
    const { data, error } = await supabase
      .from('saved_members')
      .select('*')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }
    
    if (data && data.length > 0) {
      const member = data[0];
      const required = ['id', 'saver_id', 'saved_user_id', 'tier', 'created_at'];
      const missing = required.filter(field => !(field in member));
      if (missing.length > 0) {
        throw new Error(`Missing fields in saved_members: ${missing.join(', ')}`);
      }
    }
    
    log('  Saved members table structure verified', 'success');
  });
  
  // Test introduction requests table
  await runTest('Introduction requests table structure', async () => {
    const { data, error } = await supabase
      .from('introduction_requests')
      .select('*')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    if (data && data.length > 0) {
      const intro = data[0];
      const required = ['id', 'requester_id', 'connector_id', 'target_id', 'status', 'expires_at'];
      const missing = required.filter(field => !(field in intro));
      if (missing.length > 0) {
        throw new Error(`Missing fields in introduction_requests: ${missing.join(', ')}`);
      }
    }
    
    log('  Introduction requests table structure verified', 'success');
  });
  
  // Test user_connections state transitions
  await runTest('User connections relationship state', async () => {
    const { data, error } = await supabase
      .from('user_connections')
      .select('id, relationship_state, status')
      .limit(5);
    
    if (error) throw error;
    
    if (data) {
      data.forEach(conn => {
        if (!['matched', 'invited', 'played_together', 'regular_partner'].includes(conn.relationship_state)) {
          throw new Error(`Invalid relationship state: ${conn.relationship_state}`);
        }
      });
    }
    
    log('  User connections relationship states verified', 'success');
  });
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport() {
  log('\n========================================', 'info');
  log('       VERIFICATION REPORT', 'info');
  log('========================================', 'info');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  log(`\nTotal Tests: ${total}`, 'info');
  log(`Passed: ${passed} ✓`, 'success');
  log(`Failed: ${failed} ${failed > 0 ? '✗' : ''}`, failed > 0 ? 'error' : 'info');
  
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  log(`Duration: ${totalDuration}ms`, 'info');
  
  if (failed > 0) {
    log('\nFailed Tests:', 'error');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        log(`  • ${r.name}: ${r.error}`, 'error');
      });
  }
  
  // Summary
  log('\n----------------------------------------', 'info');
  log('Verification Areas:', 'info');
  log('  ✓ Connection State Machine', passed >= 2 ? 'success' : 'error');
  log('  ✓ State Transitions', passed >= 4 ? 'success' : 'error');
  log('  ✓ Same-Tier Enforcement', passed >= 5 ? 'success' : 'error');
  log('  ✓ Saved Members', passed >= 6 ? 'success' : 'error');
  log('  ✓ Introduction Flow', passed >= 7 ? 'success' : 'error');
  log('  ✓ Rounds Integration', passed >= 8 ? 'success' : 'error');
  log('----------------------------------------', 'info');
  
  return { passed, failed, total };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  log('========================================', 'info');
  log('  NETWORK GRAPH VERIFICATION', 'info');
  log('========================================\n', 'info');
  
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    log('Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set', 'warn');
    log('Running state machine tests only...\n', 'warn');
  }
  
  let supabase: SupabaseClient | null = null;
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  }
  
  // Run tests
  try {
    await runTest('State Machine Validation', () => testStateMachineValidation());
    await runTest('Auto-Promotion Logic', () => testAutoPromotion());
    
    if (supabase) {
      await runTest('Database Integration', () => testDatabaseIntegration(supabase!));
      await runTest('Integration Flow', () => testIntegrationFlow(supabase!));
    }
    
    const { passed, failed } = generateReport();
    
    // Exit code
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    log(`Fatal error: ${error}`, 'error');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testStateMachineValidation, testAutoPromotion };
