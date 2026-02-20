import { createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { ensureLiveKeyForProd, stripeRequest } from '../_shared/payments.ts';

interface StripeAccount {
  id: string;
}

interface StripeAccountLink {
  url: string;
}

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const service = createServiceClient();
  const env = getRuntimeEnv();

  ensureLiveKeyForProd();

  if (!env.stripeConnectRefreshUrl || !env.stripeConnectReturnUrl) {
    return badRequest('Missing Stripe connect URLs', 'stripe_connect_url_missing');
  }

  const { data: existingCoach, error: coachErr } = await service
    .from('coaches')
    .select('id, stripe_account_id, onboarding_status')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (coachErr) {
    return json(500, { error: coachErr.message, code: 'coach_lookup_failed' });
  }

  let stripeAccountId = existingCoach?.stripe_account_id ?? null;
  if (!stripeAccountId) {
    const account = await stripeRequest<StripeAccount>('/accounts', 'POST', {
      type: 'express',
      country: 'US',
      email: auth.user.email ?? undefined,
      'capabilities[card_payments][requested]': true,
      'capabilities[transfers][requested]': true
    });
    stripeAccountId = account.id;

    const { error: upsertErr } = await service.from('coaches').upsert(
      {
        user_id: auth.user.id,
        stripe_account_id: stripeAccountId,
        onboarding_status: 'pending'
      },
      { onConflict: 'user_id' }
    );
    if (upsertErr) {
      return json(500, { error: upsertErr.message, code: 'coach_upsert_failed' });
    }
  }

  const accountLink = await stripeRequest<StripeAccountLink>('/account_links', 'POST', {
    account: stripeAccountId,
    refresh_url: env.stripeConnectRefreshUrl,
    return_url: env.stripeConnectReturnUrl,
    type: 'account_onboarding'
  });

  return json(200, {
    data: {
      url: accountLink.url,
      stripeAccountId
    }
  });
});
