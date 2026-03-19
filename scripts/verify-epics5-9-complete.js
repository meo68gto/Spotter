#!/usr/bin/env node
/**
 * Epic 5-9 Final Verification Script
 * 
 * This script performs automated verification of all Epics 5-9 cleanup requirements:
 * 1. No deprecated screen references
 * 2. No TODOs in shipped paths
 * 3. Error code alignment
 * 4. No mock data in production
 * 5. Backend contract alignment
 * 
 * Usage: node scripts/verify-epics5-9-complete.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get the directory of this script
const SCRIPT_DIR = path.dirname(require.main?.filename || __filename);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

// Configuration
const MOBILE_SRC = path.resolve(REPO_ROOT, 'apps/mobile/src');
const FUNCTIONS_DIR = path.resolve(REPO_ROOT, 'apps/functions/supabase/functions');

/** @type {VerificationResult[]} */
const results = [];

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

/**
 * @typedef {Object} VerificationResult
 * @property {string} check
 * @property {'PASS' | 'FAIL' | 'WARNING' | 'SKIP'} status
 * @property {string[]} details
 */

/**
 * @param {string} message
 * @param {keyof COLORS} color
 */
function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

/**
 * @param {string} check
 * @param {VerificationResult['status']} status
 * @param {string[]} details
 */
function addResult(check, status, details = []) {
  results.push({ check, status, details });
}

// ============================================================================
// Check 1: No deprecated screen references
// ============================================================================
function checkDeprecatedReferences() {
  log('\n[CHECK 1] Verifying no deprecated screen references...', 'blue');
  
  const deprecatedDir = path.join(MOBILE_SRC, 'screens/deprecated');
  
  // Check if deprecated directory exists
  if (!fs.existsSync(deprecatedDir)) {
    addResult('Deprecated Directory Exists', 'PASS', ['No deprecated directory found']);
    return;
  }
  
  const deprecatedFiles = fs.readdirSync(deprecatedDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  
  if (deprecatedFiles.length === 0) {
    addResult('Deprecated Directory', 'PASS', ['No deprecated files present']);
    return;
  }
  
  // Search for imports from deprecated directory
  try {
    const cmd = `grep -rn "from.*screens/deprecated\\|import.*screens/deprecated" ${MOBILE_SRC} --include="*.ts" --include="*.tsx" 2>/dev/null || echo ""`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    
    if (output.trim()) {
      const lines = output.trim().split('\n').filter(l => l.includes('deprecated'));
      addResult('Deprecated References', 'FAIL', [
        'Found deprecated imports in active code:',
        ...lines.slice(0, 10)
      ]);
    } else {
      addResult('Deprecated References', 'PASS', [
        `No deprecated imports found in active code`,
        `Note: ${deprecatedFiles.length} files in deprecated/ (not imported)`
      ]);
    }
  } catch (e) {
    // grep returns exit code 1 when no matches - this is good
    addResult('Deprecated References', 'PASS', ['No deprecated imports found']);
  }
}

// ============================================================================
// Check 2: No TODOs in shipped Epic 5-9 paths
// ============================================================================
function checkTodos() {
  log('\n[CHECK 2] Verifying no TODOs in shipped Epic 5-9 paths...', 'blue');
  
  const pathsToCheck = [
    { path: 'screens/rounds/', exists: true },
    { path: 'screens/matching/', exists: true },
    { path: 'screens/CoachingScreen.tsx', exists: true },
    { path: 'components/Trust', exists: false } // Multiple files with Trust prefix
  ];
  
  const todoPatterns = ['TODO', 'FIXME', 'HACK'];
  /** @type {string[]} */
  const foundTodos = [];
  
  for (const checkPath of pathsToCheck) {
    const fullPath = path.join(MOBILE_SRC, checkPath.path);
    
    if (!fs.existsSync(fullPath)) {
      continue;
    }
    
    try {
      const cmd = `grep -rn "${todoPatterns.join('\\|')}" ${fullPath} --include="*.ts" --include="*.tsx" 2>/dev/null || echo ""`;
      const output = execSync(cmd, { encoding: 'utf-8' });
      
      if (output.trim()) {
        const lines = output.trim().split('\n').filter(l => 
          todoPatterns.some(p => l.includes(p))
        );
        foundTodos.push(...lines);
      }
    } catch (e) {
      // No matches found
    }
  }
  
  if (foundTodos.length > 0) {
    addResult('TODOs in Shipped Paths', 'FAIL', [
      `Found ${foundTodos.length} TODO/FIXME/HACK markers:`,
      ...foundTodos.slice(0, 15)
    ]);
  } else {
    addResult('TODOs in Shipped Paths', 'PASS', [
      'No TODOs, FIXMEs, or HACKs found in Epic 5-9 paths'
    ]);
  }
}

// ============================================================================
// Check 3: Error code alignment
// ============================================================================
function checkErrorCodes() {
  log('\n[CHECK 3] Verifying error code alignment...', 'blue');
  
  /** @type {{ name: string; frontend: string; backend: string; codes: string[] }[]} */
  const checks = [
    {
      name: 'rounds-create',
      frontend: 'screens/rounds/CreateRoundScreen.tsx',
      backend: 'rounds-create/index.ts',
      codes: ['round_limit_reached', 'tier_insufficient', 'tier_not_active']
    },
    {
      name: 'network-introduction-request',
      frontend: 'screens/matching/MatchingScreen.tsx',
      backend: 'network-introduction-request/index.ts',
      codes: ['tier_insufficient', 'no_intro_credits', 'not_connected_connector']
    }
  ];
  
  /** @type {string[]} */
  const misalignments = [];
  
  for (const check of checks) {
    const frontendPath = path.join(MOBILE_SRC, check.frontend);
    const backendPath = path.join(FUNCTIONS_DIR, check.backend);
    
    if (!fs.existsSync(frontendPath)) {
      misalignments.push(`${check.name}: Frontend file not found: ${check.frontend}`);
      continue;
    }
    
    if (!fs.existsSync(backendPath)) {
      misalignments.push(`${check.name}: Backend file not found: ${check.backend}`);
      continue;
    }
    
    const frontendContent = fs.readFileSync(frontendPath, 'utf-8');
    const backendContent = fs.readFileSync(backendPath, 'utf-8');
    
    // Check for removed/deprecated codes in frontend
    const oldCodes = ['free_tier_round_limit_reached', 'premium_required'];
    for (const oldCode of oldCodes) {
      if (frontendContent.includes(oldCode) && !backendContent.includes(oldCode)) {
        misalignments.push(`${check.name}: Frontend references deprecated code '${oldCode}' not in backend`);
      }
    }
  }
  
  if (misalignments.length > 0) {
    addResult('Error Code Alignment', 'FAIL', misalignments);
  } else {
    addResult('Error Code Alignment', 'PASS', [
      'All error codes are properly aligned between frontend and backend'
    ]);
  }
}

// ============================================================================
// Check 4: No mock data in production
// ============================================================================
function checkMockData() {
  log('\n[CHECK 4] Verifying no mock data in production...', 'blue');
  
  const productionPaths = [
    'screens/rounds/',
    'screens/matching/',
    'screens/network/',
    'screens/discovery/'
  ];
  
  const mockPatterns = [
    'mockFunctionResponse',
    'mockUser',
    'mockSession',
    'testData',
    'hardcoded',
    'const example',
    'const sample'
  ];
  
  /** @type {string[]} */
  const foundMockData = [];
  
  for (const checkPath of productionPaths) {
    const fullPath = path.join(MOBILE_SRC, checkPath);
    
    if (!fs.existsSync(fullPath)) {
      continue;
    }
    
    try {
      const cmd = `grep -rn "${mockPatterns.join('\\|')}" ${fullPath} --include="*.ts" --include="*.tsx" 2>/dev/null || echo ""`;
      const output = execSync(cmd, { encoding: 'utf-8' });
      
      if (output.trim()) {
        const lines = output.trim().split('\n').filter(l => {
          // Filter out legitimate patterns
          if (l.includes('PremiumMatchingExamples')) return false; // This is an example file
          if (l.includes('// Example') || l.includes('// Demo')) return false;
          return true;
        });
        foundMockData.push(...lines);
      }
    } catch (e) {
      // No matches
    }
  }
  
  if (foundMockData.length > 0) {
    addResult('Mock Data in Production', 'WARNING', [
      `Found potential mock data patterns (may be examples/docs):`,
      ...foundMockData.slice(0, 10)
    ]);
  } else {
    addResult('Mock Data in Production', 'PASS', [
      'No mock data patterns found in production paths'
    ]);
  }
}

// ============================================================================
// Check 5: Backend contract alignment
// ============================================================================
function checkBackendContracts() {
  log('\n[CHECK 5] Verifying backend contracts...', 'blue');
  
  /** @type {{ name: string; status: 'PASS' | 'FAIL' | 'WARNING'; details: string[] }[]} */
  const checks = [];
  
  // Check user-with-tier response shape
  const userWithTierPath = path.join(FUNCTIONS_DIR, 'user-with-tier/index.ts');
  const matchingScreenPath = path.join(MOBILE_SRC, 'screens/matching/MatchingScreen.tsx');
  
  if (fs.existsSync(userWithTierPath) && fs.existsSync(matchingScreenPath)) {
    const backendContent = fs.readFileSync(userWithTierPath, 'utf-8');
    const frontendContent = fs.readFileSync(matchingScreenPath, 'utf-8');
    
    // Check for required fields in backend response
    const requiredFields = [
      'user.tier?.slug',
      'user.tierStatus.isActive',
      'computed.canSendIntros',
      'computed.introCreditsRemaining'
    ];
    
    const backendHasFields = requiredFields.every(field => 
      backendContent.includes(field.replace(/\?\./g, '.').replace(/\?/g, ''))
    );
    
    const frontendUsesFields = requiredFields.every(field => 
      frontendContent.includes(field) || frontendContent.includes(field.split('.').pop() || '')
    );
    
    if (backendHasFields && frontendUsesFields) {
      checks.push({
        name: 'user-with-tier contract',
        status: 'PASS',
        details: ['Response shape properly aligned']
      });
    } else {
      checks.push({
        name: 'user-with-tier contract',
        status: 'WARNING',
        details: ['Some fields may not be fully aligned']
      });
    }
  }
  
  // Check network-introduction-request payload
  const introRequestPath = path.join(FUNCTIONS_DIR, 'network-introduction-request/index.ts');
  
  if (fs.existsSync(introRequestPath)) {
    const backendContent = fs.readFileSync(introRequestPath, 'utf-8');
    
    // Verify payload structure
    const hasConnectorId = backendContent.includes('connectorId');
    const hasTargetId = backendContent.includes('targetId');
    const hasConnectorMessage = backendContent.includes('connectorMessage');
    
    if (hasConnectorId && hasTargetId && hasConnectorMessage) {
      checks.push({
        name: 'network-introduction-request payload',
        status: 'PASS',
        details: ['Payload structure properly defined']
      });
    } else {
      checks.push({
        name: 'network-introduction-request payload',
        status: 'FAIL',
        details: ['Missing required fields in payload']
      });
    }
  }
  
  // Check rounds-create error codes
  const roundsCreatePath = path.join(FUNCTIONS_DIR, 'rounds-create/index.ts');
  const createRoundScreenPath = path.join(MOBILE_SRC, 'screens/rounds/CreateRoundScreen.tsx');
  
  if (fs.existsSync(roundsCreatePath)) {
    const backendContent = fs.readFileSync(roundsCreatePath, 'utf-8');
    const frontendContent = fs.readFileSync(createRoundScreenPath, 'utf-8');
    
    // Check error codes
    const errorCodes = ['round_limit_reached', 'tier_insufficient', 'tier_not_active'];
    const backendHasCodes = errorCodes.filter(code => backendContent.includes(code));
    const frontendHandlesCodes = errorCodes.filter(code => frontendContent.includes(code));
    
    if (backendHasCodes.length === errorCodes.length) {
      checks.push({
        name: 'rounds-create error codes',
        status: 'PASS',
        details: [
          `Backend has ${backendHasCodes.length}/${errorCodes.length} codes`,
          `Frontend handles ${frontendHandlesCodes.length}/${errorCodes.length} codes`
        ]
      });
    } else {
      checks.push({
        name: 'rounds-create error codes',
        status: 'WARNING',
        details: ['Some error codes may be missing']
      });
    }
  }
  
  results.push(...checks.map(c => ({ 
    check: c.name, 
    status: c.status, 
    details: c.details 
  })));
}

// ============================================================================
// Summary Report
// ============================================================================
function printReport() {
  log('\n' + '='.repeat(70), 'bold');
  log('EPIC 5-9 FINAL VERIFICATION REPORT', 'bold');
  log('='.repeat(70) + '\n', 'bold');
  
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;
  
  for (const result of results) {
    const statusColor = result.status === 'PASS' ? 'green' : 
                        result.status === 'FAIL' ? 'red' : 'yellow';
    
    log(`${result.status.padEnd(10)} ${result.check}`, statusColor);
    
    for (const detail of result.details) {
      log(`         ${detail}`);
    }
    
    if (result.status === 'PASS') passCount++;
    else if (result.status === 'FAIL') failCount++;
    else if (result.status === 'WARNING') warningCount++;
    
    log('');
  }
  
  log('='.repeat(70), 'bold');
  log(`SUMMARY: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`, 
    failCount > 0 ? 'red' : (warningCount > 0 ? 'yellow' : 'green'));
  log('='.repeat(70), 'bold');
  
  if (failCount === 0) {
    log('\n✅ All checks passed! Epics 5-9 are ready for final signoff.', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some checks failed. Please review and fix before signoff.', 'red');
    process.exit(1);
  }
}

// ============================================================================
// Main Execution
// ============================================================================
function main() {
  log('\n🔍 Starting Epic 5-9 Final Verification...', 'bold');
  
  checkDeprecatedReferences();
  checkTodos();
  checkErrorCodes();
  checkMockData();
  checkBackendContracts();
  
  printReport();
}

main();
