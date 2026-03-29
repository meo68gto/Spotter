import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-03-25.dahlia',
  typescript: true,
})

// Platform fee percentage (10%)
export const PLATFORM_FEE_PERCENT = 0.10

/**
 * Calculate platform fee in cents for a given amount.
 */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_PERCENT)
}

/**
 * Verify a Stripe webhook signature.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  }
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  )
}

/**
 * Create a Stripe Connect onboarding link for a Standard connected account.
 */
export async function createConnectOnboardingLink(
  accountId: string,
  _returnUrl?: string,
  _refreshUrl?: string
): Promise<string> {
  const loginLink = await stripe.accounts.createLoginLink(accountId)
  return loginLink.url
}

export async function createAccountOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  })
  return accountLink.url
}

/**
 * Create a new Standard Stripe Connect account for an organizer.
 */
export async function createConnectAccount(
  organizerEmail: string,
  organizerName: string
): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: 'standard',
    email: organizerEmail,
    business_profile: {
      name: organizerName,
    },
    capabilities: {
      transfers: { requested: true },
    },
  })
}

/**
 * Get Stripe Connect account status.
 */
export async function getConnectAccountStatus(
  accountId: string
): Promise<{
  id: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirements: {
    currentlyDue: string[]
    eventuallyDue: string[]
  } | null
}> {
  const account = await stripe.accounts.retrieve(accountId)
  return {
    id: account.id,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    requirements: account.requirements
      ? {
          currentlyDue: account.requirements.currently_due ?? [],
          eventuallyDue: account.requirements.eventually_due ?? [],
        }
      : null,
  }
}

/**
 * Transfer funds to a connected Standard account.
 * This is used for payout requests.
 */
export async function createTransferToConnectedAccount(params: {
  amountCents: number
  destinationAccountId: string
  currency?: string
  metadata?: Record<string, string>
  idempotencyKey?: string
}): Promise<Stripe.Transfer> {
  const { amountCents, destinationAccountId, currency = 'usd', metadata, idempotencyKey } = params
  return stripe.transfers.create(
    {
      amount: amountCents,
      currency,
      destination: destinationAccountId,
      metadata,
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  )
}

/**
 * Create a charge with application fee (platform revenue).
 * Used when a golfer pays a registration fee.
 */
export async function createRegistrationCharge(params: {
  amountCents: number
  connectedAccountId: string
  customerId?: string
  paymentMethodId: string
  description: string
  tournamentId: string
  golferId: string
  metadata?: Record<string, string>
}): Promise<Stripe.PaymentIntent> {
  const { amountCents, connectedAccountId, customerId, paymentMethodId, description, tournamentId, golferId, metadata } = params

  const platformFee = calculatePlatformFee(amountCents)

  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: customerId,
    payment_method: paymentMethodId,
    description,
    confirm: true,
    automatic_payment_methods: customerId ? undefined : { enabled: true, allow_redirects: 'never' },
    application_fee_amount: platformFee,
    transfer_data: {
      destination: connectedAccountId,
    },
    metadata: {
      tournamentId,
      golferId,
      ...metadata,
    },
  })
}
