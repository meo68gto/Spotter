import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/provider';
import { spacing, radius, shadows } from '../theme/design';
import { Button } from './Button';
import { useStripe } from '../hooks/useStripe';

interface EventDetails {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
}

interface PaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event: EventDetails;
}

export function PaymentSheet({ visible, onClose, onSuccess, event }: PaymentSheetProps) {
  const { tokens } = useTheme();
  const { processPayment, loading, error } = useStripe();
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'apple_pay' | 'google_pay' | null>(null);
  const [processing, setProcessing] = useState(false);

  const formatPrice = (cents: number, currency: string) => {
    const dollars = (cents / 100).toFixed(2);
    return `$${dollars}`;
  };

  const handleConfirm = useCallback(async () => {
    if (!selectedMethod) return;

    setProcessing(true);
    
    try {
      const result = await processPayment({
        eventId: event.id,
        amount: event.priceCents,
        currency: event.currency,
        paymentMethod: selectedMethod,
      });

      if (result.success) {
        onSuccess();
      }
    } finally {
      setProcessing(false);
    }
  }, [selectedMethod, event, processPayment, onSuccess]);

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: tokens.overlay }]}>
      <View style={[styles.sheet, { backgroundColor: tokens.surface }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: tokens.text }]} >
            Complete Registration
          </Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: tokens.textMuted }]} >
              ✕
            </Text>
          </Pressable>
        </View>

        {/* Event Details */}
        <View style={[styles.eventCard, { backgroundColor: tokens.backgroundMuted }]}>
          <Text style={[styles.eventTitle, { color: tokens.text }]}>
            {event.title}
          </Text>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: tokens.textMuted }]} >
              Total
            </Text>
            <Text style={[styles.priceValue, { color: tokens.text }]}>
              {formatPrice(event.priceCents, event.currency)}
            </Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.paymentSection}>
          <Text style={[styles.sectionTitle, { color: tokens.text }]} >
            Payment Method
          </Text>

          {/* Credit Card */}
          <Pressable
            style={[
              styles.methodButton,
              {
                backgroundColor: tokens.backgroundMuted,
                borderColor: selectedMethod === 'card' ? tokens.primary : tokens.border,
              },
            ]}
            onPress={() => setSelectedMethod('card')}
          >
            <View style={styles.methodContent}>
              <Text style={[styles.methodIcon, { color: tokens.text }]} >
                💳
              </Text>
              <View style={styles.methodText}>
                <Text style={[styles.methodName, { color: tokens.text }]} >
                  Credit or Debit Card
                </Text>
                <Text style={[styles.methodSubtitle, { color: tokens.textMuted }]} >
                  Visa, Mastercard, Amex, etc.
                </Text>
              </View>
            </View>
            {selectedMethod === 'card' && (
              <Text style={[styles.selectedIndicator, { color: tokens.primary }]} >
                ✓
              </Text>
            )}
          </Pressable>

          {/* Apple Pay (iOS only) */}
          <Pressable
            style={[
              styles.methodButton,
              {
                backgroundColor: tokens.backgroundMuted,
                borderColor: selectedMethod === 'apple_pay' ? tokens.primary : tokens.border,
              },
            ]}
            onPress={() => setSelectedMethod('apple_pay')}
          >
            <View style={styles.methodContent}>
              <Text style={[styles.methodIcon, { color: tokens.text }]} >
                🍎
              </Text>
              <Text style={[styles.methodName, { color: tokens.text }]} >
                Apple Pay
              </Text>
            </View>
            {selectedMethod === 'apple_pay' && (
              <Text style={[styles.selectedIndicator, { color: tokens.primary }]} >
                ✓
              </Text>
            )}
          </Pressable>

          {/* Google Pay (Android only) */}
          <Pressable
            style={[
              styles.methodButton,
              {
                backgroundColor: tokens.backgroundMuted,
                borderColor: selectedMethod === 'google_pay' ? tokens.primary : tokens.border,
              },
            ]}
            onPress={() => setSelectedMethod('google_pay')}
          >
            <View style={styles.methodContent}>
              <Text style={[styles.methodIcon, { color: tokens.text }]} >
                📱
              </Text>
              <Text style={[styles.methodName, { color: tokens.text }]} >
                Google Pay
              </Text>
            </View>
            {selectedMethod === 'google_pay' && (
              <Text style={[styles.selectedIndicator, { color: tokens.primary }]} >
                ✓
              </Text>
            )}
          </Pressable>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: tokens.danger }]} >
              {error}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={processing || loading ? 'Processing...' : `Pay ${formatPrice(event.priceCents, event.currency)}`}
            onPress={handleConfirm}
            disabled={!selectedMethod || processing || loading}
            tone="primary"
          />
          <Button
            title="Cancel"
            onPress={onClose}
            disabled={processing || loading}
            tone="ghost"
          />
        </View>

        {(processing || loading) && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={tokens.primary} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    fontSize: 20,
    fontWeight: '600',
  },
  eventCard: {
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  paymentSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  methodButton: {
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  methodText: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
  },
  methodSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  selectedIndicator: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorContainer: {
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
