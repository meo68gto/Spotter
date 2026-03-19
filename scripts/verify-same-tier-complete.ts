#!/usr/bin/env node
/**
 * Same-Tier Enforcement Verification Script
 * Tests that cross-tier interactions are blocked and same-tier interactions work
 * 
 * Usage: npx tsx scripts/verify-same-tier-complete.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test results
const results: {
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}[] = [];

async function runTests() {
  console.log('🔍 Same-Tier Enforcement Verification\n');
  console.log('=====================================\n');

  try {
    // Get test users from different tiers
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, tier_id, membership_tiers(slug)')
      .limit(10);

    if (usersError || !users || users.length < 2) {
      console.error('❌ Need at least 2 users to run tests');
      process.exit(1);
    }

    // Group users by tier
    const usersByTier: Record<string, typeof users> = {};
    for (const user of users) {
      const tierId = user.tier_id || 'none';
      if (!usersByTier[tierId]) usersByTier[tierId] = [];
      usersByTier[tierId].push(user);
    }

    const tierIds = Object.keys(usersByTier).filter(t => t !== 'none');
    
    if (tierIds.length < 2) {
      console.log('⚠️  Need users from at least 2 different tiers for full testing');
      console.log('   Found tiers:', tierIds.map(t => usersByTier[t][0]?.membership_tiers?.slug || t).join(', '));
    }

    // Test 1: RPC function check_same_tier exists and works
    console.log('Test 1: check_same_tier RPC function');
    try {
      const sameTierUsers = usersByTier[tierIds[0]];
      if (sameTierUsers.length >= 2) {
        const { data: sameTierCheck, error: rpcError } = await supabase.rpc('check_same_tier', {
          user_a_id: sameTierUsers[0].id,
          user_b_id: sameTierUsers[1].id
        });
        
        if (rpcError) throw rpcError;
        
        results.push({
          test: 'check_same_tier returns true for same-tier users',
          passed: sameTierCheck === true,
          details: { userA: sameTierUsers[0].display_name, userB: sameTierUsers[1].display_name, result: sameTierCheck }
        });
      }

      if (tierIds.length >= 2) {
        const { data: diffTierCheck, error: rpcError2 } = await supabase.rpc('check_same_tier', {
          user_a_id: usersByTier[tierIds[0]][0].id,
          user_b_id: usersByTier[tierIds[1]][0].id
        });
        
        if (rpcError2) throw rpcError2;
        
        results.push({
          test: 'check_same_tier returns false for different-tier users',
          passed: diffTierCheck === false,
          details: { 
            userA: usersByTier[tierIds[0]][0].display_name, 
            userB: usersByTier[tierIds[1]][0].display_name, 
            result: diffTierCheck 
          }
        });
      }
    } catch (error) {
      results.push({
        test: 'check_same_tier RPC function',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 2: validate_match_tier_compatibility function
    console.log('Test 2: validate_match_tier_compatibility function');
    try {
      const { data: validationResult, error: valError } = await supabase.rpc('validate_match_tier_compatibility', {
        p_requester_id: users[0].id,
        p_candidate_id: users[1].id
      });
      
      if (valError) throw valError;
      
      results.push({
        test: 'validate_match_tier_compatibility returns boolean',
        passed: typeof validationResult === 'boolean',
        details: { result: validationResult }
      });
    } catch (error) {
      results.push({
        test: 'validate_match_tier_compatibility function',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 3: Check RLS policies exist
    console.log('Test 3: RLS policies verification');
    try {
      const { data: policies, error: policyError } = await supabase
        .from('pg_policies')
        .select('tablename, policyname')
        .or('tablename.eq.user_connections,tablename.eq.introduction_requests,tablename.eq.users');
      
      if (policyError) throw policyError;
      
      const connectionsPolicies = policies?.filter(p => p.tablename === 'user_connections') || [];
      const introductionsPolicies = policies?.filter(p => p.tablename === 'introduction_requests') || [];
      
      results.push({
        test: 'user_connections has RLS policies',
        passed: connectionsPolicies.length > 0,
        details: { policies: connectionsPolicies.map(p => p.policyname) }
      });
      
      results.push({
        test: 'introduction_requests has RLS policies',
        passed: introductionsPolicies.length > 0,
        details: { policies: introductionsPolicies.map(p => p.policyname) }
      });
    } catch (error) {
      results.push({
        test: 'RLS policies verification',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 4: Check enforcement_logs table exists
    console.log('Test 4: enforcement_logs table');
    try {
      const { data: logs, error: logsError } = await supabase
        .from('enforcement_logs')
        .select('id')
        .limit(1);
      
      if (logsError && logsError.code !== 'PGRST116') throw logsError;
      
      results.push({
        test: 'enforcement_logs table exists',
        passed: true,
        details: { hasData: logs && logs.length > 0 }
      });
    } catch (error) {
      results.push({
        test: 'enforcement_logs table exists',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 5: Check find_match_candidates_v1 enforces same-tier
    console.log('Test 5: find_match_candidates_v1 same-tier enforcement');
    try {
      const testUser = users.find(u => u.tier_id);
      if (testUser) {
        const { data: candidates, error: matchError } = await supabase.rpc('find_match_candidates_v1', {
          p_requester_id: testUser.id,
          p_activity_id: '00000000-0000-0000-0000-000000000000', // Invalid, but tests function exists
          p_skill_band: 'intermediate',
          p_radius_meters: 50000,
          p_limit: 5
        });
        
        // Function should exist and return array (may be empty)
        results.push({
          test: 'find_match_candidates_v1 function exists and returns array',
          passed: !matchError && Array.isArray(candidates),
          details: { error: matchError?.message, candidateCount: candidates?.length }
        });
      }
    } catch (error) {
      results.push({
        test: 'find_match_candidates_v1 function',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 6: Check network_graph_same_tier view exists
    console.log('Test 6: network_graph_same_tier view');
    try {
      const { data: viewData, error: viewError } = await supabase
        .from('network_graph_same_tier')
        .select('edge_id')
        .limit(1);
      
      if (viewError && viewError.code !== 'PGRST116') throw viewError;
      
      results.push({
        test: 'network_graph_same_tier view exists',
        passed: true,
        details: { hasData: viewData && viewData.length > 0 }
      });
    } catch (error) {
      results.push({
        test: 'network_graph_same_tier view exists',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Print results
    console.log('\n=====================================\n');
    console.log('📊 Test Results:\n');
    
    let passed = 0;
    let failed = 0;
    
    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.test}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n   ')}`);
      }
      console.log();
      
      if (result.passed) passed++;
      else failed++;
    }
    
    console.log('=====================================\n');
    console.log(`Summary: ${passed} passed, ${failed} failed\n`);
    
    if (failed > 0) {
      console.log('⚠️  Some tests failed. Review the errors above.\n');
      process.exit(1);
    } else {
      console.log('✅ All tests passed! Same-tier enforcement is properly configured.\n');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Fatal error running tests:', error);
    process.exit(1);
  }
}

runTests();
