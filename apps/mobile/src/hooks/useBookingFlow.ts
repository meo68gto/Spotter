import { useState } from 'react';
import { isWeb } from '../theme/design';
import { invokeFunction } from '../lib/api';

export type BookingMode = 'text_answer' | 'video_answer' | 'video_call';

type CreateResponse = {
  request?: { id: string };
  order?: { id: string };
  clientSecret?: string | null;
};

type StartArgs = {
  coachId: string;
  mode: BookingMode;
  questionText: string;
  scheduledTime: string;
  initPaymentSheet: (params: { paymentIntentClientSecret: string; merchantDisplayName: string }) => Promise<{ error?: { message?: string } }>;
  presentPaymentSheet: () => Promise<{ error?: { message?: string } }>;
};

export function useBookingFlow() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');

  const run = async (args: StartArgs) => {
    setRunning(true);
    setError(null);

    try {
      const created = await invokeFunction<CreateResponse>('engagements-create', {
        method: 'POST',
        body: {
          coachId: args.coachId,
          engagementMode: args.mode,
          questionText: args.questionText,
          scheduledTime: args.scheduledTime || undefined,
          publishAfterPayment: true
        }
      });

      const engagementRequestId = created.request?.id;
      if (!engagementRequestId) {
        throw new Error('Missing engagement request from create response');
      }
      setRequestId(engagementRequestId);
      if (created.order?.id) setOrderId(created.order.id);

      const secret = created.clientSecret;
      if (!secret) {
        throw new Error('Missing payment client secret');
      }

      if (isWeb) {
        throw new Error('PaymentSheet is only supported on iOS/Android in this build');
      }

      const initResult = await args.initPaymentSheet({
        paymentIntentClientSecret: secret,
        merchantDisplayName: 'Spotter'
      });

      if (initResult.error) throw new Error(initResult.error.message ?? 'Unable to initialize payment sheet');

      const presentResult = await args.presentPaymentSheet();
      if (presentResult.error) throw new Error(presentResult.error.message ?? 'Payment failed');

      if (created.order?.id) {
        await invokeFunction('payments-review-order-confirm', {
          method: 'POST',
          body: {
            reviewOrderId: created.order.id,
            status: 'paid'
          }
        });
      }

      await invokeFunction('engagements-publish', {
        method: 'POST',
        body: { engagementRequestId }
      });

      setRunning(false);
      return { ok: true as const, requestId: engagementRequestId, orderId: created.order?.id ?? null };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Booking failed';
      setError(message);
      setRunning(false);
      return { ok: false as const, message };
    }
  };

  return {
    running,
    error,
    requestId,
    orderId,
    run
  };
}
