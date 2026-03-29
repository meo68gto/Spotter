import { Resend } from 'resend';

// Initialize Resend client — requires RESEND_API_KEY env var
const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

const FROM_SPOTTER = 'Spotter <noreply@spotter.golf>';
const FROM_BILLING = 'Spotter Billing <billing@spotter.golf>';
const FROM_OPERATOR = 'Spotter <operator@spotter.golf>';

// ---------------------------------------------------------------------------
// Tournament Invite
// ---------------------------------------------------------------------------

export interface TournamentInviteParams {
  to: string;
  tournamentName: string;
  inviterName: string;
  eventDate: string;
  courseName: string;
  acceptUrl: string;
  declineUrl?: string;
  message?: string;
}

export async function sendTournamentInvite(params: TournamentInviteParams) {
  if (!resend) {
    console.warn('[email] Resend not configured — skipping send');
    return;
  }
  // Dynamic import to keep react-email out of the main bundle when unused
  const { TournamentInviteEmail } = await import('../emails/TournamentInviteEmail');
  await resend.emails.send({
    from: FROM_SPOTTER,
    to: params.to,
    subject: `You're invited: ${params.tournamentName}`,
    react: <TournamentInviteEmail {...params} />,
  });
}

// ---------------------------------------------------------------------------
// Registration Confirmation
// ---------------------------------------------------------------------------

export interface RegistrationConfirmationParams {
  to: string;
  registrantName: string;
  tournamentName: string;
  eventDate: string;
  courseName: string;
  entryFeeCents?: number;
  walletAddedCents?: number; // spotter credits added to wallet
  confirmationCode: string;
  checkInUrl?: string;
}

export async function sendRegistrationConfirmation(params: RegistrationConfirmationParams) {
  if (!resend) {
    console.warn('[email] Resend not configured — skipping send');
    return;
  }
  const { RegistrationConfirmationEmail } = await import('../emails/RegistrationConfirmationEmail');
  await resend.emails.send({
    from: FROM_SPOTTER,
    to: params.to,
    subject: `You're registered: ${params.tournamentName}`,
    react: <RegistrationConfirmationEmail {...params} />,
  });
}

// ---------------------------------------------------------------------------
// Payment Receipt
// ---------------------------------------------------------------------------

export interface PaymentReceiptParams {
  to: string;
  registrantName: string;
  tournamentName: string;
  amountCents: number;
  currency?: string;
  paymentMethod: string;
  transactionId: string;
  eventDate: string;
  receiptUrl?: string;
}

export async function sendPaymentReceipt(params: PaymentReceiptParams) {
  if (!resend) {
    console.warn('[email] Resend not configured — skipping send');
    return;
  }
  const { PaymentReceiptEmail } = await import('../emails/PaymentReceiptEmail');
  await resend.emails.send({
    from: FROM_BILLING,
    to: params.to,
    subject: `Payment receipt: ${params.tournamentName}`,
    react: <PaymentReceiptEmail {...params} />,
  });
}

// ---------------------------------------------------------------------------
// Wrap Report (sent to operator after event)
// ---------------------------------------------------------------------------

export interface WrapReportParams {
  to: string;
  operatorName: string;
  tournamentName: string;
  eventDate: string;
  totalRegistrations: number;
  paidRegistrations: number;
  totalRevenueCents: number;
  sponsorRevenueCents: number;
  netRevenueCents: number;
  platformFeeCents: number;
  checkInCount: number;
  noShowCount: number;
  pdfUrl?: string;
  photosUrl?: string;
}

export async function sendWrapReport(params: WrapReportParams) {
  if (!resend) {
    console.warn('[email] Resend not configured — skipping send');
    return;
  }
  const { WrapReportEmail } = await import('../emails/WrapReportEmail');
  await resend.emails.send({
    from: FROM_OPERATOR,
    to: params.to,
    subject: `📊 Event Wrap Report: ${params.tournamentName}`,
    react: <WrapReportEmail {...params} />,
  });
}

// ---------------------------------------------------------------------------
// Broadcast email (to all tournament registrants)
// ---------------------------------------------------------------------------

export interface BroadcastParams {
  tournamentId: string;
  subject: string;
  htmlContent: string; // operator-composed broadcast content
  recipientEmails: string[];
}

export interface BroadcastResult {
  successful: number;
  failed: number;
  errors?: string[];
}

/**
 * Sends a broadcast email to a list of recipients.
 * Batches in groups of 90 to respect Resend rate limits.
 */
export async function sendBroadcastEmail(params: BroadcastParams): Promise<BroadcastResult> {
  if (!resend) {
    console.warn('[email] Resend not configured — skipping broadcast');
    return { successful: 0, failed: params.recipientEmails.length };
  }

  const BATCH_SIZE = 90;
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  const batches: string[][] = [];
  for (let i = 0; i < params.recipientEmails.length; i += BATCH_SIZE) {
    batches.push(params.recipientEmails.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    try {
      const { error } = await resend.emails.send({
        from: FROM_OPERATOR,
        to: batch,
        subject: params.subject,
        html: params.htmlContent,
      });
      if (error) {
        failed += batch.length;
        errors.push(`Batch error: ${error.message}`);
      } else {
        successful += batch.length;
      }
    } catch (err) {
      failed += batch.length;
      errors.push(`Batch exception: ${String(err)}`);
    }
    // Small delay between batches to avoid rate limit spikes
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return { successful, failed, errors: errors.length > 0 ? errors : undefined };
}
