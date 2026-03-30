import { NextRequest, NextResponse } from 'next/server';
import { withOperatorAuth } from '@/lib/operator/auth';
import { createServerClient } from '@/lib/supabase/server';
import { createTransferToConnectedAccount } from '@/lib/stripe';
import { getAvailablePayoutBalanceCents } from '@/lib/operator/financials';

// POST /api/operator/payouts/request — Request a payout to Stripe connected account
export async function POST(req: NextRequest) {
  return withOperatorAuth(req, async ({ organizerId, session }) => {
    const supabase = createServerClient();
    const body = await req.json();
    const { tournamentId, amountCents, idempotencyKey } = body;

    // Client-provided idempotency key (best effort — client should store and retry with same key)
    const payoutIdempotencyKey = idempotencyKey
      ? `payout-${organizerId}-${tournamentId ?? 'global'}-${idempotencyKey}`
      : `payout-${organizerId}-${tournamentId ?? 'global'}-${Date.now()}`;

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const availableBalanceCents = await getAvailablePayoutBalanceCents(organizerId, tournamentId ?? null);
    if (amountCents > availableBalanceCents) {
      return NextResponse.json(
        {
          error: 'Requested payout exceeds your currently available balance.',
          availableBalanceCents,
        },
        { status: 400 },
      );
    }

    // Get organizer with Stripe account
    const { data: organizer, error: orgError } = await supabase
      .from('organizer_accounts')
      .select('stripe_account_id')
      .eq('id', organizerId)
      .single();

    if (orgError || !organizer?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Stripe account not connected. Please connect first.' },
        { status: 400 },
      );
    }

    // Idempotency: reject if a pending payout already exists for this organizer/tournament combo
    const { data: existingPending } = await supabase
      .from('payouts')
      .select('id')
      .eq('organizer_id', organizerId)
      .eq('tournament_id', tournamentId || null)
      .eq('status', 'processing')
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json(
        { error: 'A payout is already processing for this tournament. Please wait for it to complete.' },
        { status: 409 },
      );
    }

    // Create payout record
    const { data: payout, error: insertError } = await supabase
      .from('payouts')
      .insert({
        organizer_id: organizerId,
        tournament_id: tournamentId || null,
        amount_cents: amountCents,
        currency: 'usd',
        status: 'processing',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    try {
      // Create Stripe transfer with idempotency key to prevent race conditions
      const transfer = await createTransferToConnectedAccount({
        amountCents,
        destinationAccountId: organizer.stripe_account_id,
        currency: 'usd',
        metadata: {
          payoutId: payout.id,
          organizerId,
          tournamentId: tournamentId || '',
        },
        idempotencyKey: payoutIdempotencyKey,
      });

      // Update payout with transfer ID
      await supabase
        .from('payouts')
        .update({ stripe_transfer_id: transfer.id })
        .eq('id', payout.id);

      return NextResponse.json({ success: true, payoutId: payout.id, transferId: transfer.id });
    } catch (err) {
      // Mark payout as failed
      await supabase
        .from('payouts')
        .update({ status: 'failed' })
        .eq('id', payout.id);

      console.error('[payouts/request] Stripe transfer failed:', err);
      return NextResponse.json(
        { error: 'Failed to process payout. Please try again.' },
        { status: 500 },
      );
    }
  });
}
