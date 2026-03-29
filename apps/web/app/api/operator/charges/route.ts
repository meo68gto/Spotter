import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';
import { createRegistrationCharge } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  return withOperatorAuth(req, async ({ organizerId, session }) => {
    const supabase = createServerClient();
    const body = await req.json();
    const { tournamentId, golferId, amountCents, paymentMethodId, customerId, description } = body;

    if (!tournamentId || !golferId || !amountCents || amountCents <= 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify tournament belongs to this organizer
    const { data: tournament, error: tourError } = await supabase
      .from('organizer_events')
      .select('id, name, organizer_id')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .single();

    if (tourError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found or unauthorized' }, { status: 404 });
    }

    // Get organizer's Stripe connected account
    const { data: organizer, error: orgError } = await supabase
      .from('organizer_accounts')
      .select('stripe_account_id')
      .eq('id', organizerId)
      .single();

    if (orgError || !organizer?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Organizer Stripe account not connected' },
        { status: 400 },
      );
    }

    // Get or create registration record
    const { data: registration, error: regError } = await supabase
      .from('organizer_event_registrations')
      .upsert(
        {
          event_id: tournamentId,
          user_id: golferId,
          payment_status: 'pending',
          status: 'registered',
          amount_paid_cents: 0,
        },
        {
          onConflict: 'event_id,user_id',
        },
      )
      .select()
      .single();

    if (regError || !registration) {
      return NextResponse.json({ error: 'Failed to create registration' }, { status: 500 });
    }

    try {
      const chargeDescription = description || `Registration for ${tournament.name}`;

      // Idempotency key based on registration + charge amount — deterministic so retries are safe
      const chargeIdempotencyKey = `charge-${registration.id}-${amountCents}`;

      const paymentIntent = await createRegistrationCharge({
        amountCents,
        connectedAccountId: organizer.stripe_account_id,
        customerId,
        paymentMethodId,
        description: chargeDescription,
        tournamentId,
        golferId,
        idempotencyKey: chargeIdempotencyKey,
        metadata: {
          registrationId: registration.id,
          organizerId,
        },
      });

      // Update registration with payment info
      await supabase
        .from('organizer_event_registrations')
        .update({
          payment_status: 'paid',
          amount_paid_cents: amountCents,
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq('id', registration.id);

      return NextResponse.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        registrationId: registration.id,
      });
    } catch (err) {
      // Mark registration payment as failed
      await supabase
        .from('organizer_event_registrations')
        .update({ payment_status: 'pending' })
        .eq('id', registration.id);

      const message = err instanceof Error ? err.message : 'Payment failed';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
