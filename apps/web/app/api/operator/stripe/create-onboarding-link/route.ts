import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';
import { createConnectAccount, createAccountOnboardingLink } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  return withOperatorAuth(req, async ({ organizerId }) => {
    const baseUrl = process.env.NLOUD_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'App URL not configured. Set NLOUD_PUBLIC_APP_URL or NEXT_PUBLIC_APP_URL.' },
        { status: 500 },
      );
    }

    const supabase = createServerClient();

    // Get organizer details
    const { data: organizer, error } = await supabase
      .from('organizer_accounts')
      .select('id, name, contact_email, stripe_account_id')
      .eq('id', organizerId)
      .single();

    if (error || !organizer) {
      return NextResponse.json({ error: 'Organizer not found' }, { status: 404 });
    }

    try {
      let stripeAccountId = organizer.stripe_account_id;

      // Create a new Stripe Connect account if not already connected
      if (!stripeAccountId) {
        const stripeAccount = await createConnectAccount(
          organizer.contact_email,
          organizer.name,
        );
        stripeAccountId = stripeAccount.id;

        // Save the Stripe account ID to the organizer
        await supabase
          .from('organizer_accounts')
          .update({ stripe_account_id: stripeAccountId })
          .eq('id', organizer.id);
      }

      // Create onboarding link
      const returnUrl = `${baseUrl}/settings/stripe?connected=true`;
      const refreshUrl = `${baseUrl}/settings/stripe?refreshing=true`;

      const onboardingUrl = await createAccountOnboardingLink(
        stripeAccountId,
        returnUrl,
        refreshUrl,
      );

      return NextResponse.json({ url: onboardingUrl });
    } catch (err) {
      console.error('[stripe/create-onboarding-link] Failed to create Stripe onboarding link:', err);
      return NextResponse.json(
        { error: 'Failed to create Stripe onboarding link' },
        { status: 500 },
      );
    }
  });
}
