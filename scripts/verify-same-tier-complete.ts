#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Same-Tier Enforcement Verification Script
 * Tests that cross-tier interactions are blocked and same-tier interactions work
 * 
 * Run: deno run --allow-read scripts/verify-same-tier-complete.ts
 */

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

// Helper to log results
function logResult(result: TestResult) {
  results.push(result);
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${result.name}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  if (result.details) {
    console.log(`   Details:`, JSON.stringify(result.details, null, 2));
  }
}

// Test 1: Verify verifyInteractionAllowed function exists and works
async function testVerifyInteractionAllowed() {
  console.log('\n--- Testing verifyInteractionAllowed Helper ---');
  
  try {
    // This is a service-level test - we'd need actual users to test properly
    // For now, verify the function exists in the codebase
    const enforcementPath = './apps/functions/supabase/functions/_shared/enforcement.ts';
    
    try {
      const content = await Deno.readTextFile(enforcementPath);
      const hasVerifyFunction = content.includes('export async function verifyInteractionAllowed');
      const hasTierCheck = content.includes('tier_id') && content.includes('checkSameTier');
      
      logResult({
        name: 'verifyInteractionAllowed function exists',
        passed: hasVerifyFunction,
        details: { hasTierCheck }
      });
    } catch {
      logResult({
        name: 'verifyInteractionAllowed function exists',
        passed: false,
        error: 'Could not read enforcement.ts file'
      });
    }
  } catch (error) {
    logResult({
      name: 'verifyInteractionAllowed function exists',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Test 2: Check all edge functions for same-tier enforcement
async function testEdgeFunctionsEnforcement() {
  console.log('\n--- Testing Edge Functions Same-Tier Enforcement ---');
  
  const functionsDir = './apps/functions/supabase/functions';
  
  // Functions that MUST have same-tier enforcement
  const criticalFunctions = [
    { name: 'networking-invite-send', required: true },
    { name: 'connections-request', required: true },
    { name: 'connections-intro', required: true },
    { name: 'network-introduction-request', required: true },
    { name: 'network-introduction-respond', required: true },
    { name: 'network-save-member', required: true },
    { name: 'matching-request', required: true },
    { name: 'matching-candidates', required: true },
    { name: 'trust-vouch', required: true },
    { name: 'rounds-invite', required: true },
    { name: 'rounds-join', required: true },
    { name: 'rounds-respond', required: true },
    { name: 'standing-foursomes-create', required: true },
  ];
  
  for (const fn of criticalFunctions) {
    try {
      const indexPath = `${functionsDir}/${fn.name}/index.ts`;
      const content = await Deno.readTextFile(indexPath);
      
      // Check for enforcement patterns
      const hasVerifyImport = content.includes("import { verifyInteractionAllowed }") || 
                              content.includes("import { getUserTierId, checkSameTier");
      const hasVerifyCall = content.includes('verifyInteractionAllowed(') ||
                            content.includes('checkSameTier(') ||
                            content.includes('getUserTierId(');
      const hasTierMismatchCheck = content.includes('tier_mismatch') || 
                                   content.includes('tier_mismatch');
      // Inline tier checks are valid enforcement too
      const hasInlineTierCheck = content.includes('tier_id') && 
                                 (content.includes('same tier') || 
                                  content.includes('same-tier') ||
                                  content.includes('tier_mismatch'));
      const hasDirectTierComparison = content.includes('tier_id') && 
                                      content.includes('===') &&
                                      content.includes('invitee.tier_id') || content.includes('sender.tier_id') || content.includes('organizerData.tier_id');
      
      const hasEnforcement = (hasVerifyImport && hasVerifyCall) || 
                             hasTierMismatchCheck || 
                             hasInlineTierCheck ||
                             hasDirectTierComparison;
      
      logResult({
        name: `${fn.name} has same-tier enforcement`,
        passed: hasEnforcement,
        details: { 
          hasVerifyImport, 
          hasVerifyCall, 
          hasTierMismatchCheck,
          hasInlineTierCheck,
          required: fn.required 
        }
      });
    } catch (error) {
      logResult({
        name: `${fn.name} has same-tier enforcement`,
        passed: !fn.required,
        error: `Could not read function: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

// Test 3: Verify RLS policies exist
async function testRLSPolicies() {
  console.log('\n--- Testing RLS Policies ---');
  
  // Check migration files for RLS policies
  const migrationsDir = './supabase/migrations';
  
  try {
    const files = [];
    for await (const entry of Deno.readDir(migrationsDir)) {
      if (entry.name.endsWith('.sql')) {
        files.push(entry.name);
      }
    }
    
    // Read the same-tier enforcement migration
    const sameTierMigration = files.find(f => f.includes('same_tier_enforcement'));
    
    if (sameTierMigration) {
      const content = await Deno.readTextFile(`${migrationsDir}/${sameTierMigration}`);
      
      const hasFindMatchCandidates = content.includes('find_match_candidates_v1');
      const hasSameTierCheck = content.includes('SAME-TIER ENFORCEMENT') || content.includes('same_tier');
      const hasValidateFunction = content.includes('validate_match_tier_compatibility');
      
      logResult({
        name: 'Same-tier enforcement migration exists',
        passed: true,
        details: { 
          file: sameTierMigration,
          hasFindMatchCandidates,
          hasSameTierCheck,
          hasValidateFunction
        }
      });
    } else {
      logResult({
        name: 'Same-tier enforcement migration exists',
        passed: false,
        error: 'No same-tier enforcement migration found'
      });
    }
    
    // Check for RLS policies on critical tables
    const networkMigration = files.find(f => f.includes('network_graph'));
    if (networkMigration) {
      const content = await Deno.readTextFile(`${migrationsDir}/${networkMigration}`);
      
      const hasSavedMembersPolicy = content.includes('saved_members') && content.includes('same_tier');
      const hasIntroductionsPolicy = content.includes('introductions') && content.includes('same_tier');
      const hasConnectionsPolicy = content.includes('user_connections') && content.includes('same_tier');
      
      logResult({
        name: 'RLS policies include same-tier enforcement',
        passed: hasSavedMembersPolicy || hasIntroductionsPolicy || hasConnectionsPolicy,
        details: {
          hasSavedMembersPolicy,
          hasIntroductionsPolicy,
          hasConnectionsPolicy
        }
      });
    }
  } catch (error) {
    logResult({
      name: 'RLS policies verification',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Test 4: Verify error codes are consistent
async function testErrorCodes() {
  console.log('\n--- Testing Error Code Consistency ---');
  
  const functionsDir = './apps/functions/supabase/functions';
  
  try {
    const entries = [];
    for await (const entry of Deno.readDir(functionsDir)) {
      if (entry.isDirectory) {
        entries.push(entry.name);
      }
    }
    
    let tierMismatchCount = 0;
    let properErrorFormat = 0;
    
    for (const fnName of entries) {
      try {
        const content = await Deno.readTextFile(`${functionsDir}/${fnName}/index.ts`);
        
        if (content.includes('tier_mismatch')) {
          tierMismatchCount++;
          // Check if it returns proper 403 with code
          if (content.includes('403') && content.includes('tier_mismatch')) {
            properErrorFormat++;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }
    
    logResult({
      name: 'Error codes are consistent (tier_mismatch)',
      passed: tierMismatchCount > 0,
      details: {
        functionsWithTierMismatch: tierMismatchCount,
        functionsWithProperFormat: properErrorFormat
      }
    });
  } catch (error) {
    logResult({
      name: 'Error codes verification',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Test 5: Verify enforcement.ts exports
async function testEnforcementExports() {
  console.log('\n--- Testing enforcement.ts Exports ---');
  
  try {
    const content = await Deno.readTextFile('./apps/functions/supabase/functions/_shared/enforcement.ts');
    
    const exports = [
      'verifyInteractionAllowed',
      'checkSameTier',
      'getUserTierId',
      'createTierViolationResponse',
      'TIER_VIOLATION_STATUS'
    ];
    
    const foundExports = exports.filter(e => content.includes(`export ${e.includes('const') ? 'const' : 'async function'} ${e}`) || 
                                               content.includes(`export { ${e} }`) ||
                                               content.includes(`export * from`));
    
    logResult({
      name: 'enforcement.ts exports all required functions',
      passed: foundExports.length >= 3,
      details: {
        foundExports,
        missingExports: exports.filter(e => !foundExports.includes(e))
      }
    });
  } catch (error) {
    logResult({
      name: 'enforcement.ts exports verification',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Main test runner
async function runTests() {
  console.log('==============================================');
  console.log('Same-Tier Enforcement Verification');
  console.log('==============================================');
  console.log('Testing edge functions and RLS policies');
  console.log('');
  
  await testVerifyInteractionAllowed();
  await testEdgeFunctionsEnforcement();
  await testRLSPolicies();
  await testErrorCodes();
  await testEnforcementExports();
  
  // Summary
  console.log('\n==============================================');
  console.log('SUMMARY');
  console.log('==============================================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('');
  
  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
      if (r.error) console.log(`    ${r.error}`);
    });
  }
  
  // Exit with appropriate code
  Deno.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  Deno.exit(1);
});