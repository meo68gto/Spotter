import { useState, useCallback } from 'react';
import { isWeb } from '../theme/design';
import { invokeFunction } from '../lib/api';

export type BookingMode = 'text_answer' | 'video_answer' | 'video_call';

export type BookingStep =
  | 'idle'
  | 'creating'
  | 'preparing_payment'
  | 'awaiting_payment'
  | 'processing_payment'
  | 'confirming'
  | 'publishing'
  | 'completed'
  | 'payment_failed'
  | 'publish_failed';

type CreateResponse = {
  request?: { id: string };
  order?: { id: string };
  clientSecret?: string | null;
};

type PollOrderResponse = {
  order?: { id: string; status: string };
};

type StartArgs = {
  coachId: string;
  mode: BookingMode;
  questionText: string;
  scheduledTime: string;
  initPaymentSheet: (params: { paymentIntentClientSecret: string; merchantDisplayName: string }) => Promise<{ error?: { message?: string } }>;
  presentPaymentSheet: () => Promise<{ error?: { message?: string } }>;
  /**
   * Optional idempotency key for preventing duplicate bookings.
   * If provided and an engagement was created with this key, returns the existing engagement.
   */
  idempotencyKey?: string;
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15; // 30 seconds total

async function pollOrderPaid(orderId: string): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const result = await invokeFunction<PollOrderResponse>('payments-review-order-get', {
      method: 'POST',
      body: { reviewOrderId: orderId }
    }).catch(() => null);

    if (result?.order?.status === 'paid') {
      return true;
    }
  }
  return false;
}

export function useBookingFlow() {
  const [step, setStep] = useState<BookingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setRequestId('');
    setOrderId('');
  }, []);

  const run = async (args: StartArgs): Promise<
    | { ok: true; requestId: string; orderId: string | null }
    | { ok: false; step: BookingStep; message: string; recoverable: boolean }
  > => {
    setStep('creating');
    setError(null);

    let engagementRequestId: string | undefined;
    let reviewOrderId: string | undefined;

    try {
      // Step 1: Create engagement and order
      const created = await invokeFunction<CreateResponse>('engagements-create', {
        method: 'POST',
        body: {
          coachId: args.coachId,
          engagementMode: args.mode,
          questionText: args.questionText,
          scheduledTime: args.scheduledTime || undefined,
          publishAfterPayment: true,
          idempotencyKey: args.idempotencyKey
        }
      });

      engagementRequestId = created.request?.id;
      if (!engagementRequestId) {
        throw new Error('Missing engagement request from create response');
      }
      setRequestId(engagementRequestId);

      reviewOrderId = created.order?.id;
      if (reviewOrderId) setOrderId(reviewOrderId);

      const secret = created.clientSecret;
      if (!secret) {
        throw new Error('Missing payment client secret');
      }

      if (isWeb) {
        throw new Error('PaymentSheet is only supported on iOS/Android in this build');
      }

      // Step 2: Prepare payment sheet
      setStep('preparing_payment');
      const initResult = await args.initPaymentSheet({
        paymentIntentClientSecret: secret,
        merchantDisplayName: 'Spotter'
      });

      if (initResult.error) {
        throw new Error(initResult.error.message ?? 'Unable to initialize payment sheet');
      }

      // Step 3: Present payment sheet (user interaction)
      setStep('awaiting_payment');
      const presentResult = await args.presentPaymentSheet();

      if (presentResult.error) {
        setStep('payment_failed');
        return {
          ok: false,
          step: 'payment_failed',
          message: presentResult.error.message ?? 'Payment was cancelled or failed',
          recoverable: true
        };
      }

      // Step 4: Poll for webhook confirmation (backend authority)
      setStep('processing_payment');
      if (!reviewOrderId) {
        throw new Error('Missing order ID for confirmation');
      }

      const confirmed = await pollOrderPaid(reviewOrderId);
      if (!confirmed) {
        // Payment sheet reported success but webhook hasn't confirmed
        // This is a warning state - payment likely succeeded but we're not sure
        setStep('confirming');
        // Still attempt publish - backend will verify payment status
      }

      // Step 5: Publish engagement (backend verifies payment)
      setStep('publishing');
      try {
        await invokeFunction('engagements-publish', {
          method: 'POST',
          body: { engagementRequestId }
        });
      } catch (e) {
        setStep('publish_failed');
        const message = e instanceof Error ? e.message : 'Failed to publish engagement';
        return {
          ok: false,
          step: 'publish_failed',
          message,
          recoverable: true // User can retry publish
        };
      }

      setStep('completed');
      return { ok: true, requestId: engagementRequestId, orderId: reviewOrderId ?? null };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Booking failed';
      const currentStep = step;
      setError(message);

      // Determine if failure is recoverable
      const recoverable = currentStep === 'creating' || currentStep === 'preparing_payment';

      return {
        ok: false,
        step: currentStep,
        message,
        recoverable
      };
    }
  };

  const retryPublish = async (): Promise<boolean> => {
    if (!requestId) return false;

    setStep('publishing');
    setError(null);

    try {
      await invokeFunction('engagements-publish', {
        method: 'POST',
        body: { engagementRequestId: requestId }
      });
      setStep('completed');
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Publish failed';
      setError(message);
      setStep('publish_failed');
      return false;
    }
  };

  return {
    step,
    error,
    requestId,
    orderId,
    run,
    reset,
    retryPublish
  };
}
