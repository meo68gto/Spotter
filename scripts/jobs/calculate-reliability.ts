#!/usr/bin/env node
/**
 * Calculate Reliability Script
 * Nightly job to calculate reliability scores for all users
 * 
 * Run: npx ts-node scripts/jobs/calculate-reliability.ts
 * Or:  node dist/scripts/jobs/calculate-reliability.js
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.production' });

interface ReliabilityCalculation {
  userId: string;
  showRate: number;
  punctualityRate: number;
  reliabilityScore: number;
  reliabilityLabel: string;
  roundsCompleted: number;
  roundsScheduled: number;
  minutesEarlyAvg: number;
}

// Weight configuration
const RELIABILITY_WEIGHTS = {
  showRate: 0.50,        // 50% - most important
  punctuality: 0.30,     // 30% - being on time
  incidentPenalty: 0.20  // 20% - negative incidents
};

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔧 Trust & Reliability Calculator');
  console.log('=====================================\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all users with round participation
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    console.log(`📊 Found ${users?.length || 0} users to process\n`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const user of users || []) {
      try {
        const calculation = await calculateUserReliability(supabase, user.id);
        
        if (calculation) {
          // Update user_reputation table
          const { error: updateError } = await supabase
            .from('user_reputation')
            .upsert({
              user_id: calculation.userId,
              show_rate: calculation.showRate,
              punctuality_rate: calculation.punctualityRate,
              reliability_score: calculation.reliabilityScore,
              reliability_label: calculation.reliabilityLabel,
              rounds_completed: calculation.roundsCompleted,
              rounds_scheduled: calculation.roundsScheduled,
              minutes_early_avg: calculation.minutesEarlyAvg,
              last_reliability_calc_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

          if (updateError) throw updateError;

          // Record in history
          await supabase
            .from('user_reliability_history')
            .insert({
              user_id: calculation.userId,
              reliability_score: calculation.reliabilityScore,
              reliability_label: calculation.reliabilityLabel,
              show_rate: calculation.showRate,
              punctuality_rate: calculation.punctualityRate,
              change_reason: 'nightly_calc',
              rounds_completed: calculation.roundsCompleted,
              rounds_scheduled: calculation.roundsScheduled,
              calculated_at: new Date().toISOString()
            });

          updated++;
        }

        processed++;
        
        if (processed % 100 === 0) {
          console.log(`   Processed ${processed} users...`);
        }
      } catch (err) {
        console.error(`   ❌ Error processing user ${user.id}:`, err);
        errors++;
      }
    }

    console.log(`\n✅ Complete!`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Updated:   ${updated}`);
    console.log(`   Errors:    ${errors}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

async function calculateUserReliability(
  supabase: SupabaseClient,
  userId: string
): Promise<ReliabilityCalculation | null> {
  // Get round participation data
  const { data: participations, error: partError } = await supabase
    .from('round_participants')
    .select(`
      status,
      checked_in_at,
      tee_time,
      rounds!inner(status, scheduled_time)
    `)
    .eq('member_id', userId)
    .neq('status', 'declined'); // Don't count declined

  if (partError) throw partError;

  const rounds = participations || [];
  
  if (rounds.length === 0) {
    // No rounds yet - default to building status
    return {
      userId,
      showRate: 100.00,
      punctualityRate: 100.00,
      reliabilityScore: 50, // Neutral starting point
      reliabilityLabel: 'Building',
      roundsCompleted: 0,
      roundsScheduled: 0,
      minutesEarlyAvg: 0
    };
  }

  // Calculate show rate
  const scheduledRounds = rounds.filter(r => 
    ['confirmed', 'checked_in', 'no_show'].includes(r.status)
  );
  
  const attendedRounds = rounds.filter(r => r.status === 'checked_in').length;
  const noShows = rounds.filter(r => r.status === 'no_show').length;
  const totalScheduled = scheduledRounds.length;
  
  const showRate = totalScheduled > 0 
    ? Math.round(((attendedRounds / totalScheduled) * 100) * 100) / 100 
    : 100.00;

  // Calculate punctuality (only for attended rounds with timestamps)
  let punctualityRate = 100.00;
  let minutesEarlyTotal = 0;
  let punctualRounds = 0;

  const attendedWithTimes = rounds.filter(r => 
    r.status === 'checked_in' && r.checked_in_at && r.tee_time
  );

  if (attendedWithTimes.length > 0) {
    for (const round of attendedWithTimes) {
      const teeTime = new Date(round.tee_time);
      const checkedIn = new Date(round.checked_in_at);
      const diffMinutes = (teeTime.getTime() - checkedIn.getTime()) / (1000 * 60);
      
      minutesEarlyTotal += diffMinutes;
      punctualRounds++;
    }

    const avgMinutesEarly = minutesEarlyTotal / punctualRounds;
    
    // Punctuality: 100% if avg 5+ min early, scales down to 50% if avg on-time or late
    if (avgMinutesEarly >= 5) {
      punctualityRate = 100.00;
    } else if (avgMinutesEarly >= 0) {
      punctualityRate = 70.00 + (avgMinutesEarly / 5) * 30;
    } else {
      // Late - penalty
      punctualityRate = Math.max(50.00, 70.00 + (avgMinutesEarly / 30) * 20);
    }
  }

  // Get incident penalties
  const { data: incidents } = await supabase
    .from('incidents')
    .select('severity')
    .eq('reported_id', userId)
    .eq('status', 'resolved')
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // Last 90 days

  let incidentPenalty = 0;
  for (const incident of incidents || []) {
    switch (incident.severity) {
      case 'minor': incidentPenalty += 2; break;
      case 'moderate': incidentPenalty += 5; break;
      case 'serious': incidentPenalty += 15; break;
    }
  }

  // Calculate weighted reliability score
  let reliabilityScore = Math.round(
    (showRate * RELIABILITY_WEIGHTS.showRate) +
    (punctualityRate * RELIABILITY_WEIGHTS.punctuality) -
    incidentPenalty
  );

  // Clamp to 0-100
  reliabilityScore = Math.max(0, Math.min(100, reliabilityScore));

  // Determine label
  let reliabilityLabel = 'Building';
  if (reliabilityScore >= 98 && totalScheduled >= 20) {
    reliabilityLabel = 'Exceptional';
  } else if (reliabilityScore >= 90) {
    reliabilityLabel = 'Trusted';
  } else if (reliabilityScore >= 75) {
    reliabilityLabel = 'Reliable';
  }

  return {
    userId,
    showRate: Math.round(showRate * 100) / 100,
    punctualityRate: Math.round(punctualityRate * 100) / 100,
    reliabilityScore,
    reliabilityLabel,
    roundsCompleted: attendedRounds,
    roundsScheduled: totalScheduled,
    minutesEarlyAvg: punctualRounds > 0 ? Math.round(minutesEarlyTotal / punctualRounds) : 0
  };
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { calculateUserReliability };
