#!/usr/bin/env node
/**
 * Expire Vouches Script
 * Nightly job to expire vouches older than 1 year
 * 
 * Run: npx ts-node scripts/jobs/expire-vouches.ts
 * Or:  node dist/scripts/jobs/expire-vouches.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🗑️  Vouch Expiration Job');
  console.log('========================\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Find all active vouches that have expired
    const { data: expiredVouches, error: fetchError } = await supabase
      .from('vouches')
      .select('id, voucher_id, vouched_id, created_at, expires_at')
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());

    if (fetchError) throw fetchError;

    const expiredCount = expiredVouches?.length || 0;
    
    if (expiredCount === 0) {
      console.log('✅ No expired vouches to process');
      return;
    }

    console.log(`📊 Found ${expiredCount} expired vouches\n`);

    // Update status to expired
    const { data: updated, error: updateError } = await supabase
      .from('vouches')
      .update({ 
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (updateError) throw updateError;

    const updatedCount = updated?.length || 0;

    console.log(`✅ Complete!`);
    console.log(`   Expired vouches: ${updatedCount}`);

    // Summary of affected users
    const affectedVouchers = new Set(expiredVouches?.map(v => v.voucher_id) || []);
    const affectedVouched = new Set(expiredVouches?.map(v => v.vouched_id) || []);
    
    console.log(`   Unique vouchers: ${affectedVouchers.size}`);
    console.log(`   Unique vouched users: ${affectedVouched.size}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export {};
