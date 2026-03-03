import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { BookingStepHeader } from '../../../components/coaching/BookingStepHeader';
import { PriceModePillRow } from '../../../components/coaching/PriceModePillRow';
import { BookingMode, useBookingFlow } from '../../../hooks/useBookingFlow';
import { Button } from '../../../components/Button';

type Props = {
  coachId: string;
  selectedSlot: string;
  initialMode: BookingMode;
  onDone: () => void;
  onBack: () => void;
};

export function BookSessionScreen({ coachId, selectedSlot, initialMode, onDone, onBack }: Props) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const booking = useBookingFlow();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<BookingMode>(initialMode);
  const [question, setQuestion] = useState('Help me improve consistency and decision-making in match play.');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const submit = async () => {
    if (!question.trim()) {
      Alert.alert('Missing question', 'Please include coaching context before payment.');
      return;
    }

    setStep(2);
    const result = await booking.run({
      coachId,
      mode,
      questionText: question.trim(),
      scheduledTime: selectedSlot,
      initPaymentSheet,
      presentPaymentSheet
    });

    if (!result.ok) {
      Alert.alert('Payment failed', result.message);
      return;
    }

    setStep(3);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Book Session</Text>
      <BookingStepHeader step={step} />

      {step === 1 ? (
        <>
          <Text style={styles.label}>Mode</Text>
          <PriceModePillRow mode={mode} onChange={setMode} />
          <Text style={styles.label}>Selected time</Text>
          <Text style={styles.meta}>{new Date(selectedSlot).toLocaleString()}</Text>
          <Text style={styles.label}>What do you want to improve?</Text>
          <TextInput value={question} onChangeText={setQuestion} multiline style={styles.textarea} />
          <Button title="Continue to Payment" onPress={submit} disabled={booking.running} />
          <Button title="Back" onPress={onBack} tone="secondary" />
        </>
      ) : null}

      {step === 2 ? <Text style={styles.meta}>Opening payment sheet...</Text> : null}

      {step === 3 ? (
        <>
          <Text style={styles.success}>Booking confirmed.</Text>
          <Text style={styles.meta}>Request ID: {booking.requestId}</Text>
          {booking.orderId ? <Text style={styles.meta}>Order ID: {booking.orderId}</Text> : null}
          <Button title="Done" onPress={onDone} />
        </>
      ) : null}

      {booking.error ? <Text style={styles.error}>{booking.error}</Text> : null}
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
  success: { color: '#2f855a', fontSize: 18, fontWeight: '800', marginTop: 10 }
});
