#!/usr/bin/env node
/**
 * Spotter Cleanup Verification Script
 * Checks for TODOs, multi-sport references, and mock data in production code
 * 
 * Acceptable TODOs (edge functions marking future features):
 * - Email/notification sending
 * - Stripe payment processing
 * - Background jobs
 * 
 * Acceptable multi-sport references:
 * - Comments explaining changes
 * - Photo asset constant names
 */

const fs = require('fs');
const path = require('path');

const MOBILE_SRC = path.join(__dirname, '../apps/mobile/src');
const FUNCTIONS_SRC = path.join(__dirname, '../apps/functions/supabase/functions');

const MULTI_SPORT_KEYWORDS = [
  'pickleball',
  'tennis',
  'padel',
  'soccer',
  'basketball',
  'baseball',
  'multi-sport',
  'multisport'
];

const TODO_PATTERN = /TODO:/gi;
const MOCK_PATTERN = /mock|Mock/gi;

const ACCEPTABLE_TODO_PATTERNS = [
  /send.*notification/i,
  /send.*email/i,
  /stripe/i,
  /payment/i,
  /refund/i,
  /background.*job/i,
  /scheduled/i
];

const findings = [];

function isAcceptableTodo(content) {
  return ACCEPTABLE_TODO_PATTERNS.some(pattern => pattern.test(content));
}

function isAcceptableMultiSport(line, content) {
  // Skip comments that document the cleanup
  if (line.includes('//') && 
      (content.includes('removed') || 
       content.includes('Golf-only') || 
       content.includes('Replaces') ||
       content.includes('Changed from'))) {
    return true;
  }
  // Skip photo asset constants
  if (content.includes('dashboardHero') && content.includes('Pickleball')) {
    return true;
  }
  return false;
}

function scanFile(filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedContent = line.trim();

    // Check for TODOs
    if (TODO_PATTERN.test(line)) {
      if (!isAcceptableTodo(trimmedContent)) {
        findings.push({
          file: relativePath,
          line: lineNum,
          content: trimmedContent,
          type: 'todo'
        });
      }
    }

    // Check for multi-sport references (case insensitive)
    const lowerLine = line.toLowerCase();
    for (const keyword of MULTI_SPORT_KEYWORDS) {
      if (lowerLine.includes(keyword)) {
        if (!isAcceptableMultiSport(line, trimmedContent)) {
          findings.push({
            file: relativePath,
            line: lineNum,
            content: trimmedContent,
            type: 'multi-sport'
          });
        }
        break;
      }
    }

    // Check for mock data (only in non-test files)
    if (!filePath.includes('.test.') && !filePath.includes('__tests__')) {
      if (MOCK_PATTERN.test(line) && 
          !line.includes('mockFunctionResponse') && 
          !line.includes('//')) {
        findings.push({
          file: relativePath,
          line: lineNum,
          content: trimmedContent,
          type: 'mock'
        });
      }
    }
  });
}

function walkDir(dir, callback, baseDir = dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        walkDir(filePath, callback, baseDir);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const relativePath = path.relative(baseDir, filePath);
      callback(filePath, relativePath);
    }
  }
}

function main() {
  console.log('🔍 Spotter Cleanup Verification\n');
  console.log('Scanning for:');
  console.log('  - TODOs in production paths (excluding future feature markers)');
  console.log('  - Multi-sport references (excluding documentation)');
  console.log('  - Mock data in production code\n');

  // Scan mobile source
  if (fs.existsSync(MOBILE_SRC)) {
    walkDir(MOBILE_SRC, scanFile, MOBILE_SRC);
  }

  // Scan functions
  if (fs.existsSync(FUNCTIONS_SRC)) {
    walkDir(FUNCTIONS_SRC, scanFile, FUNCTIONS_SRC);
  }

  // Report findings
  const todos = findings.filter(f => f.type === 'todo');
  const multiSport = findings.filter(f => f.type === 'multi-sport');
  const mocks = findings.filter(f => f.type === 'mock');

  console.log('═'.repeat(80));
  console.log('FINDINGS REPORT');
  console.log('═'.repeat(80));

  if (todos.length > 0) {
    console.log(`\n⚠️  TODOs found (${todos.length}):`);
    todos.forEach(f => {
      console.log(`  ${f.file}:${f.line}`);
      console.log(`    ${f.content.substring(0, 100)}`);
    });
  } else {
    console.log('\n✅ No TODOs found in production paths');
  }

  if (multiSport.length > 0) {
    console.log(`\n⚠️  Multi-sport references found (${multiSport.length}):`);
    multiSport.forEach(f => {
      console.log(`  ${f.file}:${f.line}`);
      console.log(`    ${f.content.substring(0, 100)}`);
    });
  } else {
    console.log('\n✅ No multi-sport references found');
  }

  if (mocks.length > 0) {
    console.log(`\n⚠️  Mock references found (${mocks.length}):`);
    mocks.forEach(f => {
      console.log(`  ${f.file}:${f.line}`);
      console.log(`    ${f.content.substring(0, 100)}`);
    });
  } else {
    console.log('\n✅ No mock data in production paths');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log(`TODOs: ${todos.length}`);
  console.log(`Multi-sport references: ${multiSport.length}`);
  console.log(`Mock references: ${mocks.length}`);
  console.log(`Total issues: ${findings.length}`);

  // Acceptable TODOs in edge functions (future features)
  console.log('\n📝 Acceptable TODOs (future features):');
  console.log('  - Email/notification sending (organizer functions)');
  console.log('  - Stripe payment processing');
  console.log('  - Background jobs');

  if (findings.length === 0) {
    console.log('\n🎉 All cleanup criteria met!');
    process.exit(0);
  } else {
    console.log('\n❌ Cleanup incomplete - see findings above');
    process.exit(1);
  }
}

main();
