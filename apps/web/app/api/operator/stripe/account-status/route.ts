import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';
import { getConnectAccountStatus } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  return withOperatorAuth(req, async ({ organizerId }) => {
    const supabase = createServerClient();

    // Get organizer's Stripe account ID
    const { data: organizer, error } = await supabase
      .from('organizer_accounts')
      .select('stripe_account_id')
      .eq('id', organizerId)
      .single();

    if (error || !organizer) {
      return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });
    }

    if (!organizer.stripe_account_id) {
      return NextResponse.json({ connected: false });
    }

    try {
      const accountStatus = await getConnectAccountStatus(organizer.stripe_account_id);
      return NextResponse.json({
        connected: true,
        stripeAccountId: organizer.stripe_account_id,
        ...accountStatus,
      });
    } catch (err) {
      console.error('[stripe/account-status] Failed to get Stripe account status:', err);
      return NextResponse.json(
        { error: 'Failed to get Stripe account status' },
        { status: 500 },
      );
    }
  });
}
