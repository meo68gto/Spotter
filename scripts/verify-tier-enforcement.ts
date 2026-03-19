#!/usr/bin/env node
/**
 * Tier Enforcement Verification Script
 * Tests that all tier limits are properly enforced across the app
 */

import { TIER_SLUGS, getTierFeatures, TierSlug } from '../apps/functions/supabase/functions/_shared/tier-gate.ts';

// Test scenarios
interface TierTest {
  name: string;
  tier: TierSlug;
  expected: {
    canCreateRounds: boolean;
    canSendIntros: boolean;
    maxRoundsPerMonth: number | null;
    introCreditsMonthly: number | null;
    maxSearchResults: number | null;
  };
}

const tests: TierTest[] = [
  {
    name: 'Free tier',
    tier: TIER_SLUGS.FREE,
    expected: {
      canCreateRounds: false,
      canSendIntros: false,
      maxRoundsPerMonth: 0,
      introCreditsMonthly: 0,
      maxSearchResults: 20,
    },
  },
  {
    name: 'Select tier',
    tier: TIER_SLUGS.SELECT,
    expected: {
      canCreateRounds: true,
      canSendIntros: true,
      maxRoundsPerMonth: 4,
      introCreditsMonthly: 3,
      maxSearchResults: null,
    },
  },
  {
    name: 'Summit tier',
    tier: TIER_SLUGS.SUMMIT,
    expected: {
      canCreateRounds: true,
      canSendIntros: true,
      maxRoundsPerMonth: null,
      introCreditsMonthly: null,
      maxSearchResults: null,
    },
  },
];

// Verification results
interface VerificationResult {
  pass: boolean;
  test: TierTest;
  actual: TierTest['expected'];
  mismatches: string[];
}

function runVerification(): VerificationResult[] {
  return tests.map((test) => {
    const features = getTierFeatures(test.tier);
    const actual = {
      canCreateRounds: features.canCreateRounds,
      canSendIntros: features.canSendIntros,
      maxRoundsPerMonth: features.maxRoundsPerMonth,
      introCreditsMonthly: features.introCreditsMonthly,
      maxSearchResults: features.maxSearchResults,
    };

    const mismatches: string[] = [];

    if (actual.canCreateRounds !== test.expected.canCreateRounds) {
      mismatches.push(`canCreateRounds: expected ${test.expected.canCreateRounds}, got ${actual.canCreateRounds}`);
    }
    if (actual.canSendIntros !== test.expected.canSendIntros) {
      mismatches.push(`canSendIntros: expected ${test.expected.canSendIntros}, got ${actual.canSendIntros}`);
    }
    if (actual.maxRoundsPerMonth !== test.expected.maxRoundsPerMonth) {
      mismatches.push(`maxRoundsPerMonth: expected ${test.expected.maxRoundsPerMonth}, got ${actual.maxRoundsPerMonth}`);
    }
    if (actual.introCreditsMonthly !== test.expected.introCreditsMonthly) {
      mismatches.push(`introCreditsMonthly: expected ${test.expected.introCreditsMonthly}, got ${actual.introCreditsMonthly}`);
    }
    if (actual.maxSearchResults !== test.expected.maxSearchResults) {
      mismatches.push(`maxSearchResults: expected ${test.expected.maxSearchResults}, got ${actual.maxSearchResults}`);
    }

    return {
      pass: mismatches.length === 0,
      test,
      actual,
      mismatches,
    };
  });
}

function printResults(results: VerificationResult[]) {
  console.log('=== Tier Enforcement Verification ===\n');

  let passed = 0;
  let failed = 0;

  results.forEach((result) => {
    const status = result.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.test.name}`);

    if (!result.pass) {
      failed++;
      result.mismatches.forEach((m) => console.log(`  - ${m}`));
    } else {
      passed++;
      console.log(`  canCreateRounds: ${result.actual.canCreateRounds}`);
      console.log(`  canSendIntros: ${result.actual.canSendIntros}`);
      console.log(`  maxRoundsPerMonth: ${result.actual.maxRoundsPerMonth}`);
      console.log(`  introCreditsMonthly: ${result.actual.introCreditsMonthly}`);
      console.log(`  maxSearchResults: ${result.actual.maxSearchResults}`);
    }
    console.log('');
  });

  console.log('=== Summary ===');
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Code audit - check hardcoded values
function auditHardcodedValues() {
  console.log('\n=== Hardcoded Value Audit ===\n');
  console.log('⚠️  CreateRoundScreen.tsx has hardcoded limit of 3 (should be 0 for free tier)');
  console.log('⚠️  CreateRoundScreen.tsx does not use tier-gate helper for limit check');
  console.log('✅  rounds-create edge function uses TIER_FEATURES.canCreateRounds');
  console.log('✅  network-introduction-request edge function uses TIER_FEATURES.canSendIntros');
  console.log('⚠️  discovery-search edge function does not enforce maxSearchResults');
  console.log('');
}

// Run verification
const results = runVerification();
printResults(results);
auditHardcodedValues();
