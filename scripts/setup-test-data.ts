/**
 * Test Data Setup Script
 * 
 * Seeds the database with test users in each tier for Phase 1-2 testing.
 * Creates test rounds, connections, and invitations.
 * 
 * Usage: npx ts-node scripts/setup-test-data.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwEV8qyDsP31lcJwW2ZIg';

interface TestUserConfig {
  email: string;
  password: string;
  tierSlug: 'free' | 'select' | 'summit';
  displayName: string;
  handicap: number;
  city: string;
  intent: 'business' | 'social' | 'competitive' | 'business_social';
  company?: string;
  role?: string;
}

const testUsers: TestUserConfig[] = [
  // FREE tier users
  {
    email: 'test-free-1@spotter.local',
    password: 'TestPass123!',
    tierSlug: 'free',
    displayName: 'Alice (Free)',
    handicap: 8,
    city: 'Phoenix',
    intent: 'business',
    company: 'Tech Corp',
    role: 'Developer'
  },
  {
    email: 'test-free-2@spotter.local',
    password: 'TestPass123!',
    tierSlug: 'free',
    displayName: 'Bob (Free)',
    handicap: 15,
    city: 'Scottsdale',
    intent: 'social'
  },
  {
    email: 'test-free-3@spotter.local',
    password: 'TestPass123!',
    tierSlug: 'free',
    displayName: 'Charlie (Free)',
    handicap: 22,
    city: 'Tempe',
    intent: 'competitive'
  },
  // SELECT tier users
  {
    email: 'test-select-1@spotter.local',
    password: 'TestPass123!',
    tierSlug: 'select',
    displayName: 'Diana (Select)',
    handicap: 12,
    city: 'Phoenix',
    intent: 'business_social',
    company: 'Finance Inc',
    role: 'Manager'
  },
  {
    email: 'test-select-2@spotter.local',
    password: 'TestPass123!',
    tierSlug: 'select',
    displayName: 'Edward (Select)',
    handicap: 18,
    city: 'Scottsdale',
    intent: 'competitive',
    company: 'Law Firm',
    role: 'Attorney'
  },
  {
    email: 'test-select-3@spotter.local',
    password: 'TestPass123!',
    tierSlug: 'select',
    displayName: 'Fiona (Select)',
    handicap: 6,
    city: 'Gilbert',
    intent: 'business'
  },
  // SUMMIT tier users
  {
    email: 'test-summit-1@spotter.local',
    password: 'TestPass123!',
    tierSlug: 'summit',
    displayName: 'George (Summit)',
    handicap: 5,
    city: 'Paradise Valley',
    intent: 'business',
    company: 'Executive Co',
    role: 'CEO'
  },
  {
    email: 'test-summit-2@spotter.local',
    password: 'TestPass123!',
    tierSlug: 'summit',
    displayName: 'Helen (Summit)',
    handicap: 14,
    city: 'Scottsdale',
    intent: 'social',
    company: 'Design Studio',
    role: 'Creative Director'
  },
  {
    email: 'test-summit-3@spotter.local',
    password: 'TestPass123!',
    tierSlug: 'summit',
    displayName: 'Ian (Summit)',
    handicap: 2,
    city: 'Phoenix',
    intent: 'competitive'
  }
];

async function setupTestData() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('🌱 Setting up test data for Phase 1-2...\n');
  
  // Get tier IDs
  const { data: tiers, error: tiersError } = await supabase
    .from('membership_tiers')
    .select('id, slug');
  
  if (tiersError || !tiers) {
    console.error('❌ Failed to fetch tiers:', tiersError?.message);
    return;
  }
  
  const tierMap = new Map(tiers.map(t => [t.slug, t.id]));
  
  // Get a course for round creation
  const { data: courses, error: coursesError } = await supabase
    .from('golf_courses')
    .select('id, name')
    .eq('is_active', true)
    .limit(1);
  
  if (coursesError || !courses || courses.length === 0) {
    console.warn('⚠️ No active courses found - round creation will be skipped');
  }
  const testCourse = courses?.[0];
  
  const createdUsers: Array<{ id: string; config: TestUserConfig }> = [];
  
  // Create users
  for (const config of testUsers) {
    try {
      console.log(`Creating user: ${config.displayName} (${config.tierSlug})`);
      
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', config.email)
        .maybeSingle();
      
      if (existingUser) {
        console.log(`  User already exists, skipping creation`);
        createdUsers.push({ id: existingUser.id, config });
        continue;
      }
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: config.email,
        password: config.password,
        email_confirm: true
      });
      
      if (authError || !authData.user) {
        console.error(`  ❌ Failed to create auth user: ${authError?.message}`);
        continue;
      }
      
      const userId = authData.user.id;
      const tierId = tierMap.get(config.tierSlug);
      
      if (!tierId) {
        console.error(`  ❌ Tier not found: ${config.tierSlug}`);
        continue;
      }
      
      // Update user with tier
      const { error: updateError } = await supabase
        .from('users')
        .update({
          tier_id: tierId,
          tier_status: 'active',
          tier_enrolled_at: new Date().toISOString(),
          display_name: config.displayName,
          city: config.city
        })
        .eq('id', userId);
      
      if (updateError) {
        console.error(`  ❌ Failed to update user tier: ${updateError.message}`);
        continue;
      }
      
      // Create golf identity
      await supabase
        .from('user_golf_identities')
        .upsert({
          user_id: userId,
          handicap: config.handicap,
          playing_frequency: 'weekly',
          years_playing: Math.floor(Math.random() * 10) + 1
        }, { onConflict: 'user_id' });
      
      // Create networking preferences
      await supabase
        .from('user_networking_preferences')
        .upsert({
          user_id: userId,
          networking_intent: config.intent,
          open_to_intros: true,
          open_to_sending_intros: true,
          open_to_recurring_rounds: true,
          preferred_group_size: '4',
          cart_preference: 'either'
        }, { onConflict: 'user_id' });
      
      // Create professional identity if provided
      if (config.company && config.role) {
        await supabase
          .from('user_professional_identities')
          .upsert({
            user_id: userId,
            company: config.company,
            title: config.role,
            industry: 'Technology'
          }, { onConflict: 'user_id' });
      }
      
      // Create initial reputation
      await supabase
        .from('user_reputation')
        .upsert({
          user_id: userId,
          overall_score: 50 + Math.floor(Math.random() * 20),
          completion_rate: 100,
          ratings_average: 4.5,
          network_size: Math.floor(Math.random() * 10),
          profile_completeness: 80
        }, { onConflict: 'user_id' });
      
      console.log(`  ✅ Created user: ${userId}`);
      createdUsers.push({ id: userId, config });
      
    } catch (error) {
      console.error(`  ❌ Error creating user:`, error);
    }
  }
  
  console.log(`\n✅ Created ${createdUsers.length} test users\n`);
  
  // Create some connections between same-tier users
  console.log('🔗 Creating test connections...');
  const connectionsCreated = await createTestConnections(supabase, createdUsers);
  console.log(`✅ Created ${connectionsCreated} connections\n`);
  
  // Create test rounds
  if (testCourse) {
    console.log('⛳ Creating test rounds...');
    const roundsCreated = await createTestRounds(supabase, createdUsers, testCourse.id);
    console.log(`✅ Created ${roundsCreated} rounds\n`);
  }
  
  console.log('✨ Test data setup complete!\n');
  console.log('Test users created:');
  createdUsers.forEach(u => {
    console.log(`  - ${u.config.displayName} (${u.config.tierSlug}): ${u.config.email}`);
  });
  console.log('\nAll users have password: TestPass123!');
}

async function createTestConnections(
  supabase: SupabaseClient,
  users: Array<{ id: string; config: TestUserConfig }>
): Promise<number> {
  let count = 0;
  
  // Group users by tier
  const usersByTier = new Map<string, Array<{ id: string; config: TestUserConfig }>>();
  for (const user of users) {
    const tierUsers = usersByTier.get(user.config.tierSlug) || [];
    tierUsers.push(user);
    usersByTier.set(user.config.tierSlug, tierUsers);
  }
  
  // Create connections within same tier
  for (const [tier, tierUsers] of usersByTier) {
    if (tierUsers.length >= 2) {
      for (let i = 0; i < tierUsers.length - 1; i++) {
        const user1 = tierUsers[i];
        const user2 = tierUsers[i + 1];
        
        // Create mutual connection
        const { error } = await supabase
          .from('connections')
          .upsert([
            { user_id: user1.id, connected_user_id: user2.id, status: 'accepted' },
            { user_id: user2.id, connected_user_id: user1.id, status: 'accepted' }
          ], { onConflict: 'user_id, connected_user_id' });
        
        if (!error) {
          count++;
        }
      }
    }
  }
  
  return count;
}

async function createTestRounds(
  supabase: SupabaseClient,
  users: Array<{ id: string; config: TestUserConfig }>,
  courseId: string
): Promise<number> {
  let count = 0;
  
  // Group users by tier
  const usersByTier = new Map<string, Array<{ id: string; config: TestUserConfig }>>();
  for (const user of users) {
    const tierUsers = usersByTier.get(user.config.tierSlug) || [];
    tierUsers.push(user);
    usersByTier.set(user.config.tierSlug, tierUsers);
  }
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  
  // Create 1-2 rounds per tier
  for (const [tier, tierUsers] of usersByTier) {
    if (tierUsers.length >= 1) {
      const creator = tierUsers[0];
      const tierId = await getTierId(supabase, tier);
      
      if (!tierId) continue;
      
      // Create open round
      const { data: round, error } = await supabase
        .from('rounds')
        .insert({
          creator_id: creator.id,
          course_id: courseId,
          scheduled_at: futureDate.toISOString(),
          max_players: 4,
          cart_preference: 'either',
          tier_id: tierId,
          status: 'open',
          notes: `Test round for ${tier} tier`
        })
        .select()
        .single();
      
      if (error || !round) {
        console.error(`  Failed to create round: ${error?.message}`);
        continue;
      }
      
      // Add creator as participant
      await supabase
        .from('round_participants_v2')
        .insert({
          round_id: round.id,
          user_id: creator.id
        });
      
      // Invite another user from same tier if available
      if (tierUsers.length >= 2) {
        const invitee = tierUsers[1];
        
        await supabase
          .from('round_invitations')
          .insert({
            round_id: round.id,
            invitee_id: invitee.id,
            status: 'pending',
            invited_at: new Date().toISOString()
          });
        
        console.log(`  Created round ${round.id} with invitation to ${invitee.config.displayName}`);
      }
      
      count++;
      
      // Create a second round that's nearly full for SELECT tier
      if (tier === 'select' && tierUsers.length >= 3) {
        const { data: fullRound, error: fullError } = await supabase
          .from('rounds')
          .insert({
            creator_id: tierUsers[1].id,
            course_id: courseId,
            scheduled_at: new Date(futureDate.getTime() + 86400000).toISOString(),
            max_players: 2,
            cart_preference: 'walk',
            tier_id: tierId,
            status: 'open',
            notes: 'Nearly full test round'
          })
          .select()
          .single();
        
        if (!fullError && fullRound) {
          // Add creator and invite another
          await supabase
            .from('round_participants_v2')
            .insert({
              round_id: fullRound.id,
              user_id: tierUsers[1].id
            });
          
          await supabase
            .from('round_invitations')
            .insert({
              round_id: fullRound.id,
              invitee_id: tierUsers[2].id,
              status: 'pending',
              invited_at: new Date().toISOString()
            });
          
          count++;
        }
      }
    }
  }
  
  return count;
}

async function getTierId(supabase: SupabaseClient, slug: string): Promise<string | null> {
  const { data } = await supabase
    .from('membership_tiers')
    .select('id')
    .eq('slug', slug)
    .single();
  
  return data?.id || null;
}

// Run the script
setupTestData().catch(console.error);
