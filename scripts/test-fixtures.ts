/**
 * Test Fixtures for Epics 1-4 Integration Tests
 * 
 * Provides test data and utilities for comprehensive testing
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Test User Fixtures
// ============================================================================

export interface TestUserFixture {
  email: string;
  password: string;
  displayName: string;
  tier: 'free' | 'select' | 'summit';
  tierId?: string;
  // Profile fields
  handicap: number;
  city: string;
  intent: 'business' | 'social' | 'competitive' | 'business_social';
  company?: string;
  role?: string;
  industry?: string;
  bio?: string;
  yearsPlaying: number;
  homeCourseArea: string;
  preferredTeeTimes: string[];
  playingFrequency: string;
  // Preferences
  openToIntros: boolean;
  openToSendingIntros: boolean;
  openToRecurringRounds: boolean;
  preferredGroupSize: string;
  cartPreference: string;
  // Reputation
  reputationScore: number;
  profileCompleteness: number;
}

export const FREE_TIER_FIXTURES: TestUserFixture[] = [
  {
    email: `test-free-pro-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'Alice Johnson',
    tier: 'free',
    handicap: 8,
    city: 'Phoenix',
    intent: 'business',
    company: 'TechStart Inc',
    role: 'Software Engineer',
    industry: 'Technology',
    bio: 'Full-stack developer who loves early morning rounds',
    yearsPlaying: 5,
    homeCourseArea: 'Scottsdale',
    preferredTeeTimes: ['early_bird', 'mid_morning'],
    playingFrequency: 'weekly',
    openToIntros: true,
    openToSendingIntros: true,
    openToRecurringRounds: true,
    preferredGroupSize: '4',
    cartPreference: 'either',
    reputationScore: 75,
    profileCompleteness: 90,
  },
  {
    email: `test-free-social-1@spotter.local`,
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
    playingFrequency: 'monthly',
    openToIntros: true,
    openToSendingIntros: false,
    openToRecurringRounds: true,
    preferredGroupSize: '4',
    cartPreference: 'cart',
    reputationScore: 60,
    profileCompleteness: 70,
  },
  {
    email: `test-free-comp-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'Carol White',
    tier: 'free',
    handicap: 22,
    city: 'Tempe',
    intent: 'competitive',
    bio: 'Working on my handicap, looking for competitive matches',
    yearsPlaying: 2,
    homeCourseArea: 'Tempe',
    preferredTeeTimes: ['twilight'],
    playingFrequency: 'biweekly',
    openToIntros: true,
    openToSendingIntros: true,
    openToRecurringRounds: false,
    preferredGroupSize: '2',
    cartPreference: 'walking',
    reputationScore: 55,
    profileCompleteness: 65,
  },
];

export const SELECT_TIER_FIXTURES: TestUserFixture[] = [
  {
    email: `test-select-business-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'David Chen',
    tier: 'select',
    handicap: 12,
    city: 'Phoenix',
    intent: 'business_social',
    company: 'Finance Partners LLC',
    role: 'Senior Financial Analyst',
    industry: 'Finance',
    bio: 'Finance professional seeking quality connections',
    yearsPlaying: 8,
    homeCourseArea: 'Phoenix',
    preferredTeeTimes: ['early_bird', 'mid_morning'],
    playingFrequency: 'weekly',
    openToIntros: true,
    openToSendingIntros: true,
    openToRecurringRounds: true,
    preferredGroupSize: '4',
    cartPreference: 'either',
    reputationScore: 82,
    profileCompleteness: 95,
  },
  {
    email: `test-select-legal-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'Elena Rodriguez',
    tier: 'select',
    handicap: 18,
    city: 'Scottsdale',
    intent: 'competitive',
    company: 'Rodriguez Law Group',
    role: 'Attorney',
    industry: 'Legal',
    bio: 'Competitive golfer and attorney',
    yearsPlaying: 6,
    homeCourseArea: 'Scottsdale',
    preferredTeeTimes: ['mid_morning', 'afternoon'],
    playingFrequency: 'weekly',
    openToIntros: true,
    openToSendingIntros: true,
    openToRecurringRounds: true,
    preferredGroupSize: '4',
    cartPreference: 'cart_preferred',
    reputationScore: 78,
    profileCompleteness: 88,
  },
  {
    email: `test-select-consulting-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'Frank Miller',
    tier: 'select',
    handicap: 6,
    city: 'Gilbert',
    intent: 'business',
    company: 'Miller Consulting Group',
    role: 'Management Consultant',
    industry: 'Consulting',
    bio: 'Building business relationships through golf',
    yearsPlaying: 12,
    homeCourseArea: 'Gilbert',
    preferredTeeTimes: ['early_bird'],
    playingFrequency: 'multiple_per_week',
    openToIntros: true,
    openToSendingIntros: true,
    openToRecurringRounds: true,
    preferredGroupSize: '3',
    cartPreference: 'walking_preferred',
    reputationScore: 90,
    profileCompleteness: 98,
  },
  {
    email: `test-select-executive-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'Grace Park',
    tier: 'select',
    handicap: 14,
    city: 'Paradise Valley',
    intent: 'business_social',
    company: 'Summit Holdings',
    role: 'VP Operations',
    industry: 'Real Estate',
    bio: 'Executive who enjoys networking on the course',
    yearsPlaying: 10,
    homeCourseArea: 'Paradise Valley',
    preferredTeeTimes: ['mid_morning'],
    playingFrequency: 'weekly',
    openToIntros: true,
    openToSendingIntros: true,
    openToRecurringRounds: true,
    preferredGroupSize: '4',
    cartPreference: 'either',
    reputationScore: 85,
    profileCompleteness: 92,
  },
];

export const SUMMIT_TIER_FIXTURES: TestUserFixture[] = [
  {
    email: `test-summit-ceo-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'Henry Wilson',
    tier: 'summit',
    handicap: 5,
    city: 'Paradise Valley',
    intent: 'business',
    company: 'Executive Ventures Inc',
    role: 'CEO',
    industry: 'Technology',
    bio: 'CEO looking for quality connections',
    yearsPlaying: 15,
    homeCourseArea: 'Paradise Valley',
    preferredTeeTimes: ['early_bird', 'mid_morning'],
    playingFrequency: 'weekly',
    openToIntros: true,
    openToSendingIntros: true,
    openToRecurringRounds: true,
    preferredGroupSize: '4',
    cartPreference: 'cart',
    reputationScore: 95,
    profileCompleteness: 100,
  },
  {
    email: `test-summit-creative-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'Iris Thompson',
    tier: 'summit',
    handicap: 14,
    city: 'Scottsdale',
    intent: 'social',
    company: 'Thompson Design Studio',
    role: 'Creative Director',
    industry: 'Design',
    bio: 'Creative director who enjoys social golf',
    yearsPlaying: 10,
    homeCourseArea: 'Scottsdale',
    preferredTeeTimes: ['afternoon', 'twilight'],
    playingFrequency: 'biweekly',
    openToIntros: true,
    openToSendingIntros: true,
    openToRecurringRounds: true,
    preferredGroupSize: '4',
    cartPreference: 'either',
    reputationScore: 88,
    profileCompleteness: 95,
  },
  {
    email: `test-summit-pro-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'Jack Martinez',
    tier: 'summit',
    handicap: 2,
    city: 'Phoenix',
    intent: 'competitive',
    company: 'Elite Sports Academy',
    role: 'Professional Golfer',
    industry: 'Sports',
    bio: 'Professional golfer seeking competitive matches',
    yearsPlaying: 20,
    homeCourseArea: 'Phoenix',
    preferredTeeTimes: ['early_bird'],
    playingFrequency: 'multiple_per_week',
    openToIntros: true,
    openToSendingIntros: false,
    openToRecurringRounds: true,
    preferredGroupSize: '2',
    cartPreference: 'walking',
    reputationScore: 92,
    profileCompleteness: 98,
  },
  {
    email: `test-summit-entrepreneur-1@spotter.local`,
    password: 'TestPass123!',
    displayName: 'Karen Lee',
    tier: 'summit',
    handicap: 10,
    city: 'Gilbert',
    intent: 'business_social',
    company: 'Lee Enterprises',
    role: 'Founder',
    industry: 'Technology',
    bio: 'Entrepreneur building a network',
    yearsPlaying: 8,
    homeCourseArea: 'Gilbert',
    preferredTeeTimes: ['mid_morning', 'afternoon'],
    playingFrequency: 'weekly',
    openToIntros: true,
    openToSendingIntros: true,
    openToRecurringRounds: true,
    preferredGroupSize: '4',
    cartPreference: 'either',
    reputationScore: 87,
    profileCompleteness: 93,
  },
];

export const ALL_TEST_FIXTURES = [
  ...FREE_TIER_FIXTURES,
  ...SELECT_TIER_FIXTURES,
  ...SUMMIT_TIER_FIXTURES,
];

// ============================================================================
// Test Course Fixtures
// ============================================================================

export interface TestCourseFixture {
  name: string;
  city: string;
  state: string;
  country: string;
  isActive: boolean;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  par: number;
  totalHoles: number;
}

export const TEST_COURSES: TestCourseFixture[] = [
  {
    name: 'Desert Mountain Golf Club',
    city: 'Scottsdale',
    state: 'AZ',
    country: 'USA',
    isActive: true,
    difficulty: 'hard',
    par: 72,
    totalHoles: 18,
  },
  {
    name: 'TPC Scottsdale',
    city: 'Scottsdale',
    state: 'AZ',
    country: 'USA',
    isActive: true,
    difficulty: 'expert',
    par: 71,
    totalHoles: 18,
  },
  {
    name: 'Grayhawk Golf Club',
    city: 'Scottsdale',
    state: 'AZ',
    country: 'USA',
    isActive: true,
    difficulty: 'moderate',
    par: 72,
    totalHoles: 18,
  },
  {
    name: 'Arizona Biltmore',
    city: 'Phoenix',
    state: 'AZ',
    country: 'USA',
    isActive: true,
    difficulty: 'moderate',
    par: 71,
    totalHoles: 18,
  },
  {
    name: 'Camelback Golf Course',
    city: 'Paradise Valley',
    state: 'AZ',
    country: 'USA',
    isActive: true,
    difficulty: 'hard',
    par: 72,
    totalHoles: 18,
  },
];

// ============================================================================
// Test Round Fixtures
// ============================================================================

export interface TestRoundFixture {
  courseName: string;
  scheduledAt: Date;
  maxPlayers: number;
  cartPreference: string;
  status: 'open' | 'full' | 'completed' | 'cancelled';
  tier: 'free' | 'select' | 'summit';
}

export const generateTestRounds = (baseDate: Date = new Date()): TestRoundFixture[] => {
  const rounds: TestRoundFixture[] = [];
  
  // Future rounds
  for (let i = 1; i <= 7; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    
    rounds.push({
      courseName: TEST_COURSES[i % TEST_COURSES.length].name,
      scheduledAt: date,
      maxPlayers: 4,
      cartPreference: 'either',
      status: 'open',
      tier: ['free', 'select', 'summit'][i % 3] as 'free' | 'select' | 'summit',
    });
  }
  
  // Past completed rounds
  for (let i = 1; i <= 3; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - i);
    
    rounds.push({
      courseName: TEST_COURSES[i % TEST_COURSES.length].name,
      scheduledAt: date,
      maxPlayers: 4,
      cartPreference: 'walking',
      status: 'completed',
      tier: ['free', 'select', 'summit'][i % 3] as 'free' | 'select' | 'summit',
    });
  }
  
  return rounds;
};

// ============================================================================
// Expected Test Results
// ============================================================================

export interface ExpectedResults {
  epic1: {
    usersCreated: number;
    fieldsPopulated: number;
    profileCompleteness: number;
  };
  epic2: {
    sameTierEnforced: boolean;
    crossTierBlocked: boolean;
    discoveryReturnsUsers: boolean;
  };
  epic3: {
    matchingAlgorithmWorks: boolean;
    compatibilityScoresValid: boolean;
    actionsWork: boolean;
  };
  epic4: {
    savesWork: boolean;
    introsWork: boolean;
    stateTransitionsWork: boolean;
    autoPromotionWorks: boolean;
  };
}

export const EXPECTED_RESULTS: ExpectedResults = {
  epic1: {
    usersCreated: ALL_TEST_FIXTURES.length,
    fieldsPopulated: 12, // Core profile fields
    profileCompleteness: 85,
  },
  epic2: {
    sameTierEnforced: true,
    crossTierBlocked: true,
    discoveryReturnsUsers: true,
  },
  epic3: {
    matchingAlgorithmWorks: true,
    compatibilityScoresValid: true,
    actionsWork: true,
  },
  epic4: {
    savesWork: true,
    introsWork: true,
    stateTransitionsWork: true,
    autoPromotionWorks: true,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

export function getUsersByTier(fixtures: TestUserFixture[], tier: 'free' | 'select' | 'summit'): TestUserFixture[] {
  return fixtures.filter((f) => f.tier === tier);
}

export function getRandomUser(fixtures: TestUserFixture[]): TestUserFixture | undefined {
  if (fixtures.length === 0) return undefined;
  return fixtures[Math.floor(Math.random() * fixtures.length)];
}

export function generateUniqueEmail(baseEmail: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const [localPart, domain] = baseEmail.split('@');
  return `${localPart}-${timestamp}-${random}@${domain}`;
}

export function validateFixture(fixture: TestUserFixture): string[] {
  const errors: string[] = [];
  
  if (!fixture.email || !fixture.email.includes('@')) {
    errors.push('Invalid email');
  }
  if (!fixture.displayName || fixture.displayName.length < 2) {
    errors.push('Display name too short');
  }
  if (!['free', 'select', 'summit'].includes(fixture.tier)) {
    errors.push('Invalid tier');
  }
  if (fixture.handicap < 0 || fixture.handicap > 54) {
    errors.push('Invalid handicap');
  }
  if (!['business', 'social', 'competitive', 'business_social'].includes(fixture.intent)) {
    errors.push('Invalid intent');
  }
  
  return errors;
}

// ============================================================================
// Database Helpers
// ============================================================================

export async function setupTestUsers(
  supabase: SupabaseClient,
  fixtures: TestUserFixture[],
  tierMap: Map<string, string>
): Promise<{ id: string; fixture: TestUserFixture }[]> {
  const createdUsers: { id: string; fixture: TestUserFixture }[] = [];
  
  for (const fixture of fixtures) {
    const tierId = tierMap.get(fixture.tier);
    if (!tierId) {
      console.warn(`Tier ${fixture.tier} not found`);
      continue;
    }
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      user_metadata: { display_name: fixture.displayName },
    });
    
    if (authError || !authData.user) {
      console.error(`Failed to create user ${fixture.email}:`, authError?.message);
      continue;
    }
    
    // Update user with tier
    await supabase
      .from('users')
      .update({
        tier_id: tierId,
        tier_status: 'active',
        tier_enrolled_at: new Date().toISOString(),
        display_name: fixture.displayName,
        city: fixture.city,
      })
      .eq('id', authData.user.id);
    
    createdUsers.push({ id: authData.user.id, fixture });
  }
  
  return createdUsers;
}

export async function cleanupTestUsers(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<void> {
  for (const userId of userIds) {
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch (error) {
      console.warn(`Failed to delete user ${userId}:`, error);
    }
  }
}

// ============================================================================
// Export All
// ============================================================================

export default {
  FREE_TIER_FIXTURES,
  SELECT_TIER_FIXTURES,
  SUMMIT_TIER_FIXTURES,
  ALL_TEST_FIXTURES,
  TEST_COURSES,
  EXPECTED_RESULTS,
  generateTestRounds,
  getUsersByTier,
  getRandomUser,
  generateUniqueEmail,
  validateFixture,
  setupTestUsers,
  cleanupTestUsers,
};
