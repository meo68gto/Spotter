import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookingStepHeader } from '../../../components/coaching/BookingStepHeader';
import { PriceModePillRow } from '../../../components/coaching/PriceModePillRow';
import { BookingMode, BookingStep, useBookingFlow } from '../../../hooks/useBookingFlow';
import { Button } from '../../../components/Button';

type Props = {
  coachId: string;
  selectedSlot: string;
  initialMode: BookingMode;
  onDone: () => void;
  onBack: () => void;
};

const STEP_LABELS: Record<Exclude<BookingStep, 'idle' | 'completed'>, string> = {
  creating: 'Preparing your session...',
  preparing_payment: 'Setting up secure payment...',
  awaiting_payment: 'Complete payment in the sheet below',
  processing_payment: 'Processing payment...',
  confirming: 'Confirming payment...',
  publishing: 'Finalizing booking...',
  payment_failed: 'Payment failed',
  publish_failed: 'Booking created, but finalizing failed'
};

const STEP_UI_INDEX: Record<BookingStep, 1 | 2 | 3> = {
  idle: 1,
  creating: 1,
  preparing_payment: 2,
  awaiting_payment: 2,
  processing_payment: 2,
  confirming: 2,
  publishing: 2,
  payment_failed: 2,
  publish_failed: 2,
  completed: 3
};

export function BookSessionScreen({ coachId, selectedSlot, initialMode, onDone, onBack }: Props) {
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
  const booking = useBookingFlow();
  const [mode, setMode] = useState<BookingMode>(initialMode);
  const [question, setQuestion] = useState('Help me improve consistency and decision-making in match play.');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleFailure = useCallback((step: BookingStep, message: string, recoverable: boolean) => {
    if (step === 'payment_failed') {
      Alert.alert(
        'Payment Cancelled',
        'You can try again or choose a different payment method.',
        [
          { text: 'Try Again', style: 'default' },
          { text: 'Cancel', style: 'cancel', onPress: onBack }
        ]
      );
    } else if (step === 'publish_failed') {
      Alert.alert(
        'Booking Almost Complete',
        `Your payment was successful, but we had trouble finalizing the booking: ${message}`,
        [
          {
            text: 'Retry',
            style: 'default',
            onPress: async () => {
              const success = await booking.retryPublish();
              if (success) {
                Alert.alert('Success', 'Your booking is now complete!', [{ text: 'OK', onPress: onDone }]);
              }
            }
          },
          { text: 'Contact Support', style: 'cancel' }
        ]
      );
    } else {
      Alert.alert(
        recoverable ? 'Booking Issue' : 'Booking Failed',
        `${message}${recoverable ? '\n\nYou can try again.' : ''}`,
        [
          { text: recoverable ? 'Try Again' : 'OK', style: 'default' },
          { text: 'Cancel', style: 'cancel', onPress: onBack }
        ]
      );
    }
  }, [booking, onBack, onDone]);

  const submit = async () => {
    if (!question.trim()) {
      Alert.alert('Missing question', 'Please include coaching context before payment.');
      return;
    }

    // Generate idempotency key for this booking attempt
    const idempotencyKey = `${coachId}-${selectedSlot}-${Date.now()}`;

    const result = await booking.run({
      coachId,
      mode,
      questionText: question.trim(),
      scheduledTime: selectedSlot,
      initPaymentSheet: stripe.initPaymentSheet,
      presentPaymentSheet: stripe.presentPaymentSheet,
      idempotencyKey
    });

    if (!result.ok) {
      const { step: failStep, message, recoverable } = result as { ok: false; step: BookingStep; message: string; recoverable: boolean };
      handleFailure(failStep, message, recoverable);
      return;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setRefreshing(false);
  };

  const isInProgress = booking.step !== 'idle' && booking.step !== 'completed';
  const isPaymentStep = ['preparing_payment', 'awaiting_payment', 'processing_payment', 'confirming'].includes(booking.step);
  const showRetry = booking.step === 'publish_failed';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Book Session</Text>
      <BookingStepHeader step={STEP_UI_INDEX[booking.step]} />

      {booking.step === 'idle' || booking.step === 'completed' ? (
        <>
          <Text style={styles.label}>Mode</Text>
          <PriceModePillRow mode={mode} onChange={setMode} />
          <Text style={styles.label}>Selected time</Text>
          <Text style={styles.meta}>{new Date(selectedSlot).toLocaleString()}</Text>
          <Text style={styles.label}>What do you want to improve?</Text>
          <TextInput value={question} onChangeText={setQuestion} multiline style={styles.textarea} editable={!isInProgress} />
          <Button title="Continue to Payment" onPress={submit} disabled={isInProgress} />
          <Button title="Back" onPress={onBack} tone="secondary" />
        </>
      ) : null}

      {isInProgress ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0b3a53" />
          <Text style={styles.loadingText}>{STEP_LABELS[booking.step as Exclude<BookingStep, 'idle' | 'completed'>]}</Text>
          {booking.step === 'awaiting_payment' ? (
            <Text style={styles.helpText}>Complete the payment in the secure sheet that opened</Text>
          ) : null}
          {booking.step === 'processing_payment' ? (
            <Text style={styles.helpText}>This may take a moment...</Text>
          ) : null}
          {booking.step === 'publishing' ? (
            <Text style={styles.helpText}>Almost there...</Text>
          ) : null}
        </View>
      ) : null}

      {showRetry ? (
        <View style={styles.retryContainer}>
          <Text style={styles.warningText}>⚠️ Payment successful, but booking needs to be finalized</Text>
          <Text style={styles.meta}>{booking.error}</Text>
          <Button
            title="Retry Finalizing"
            onPress={async () => {
              const success = await booking.retryPublish();
              if (success) {
                Alert.alert('Success', 'Your booking is complete!', [{ text: 'OK', onPress: onDone }]);
              }
            }}
          />
          <Button title="Contact Support" onPress={onBack} tone="secondary" />
        </View>
      ) : null}

      {booking.step === 'completed' ? (
        <>
          <Text style={styles.success}>✅ Booking confirmed!</Text>
          <Text style={styles.meta}>Request ID: {booking.requestId}</Text>
          {booking.orderId ? <Text style={styles.meta}>Order ID: {booking.orderId}</Text> : null}
          <Button title="Done" onPress={onDone} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#102a43', marginBottom: 8 },
  label: { color: '#334e68', fontWeight: '700', marginTop: 8, marginBottom: 4 },
  meta: { color: '#486581' },
  textarea: {
    minHeight: 100,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top'
  },
  error: { color: '#c53030', marginTop: 10 },
  success: { color: '#2f855a', fontSize: 18, fontWeight: '800', marginTop: 10 },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  loadingText: {
    color: '#334e68',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16
  },
  helpText: {
    color: '#627d98',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  retryContainer: {
    alignItems: 'center',
    paddingVertical: 24
  },
  warningText: {
    color: '#c05621',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12
  }
});
