#!/usr/bin/env node
// ============================================================================
// Epic 1 Code Alignment Verification
// Validates that all 12 fields are properly wired through the stack
// ============================================================================

const fs = require('fs');
const path = require('path');

// The 12 required fields from Epic 1
const REQUIRED_FIELDS = [
  { name: 'membership_tier', dbTable: 'users', dbColumn: 'tier_id', type: 'string' },
  { name: 'handicap_band', dbTable: 'user_golf_identities', dbColumn: 'handicap_band', type: 'string' },
  { name: 'home_course_area', dbTable: 'user_golf_identities', dbColumn: 'home_course_area', type: 'string' },
  { name: 'preferred_tee_time_window', dbTable: 'user_networking_preferences', dbColumn: 'preferred_tee_time_window', type: 'string' },
  { name: 'mobility_preference', dbTable: 'user_networking_preferences', dbColumn: 'mobility_preference', type: 'string' },
  { name: 'networking_intent', dbTable: 'user_networking_preferences', dbColumn: 'networking_intent', type: 'string' },
  { name: 'industry', dbTable: 'user_networking_preferences', dbColumn: 'industry', type: 'string' },
  { name: 'company', dbTable: 'user_networking_preferences', dbColumn: 'company', type: 'string' },
  { name: 'title_or_role', dbTable: 'user_networking_preferences', dbColumn: 'title_or_role', type: 'string' },
  { name: 'open_to_introductions', dbTable: 'user_networking_preferences', dbColumn: 'open_to_intros', type: 'boolean' },
  { name: 'open_to_recurring_rounds', dbTable: 'user_networking_preferences', dbColumn: 'open_to_recurring_rounds', type: 'boolean' },
  { name: 'preferred_group_size', dbTable: 'user_networking_preferences', dbColumn: 'preferred_group_size', type: 'string' },
  { name: 'round_frequency', dbTable: 'user_networking_preferences', dbColumn: 'round_frequency', type: 'string' },
];

const REPO_ROOT = '/Users/brucewayne/Documents/Spotter';

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

function checkFieldInFile(filePath, fieldName, variations) {
  const content = readFile(filePath);
  if (!content) return { found: false, error: 'File not found' };
  
  const searchTerms = [fieldName, ...variations];
  const found = searchTerms.some(term => content.includes(term));
  return { found, error: found ? null : `Field "${fieldName}" not found` };
}

function runAudit() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Epic 1 Code Alignment Audit                                ║');
  console.log('║     Checking all 12 fields across the stack                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const results = {
    database: [],
    edgeFunction: [],
    types: [],
    frontend: [],
  };
  
  // 1. Check Database Migration
  console.log('📋 Step 1: Checking database migrations...');
  const migrationFiles = [
    path.join(REPO_ROOT, 'supabase/migrations/20250319103100_epic1_consolidated_fields.sql'),
    path.join(REPO_ROOT, 'supabase/migrations/20250319120000_epic1_gap_closure.sql'),
  ];
  
  for (const field of REQUIRED_FIELDS) {
    let found = false;
    for (const migrationFile of migrationFiles) {
      const content = readFile(migrationFile);
      if (content && content.includes(field.dbColumn)) {
        found = true;
        break;
      }
    }
    results.database.push({ field: field.name, found, column: field.dbColumn });
  }
  
  // 2. Check Edge Function
  console.log('📋 Step 2: Checking edge function...');
  const edgeFunctionPath = path.join(REPO_ROOT, 'apps/functions/supabase/functions/onboarding-phase1/index.ts');
  const edgeContent = readFile(edgeFunctionPath);
  
  for (const field of REQUIRED_FIELDS) {
    const variations = [
      field.name,
      field.dbColumn,
      field.name.replace(/_/g, ''),
      field.name.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase()),
    ];
    const { found } = checkFieldInFile(edgeFunctionPath, field.name, variations);
    results.edgeFunction.push({ field: field.name, found });
  }
  
  // 3. Check Shared Types
  console.log('📋 Step 3: Checking shared types...');
  const typesFiles = [
    path.join(REPO_ROOT, 'packages/types/src/profile.ts'),
    path.join(REPO_ROOT, 'packages/types/src/networking.ts'),
  ];
  
  for (const field of REQUIRED_FIELDS) {
    let found = false;
    const variations = [
      field.name,
      field.name.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase()),
    ];
    
    for (const typesFile of typesFiles) {
      const { found: f } = checkFieldInFile(typesFile, field.name, variations);
      if (f) {
        found = true;
        break;
      }
    }
    results.types.push({ field: field.name, found });
  }
  
  // 4. Check Frontend
  console.log('📋 Step 4: Checking frontend...');
  const frontendPath = path.join(REPO_ROOT, 'apps/mobile/src/screens/onboarding/OnboardingWizardScreenPhase1.tsx');
  
  for (const field of REQUIRED_FIELDS) {
    const variations = [
      field.name,
      field.name.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase()),
    ];
    const { found } = checkFieldInFile(frontendPath, field.name, variations);
    results.frontend.push({ field: field.name, found });
  }
  
  // Print Results
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('AUDIT RESULTS:');
  console.log('══════════════════════════════════════════════════════════════════\n');
  
  const allResults = [
    ...results.database.map(r => ({ ...r, layer: 'Database' })),
    ...results.edgeFunction.map(r => ({ ...r, layer: 'Edge Function' })),
    ...results.types.map(r => ({ ...r, layer: 'Shared Types' })),
    ...results.frontend.map(r => ({ ...r, layer: 'Frontend' })),
  ];
  
  // Group by field
  const byField = {};
  for (const r of allResults) {
    if (!byField[r.field]) byField[r.field] = [];
    byField[r.field].push(r);
  }
  
  let totalChecks = 0;
  let totalPassed = 0;
  const missingFields = [];
  
  for (const [fieldName, checks] of Object.entries(byField)) {
    const allPassed = checks.every(c => c.found);
    const icon = allPassed ? '✅' : '❌';
    console.log(`${icon} ${fieldName}`);
    
    for (const check of checks) {
      const status = check.found ? '✓' : '✗';
      console.log(`   ${status} ${check.layer}`);
      totalChecks++;
      if (check.found) totalPassed++;
    }
    
    if (!allPassed) {
      missingFields.push(fieldName);
    }
    console.log();
  }
  
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('SUMMARY:');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`Total Checks: ${totalChecks}`);
  console.log(`Passed:       ${totalPassed} ✅`);
  console.log(`Failed:       ${totalChecks - totalPassed} ❌`);
  console.log(`Success Rate: ${((totalPassed / totalChecks) * 100).toFixed(1)}%`);
  
  if (missingFields.length > 0) {
    console.log(`\n⚠️  Fields with gaps: ${missingFields.join(', ')}`);
  }
  
  console.log('\n══════════════════════════════════════════════════════════════════');
  
  if (missingFields.length === 0) {
    console.log('\n✅ ALL FIELDS PROPERLY WIRED - Epic 1 persistence is complete!');
    return 0;
  } else {
    console.log(`\n❌ ${missingFields.length} FIELDS HAVE GAPS - Review above`);
    return 1;
  }
}

// Run audit
const exitCode = runAudit();
process.exit(exitCode);
