import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeGuestFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';
import { useStripe } from '../../hooks/useStripe';

type CheckoutStatus = 'idle' | 'loading' | 'creating_order' | 'processing_payment' | 'confirming' | 'success' | 'error';

type EventInfo = {
  id: string;
  title: string;
  price: number;
  currency: string;
};

type OrderInfo = {
  id: string;
  clientSecret: string;
  amountCents: number;
  currency: string;
};

type Props = {
  guestSessionId: string;
  email: string;
  eventId: string;
  eventPrice: number;
  onComplete: (orderId: string) => void;
  onCancel: () => void;
};

export function GuestCheckoutScreen({
  guestSessionId,
  email,
  eventId,
  eventPrice,
  onComplete,
  onCancel,
}: Props) {
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);

  const { processPayment, loading: paymentLoading, error: paymentError } = useStripe();

  // Load event info
  useEffect(() => {
    const loadEventInfo = async () => {
      setStatus('loading');
      try {
        const response = await invokeGuestFunction<Array<{
          id: string;
          title: string;
          price?: number;
          currency?: string;
        }>>('sponsors-event-list', {
          method: 'POST',
          body: {}
        });

        const event = response.find(e => e.id === eventId);
        if (!event) {
          throw new Error('Event not found');
        }

        setEventInfo({
          id: event.id,
          title: event.title,
          price: event.price ?? 0,
          currency: event.currency ?? 'usd',
        });
        setStatus('idle');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load event';
        setError(message);
        setStatus('error');
      }
    };

    loadEventInfo();
  }, [eventId]);

  // Create order using guest-payment-intent endpoint
  const createOrder = useCallback(async () => {
    if (!eventInfo) return;

    setStatus('creating_order');
    setError(null);

    try {
      // Use the new guest-payment-intent endpoint
      const response = await invokeGuestFunction<{
        data: {
          clientSecret: string;
          paymentIntentId: string;
          orderId: string;
        };
      }>('guest-payment-intent', {
        method: 'POST',
        body: {
          guestSessionId,
          email,
          eventId,
          amountCents: eventInfo.price * 100,
          currency: eventInfo.currency,
        },
      });

      if (!response.data?.orderId) {
        throw new Error('Failed to create order');
      }

      setReviewOrderId(response.data.orderId);
      setOrderInfo({
        id: response.data.orderId,
        clientSecret: response.data.clientSecret,
        amountCents: eventInfo.price * 100,
        currency: eventInfo.currency,
      });
      setStatus('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      setError(message);
      setStatus('error');
      Alert.alert('Order Creation Failed', message);
    }
  }, [eventInfo, guestSessionId, email, eventId]);

  // Handle payment
  const handlePayment = useCallback(async () => {
    if (!orderInfo || !eventInfo) return;

    setStatus('processing_payment');
    setError(null);

    try {
      const result = await processPayment({
        eventId: eventInfo.id,
        amount: orderInfo.amountCents,
        currency: orderInfo.currency,
        paymentMethod: 'card',
      });

      if (result.success) {
        // Confirm the order
        setStatus('confirming');
        await confirmOrder();
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      setStatus('error');
      Alert.alert('Payment Failed', message);
    }
  }, [orderInfo, eventInfo, processPayment]);

  // Confirm order - webhook handles backend confirmation
  const confirmOrder = useCallback(() => {
    if (!reviewOrderId) return;
    // Webhook will update order status in backend
    // Just show success to user
    setStatus('success');
    Alert.alert(
      'Payment Successful!',
      'Your registration is complete. Check your email for your ticket.',
      [{ text: 'View Ticket', onPress: () => onComplete(reviewOrderId) }]
    );
  }, [reviewOrderId, onComplete]);

  // Format price
  const formatPrice = (cents: number, currency: string) => {
    const dollars = (cents / 100).toFixed(2);
    return `${currency.toUpperCase()} $${dollars}`;
  };

  if (status === 'loading' || status === 'creating_order' || status === 'confirming') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>
          {status === 'creating_order' ? 'Creating your order...' : 'Processing...'}
        </Text>
      </View>
    );
  }

  if (status === 'error' && !eventInfo) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error || 'Failed to load event'}</Text>
          <Button title="Go Back" onPress={onCancel} />
          <Button title="Try Again" onPress={() => setStatus('idle')} tone="secondary" />
        </View>
      </ScrollView>
    );
  }

  if (status === 'success') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Payment Complete!</Text>
          <Text style={styles.successText}>
            Your registration is confirmed. Check your email for your ticket.
          </Text>
          <Button title="View Ticket" onPress={() => onComplete(reviewOrderId || '')} />
        </View>
      </ScrollView>
    );
  }

  // Order Review Screen
  if (!orderInfo) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Order Review</Text>
          <Text style={styles.headerSubtitle}>Review your registration details</Text>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Event Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Event</Text>
            <Text style={styles.detailValue}>{eventInfo?.title || 'Loading...'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue}>{email}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Registration Fee</Text>
            <Text style={styles.detailValue}>{formatPrice((eventInfo?.price || 0) * 100, eventInfo?.currency || 'usd')}</Text>
          </View>
          <View style={[styles.detailRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice((eventInfo?.price || 0) * 100, eventInfo?.currency || 'usd')}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <Text style={styles.paymentText}>
            You will be prompted to enter your payment details securely via Stripe.
          </Text>
          <View style={styles.securityNote}>
            <Text style={styles.securityText}>🔒 Secure payment processing</Text>
          </View>
        </Card>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button
            title={`Proceed to Payment - ${formatPrice((eventInfo?.price || 0) * 100, eventInfo?.currency || 'usd')}`}
            onPress={createOrder}
            disabled={!eventInfo || status === 'creating_order'}
          />
          <Button title="Cancel" onPress={onCancel} tone="secondary" />
        </View>
      </ScrollView>
    );
  }

  // Payment Screen
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payment</Text>
        <Text style={styles.headerSubtitle}>Complete your registration</Text>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Amount Due</Text>
        <Text style={styles.amountDue}>{formatPrice(orderInfo.amountCents, orderInfo.currency)}</Text>
        <Text style={styles.eventName}>{eventInfo?.title}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <Text style={styles.paymentInstructions}>
          Tap the button below to open the secure payment sheet and complete your payment.
        </Text>

        {paymentError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{paymentError}</Text>
          </View>
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          title={paymentLoading ? 'Processing...' : `Pay ${formatPrice(orderInfo.amountCents, orderInfo.currency)}`}
          onPress={handlePayment}
          disabled={paymentLoading || status === 'processing_payment'}
        />
        <Button title="Cancel" onPress={onCancel} tone="secondary" disabled={paymentLoading} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: palette.ink700,
    fontSize: 16,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
  },
  headerSubtitle: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  detailLabel: {
    color: palette.ink500,
    fontSize: 14,
  },
  detailValue: {
    color: palette.ink900,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: palette.sky300,
  },
  totalLabel: {
    color: palette.ink900,
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    color: palette.navy600,
    fontSize: 20,
    fontWeight: '800',
  },
  paymentText: {
    color: palette.ink700,
    fontSize: 14,
    lineHeight: 20,
  },
  securityNote: {
    backgroundColor: '#E0F2FE',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  securityText: {
    color: palette.navy600,
    fontSize: 14,
    fontWeight: '600',
  },
  amountDue: {
    fontSize: 36,
    fontWeight: '800',
    color: palette.navy600,
    textAlign: 'center',
  },
  eventName: {
    fontSize: 16,
    color: palette.ink700,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  paymentInstructions: {
    color: palette.ink700,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.red500,
  },
  errorText: {
    color: palette.ink700,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorBannerText: {
    color: palette.red500,
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  successIcon: {
    fontSize: 64,
    color: palette.green500,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.ink900,
  },
  successText: {
    color: palette.ink700,
    textAlign: 'center',
    fontSize: 16,
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
