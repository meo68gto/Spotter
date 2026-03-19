#!/usr/bin/env node
/**
 * Award Trust Badges Script
 * Nightly job to evaluate and award trust badges
 * 
 * Run: npx ts-node scripts/jobs/award-trust-badges.ts
 * Or:  node dist/scripts/jobs/award-trust-badges.js
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

// Badge definitions with criteria
interface BadgeCriteria {
  type: string;
  displayName: string;
  description: string;
  checkFn: (userId: string, supabase: SupabaseClient) => Promise<boolean>;
}

const BADGE_CRITERIA: BadgeCriteria[] = [
  {
    type: 'first_round',
    displayName: 'First Round',
    description: 'Completed your first round',
    checkFn: async (userId, supabase) => {
      const { count } = await supabase
        .from('round_participants')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', userId)
        .eq('status', 'checked_in');
      return (count || 0) >= 1;
    }
  },
  {
    type: 'reliable_player',
    displayName: 'Reliable Player',
    description: 'Maintained 95%+ reliability score',
    checkFn: async (userId, supabase) => {
      const { data } = await supabase
        .from('user_reputation')
        .select('reliability_score')
        .eq('user_id', userId)
        .single();
      return (data?.reliability_score || 0) >= 95;
    }
  },
  {
    type: 'punctual',
    displayName: 'Always On Time',
    description: 'Average arrival 5+ minutes early',
    checkFn: async (userId, supabase) => {
      const { data } = await supabase
        .from('user_reputation')
        .select('minutes_early_avg, rounds_completed')
        .eq('user_id', userId)
        .single();
      return (data?.minutes_early_avg || 0) >= 5 && (data?.rounds_completed || 0) >= 5;
    }
  },
  {
    type: 'social_connector',
    displayName: 'Social Connector',
    description: 'Made 10+ connections',
    checkFn: async (userId, supabase) => {
      const { count } = await supabase
        .from('user_connections')
        .select('*', { count: 'exact', head: true })
        .or(`and(user_id.eq.${userId},status.eq.accepted),and(connected_user_id.eq.${userId},status.eq.accepted)`);
      return (count || 0) >= 10;
    }
  },
  {
    type: 'community_vouched',
    displayName: 'Community Vouched',
    description: 'Received 3+ vouches from fellow golfers',
    checkFn: async (userId, supabase) => {
      const { count } = await supabase
        .from('vouches')
        .select('*', { count: 'exact', head: true })
        .eq('vouched_id', userId)
        .eq('status', 'active');
      return (count || 0) >= 3;
    }
  },
  {
    type: 'regular',
    displayName: 'Regular',
    description: 'Completed 10+ rounds',
    checkFn: async (userId, supabase) => {
      const { count } = await supabase
        .from('round_participants')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', userId)
        .eq('status', 'checked_in');
      return (count || 0) >= 10;
    }
  },
  {
    type: 'veteran',
    displayName: 'Veteran',
    description: 'Completed 50+ rounds',
    checkFn: async (userId, supabase) => {
      const { count } = await supabase
        .from('round_participants')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', userId)
        .eq('status', 'checked_in');
      return (count || 0) >= 50;
    }
  },
  {
    type: 'exceptional',
    displayName: 'Exceptional',
    description: '98%+ reliability with 20+ rounds completed',
    checkFn: async (userId, supabase) => {
      const { data } = await supabase
        .from('user_reputation')
        .select('reliability_score, rounds_completed')
        .eq('user_id', userId)
        .single();
      return (data?.reliability_score || 0) >= 98 && (data?.rounds_completed || 0) >= 20;
    }
  },
  {
    type: 'vouch_giver',
    displayName: 'Vouch Giver',
    description: 'Given 5+ vouches to other golfers',
    checkFn: async (userId, supabase) => {
      const { count } = await supabase
        .from('vouches')
        .select('*', { count: 'exact', head: true })
        .eq('voucher_id', userId)
        .eq('status', 'active');
      return (count || 0) >= 5;
    }
  }
];

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  console.log('🏆 Trust Badge Award System');
  console.log('===========================\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select('id');

    if (error) throw error;

    console.log(`📊 Checking ${users?.length || 0} users for badge eligibility\n`);

    let awarded = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users || []) {
      try {
        const userAwarded = await evaluateUserBadges(supabase, user.id);
        awarded += userAwarded;
        skipped += (BADGE_CRITERIA.length - userAwarded);
      } catch (err) {
        console.error(`   ❌ Error evaluating user ${user.id}:`, err);
        errors++;
      }
    }

    console.log(`\n✅ Complete!`);
    console.log(`   New badges awarded: ${awarded}`);
    console.log(`   Already have/Not eligible: ${skipped}`);
    console.log(`   Errors: ${errors}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

async function evaluateUserBadges(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  let awardedCount = 0;

  // Get existing badges for user
  const { data: existingBadges } = await supabase
    .from('trust_badges')
    .select('badge_type')
    .eq('user_id', userId)
    .eq('is_visible', true);

  const existingTypes = new Set(existingBadges?.map(b => b.badge_type) || []);

  for (const criteria of BADGE_CRITERIA) {
    // Skip if already has badge
    if (existingTypes.has(criteria.type)) continue;

    // Check if user meets criteria
    const meetsCriteria = await criteria.checkFn(userId, supabase);

    if (meetsCriteria) {
      // Award the badge
      const { error: insertError } = await supabase
        .from('trust_badges')
        .insert({
          user_id: userId,
          badge_type: criteria.type,
          display_name: criteria.displayName,
          description: criteria.description,
          is_visible: true,
          awarded_at: new Date().toISOString(),
          awarded_reason: `Met criteria: ${criteria.description}`
        });

      if (insertError) {
        console.error(`   ❌ Failed to award ${criteria.type} to ${userId}:`, insertError);
      } else {
        console.log(`   🏆 Awarded "${criteria.displayName}" to user ${userId.slice(0, 8)}...`);
        awardedCount++;
      }
    }
  }

  return awardedCount;
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { evaluateUserBadges, BADGE_CRITERIA };
