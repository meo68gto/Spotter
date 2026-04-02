import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import type { CoachService } from '../../../hooks/useCoachCatalog';
import { invokeFunction } from '../../../lib/api';

type DraftResponse = {
  request: { id: string };
  order: { id: string };
  clientSecret: string | null;
};

type Props = {
  coachId: string;
  service: CoachService;
  scheduledTime?: string;
  requestInput: {
    questionText: string;
    buyerNote: string;
    requestDetails: Record<string, unknown>;
  };
  sourceSurface?: string;
  existingDraft?: DraftResponse | null;
  onBack: () => void;
  onPaid: (engagementRequestId: string, reviewOrderId: string) => void;
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

export function CoachCheckoutScreen({ coachId, service, scheduledTime, requestInput, sourceSurface = 'profile', existingDraft = null, onBack, onPaid }: Props) {
  const stripe =
    Platform.OS === 'web'
      ? {
          initPaymentSheet: async () => ({ error: { message: 'PaymentSheet is only supported on iOS/Android in this build' } }),
          presentPaymentSheet: async () => ({ error: { message: 'PaymentSheet is only supported on iOS/Android in this build' } })
        }
      : (eval('require')('@stripe/stripe-react-native').useStripe() as {
          initPaymentSheet: (params: { paymentIntentClientSecret: string; merchantDisplayName: string }) => Promise<{ error?: { message?: string } }>;
          presentPaymentSheet: () => Promise<{ error?: { message?: string } }>;
        });

  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const totalLabel = useMemo(() => formatPrice(service.priceCents), [service.priceCents]);

  const handlePay = async () => {
    setLoading(true);
    setStatusText('Preparing secure checkout...');

    try {
      const draft =
        existingDraft ??
        (await invokeFunction<DraftResponse>('coach-request-create-draft', {
          body: {
            coachId,
            coachServiceId: service.id,
            questionText: requestInput.questionText,
            buyerNote: requestInput.buyerNote,
            requestDetails: requestInput.requestDetails,
            scheduledTime,
            sourceSurface
          }
        }));

      if (!draft.clientSecret) throw new Error('Missing payment client secret');

      const initResult = await stripe.initPaymentSheet({
        paymentIntentClientSecret: draft.clientSecret,
        merchantDisplayName: 'Spotter'
      });
      if (initResult.error) throw new Error(initResult.error.message ?? 'Unable to initialize payment');

      setStatusText('Waiting for payment confirmation...');
      const paymentResult = await stripe.presentPaymentSheet();
      if (paymentResult.error) throw new Error(paymentResult.error.message ?? 'Payment failed');

      setStatusText('Finalizing request...');

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const order = await invokeFunction<{ order: { id: string; status: string } }>('payments-review-order-get', {
          body: { reviewOrderId: draft.order.id }
        });

        if (order.order.status === 'paid') {
          await invokeFunction('engagements-publish', {
            body: { engagementRequestId: draft.request.id }
          });
          setLoading(false);
          setStatusText(null);
          onPaid(draft.request.id, draft.order.id);
          return;
        }
      }

      throw new Error('Payment succeeded but confirmation is still pending. Please refresh your requests in a moment.');
    } catch (error) {
      setLoading(false);
      setStatusText(null);
      Alert.alert('Checkout failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Checkout</Text>
      <Text style={styles.subtitle}>You will only be charged once. Spotter waits for Stripe webhook confirmation before queueing the request.</Text>

      <View style={styles.card}>
        <Text style={styles.rowLabel}>Service</Text>
        <Text style={styles.rowValue}>{service.title}</Text>
        <Text style={styles.rowLabel}>Total</Text>
        <Text style={styles.total}>{totalLabel}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#0b3a53" />
          <Text style={styles.loadingText}>{statusText ?? 'Processing...'}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button title="Back" onPress={onBack} tone="secondary" />
        <Button title={`Pay ${totalLabel}`} onPress={handlePay} disabled={loading} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16, gap: 12 },
  title: { color: '#102a43', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#486581' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#d9e2ec', padding: 16, gap: 8 },
  rowLabel: { color: '#486581', fontWeight: '600' },
  rowValue: { color: '#102a43', fontSize: 18, fontWeight: '700' },
  total: { color: '#0b3a53', fontSize: 24, fontWeight: '800' },
  loadingCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#d9e2ec', padding: 16, gap: 10, alignItems: 'center' },
  loadingText: { color: '#334e68', fontWeight: '600', textAlign: 'center' },
  actions: { gap: 10, paddingBottom: 24 }
});
