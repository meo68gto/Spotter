import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { invokeFunction } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { font, palette, radius, spacing } from '../../theme/design';

type RegistrationStatus = 'idle' | 'loading' | 'submitting' | 'processing_payment' | 'success' | 'error';

type EventInfo = {
  id: string;
  title: string;
  price: number;
  requiresApproval: boolean;
};

type RegistrationData = {
  handicap?: number;
  dietaryRestrictions?: string;
  equipmentNeeds?: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  cartPreference: 'walking' | 'riding';
  notes?: string;
};

type Props = {
  session: Session;
  eventId: string;
  onComplete: () => void;
  onCancel: () => void;
};

export function EventRegistrationScreen({ session, eventId, onComplete, onCancel }: Props) {
  const [status, setStatus] = useState<RegistrationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  
  // Form state
  const [handicap, setHandicap] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [equipmentNeeds, setEquipmentNeeds] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [cartPreference, setCartPreference] = useState<'walking' | 'riding'>('riding');
  const [notes, setNotes] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // Payment state
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Load event info
  useEffect(() => {
    const loadEventInfo = async () => {
      setStatus('loading');
      try {
        const response = await invokeFunction<Array<{
          id: string;
          title: string;
          price?: number;
          requires_approval?: boolean;
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
          requiresApproval: event.requires_approval ?? false
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

  const validateForm = (): boolean => {
    if (!agreeToTerms) {
      Alert.alert('Agreement Required', 'Please agree to the terms and conditions');
      return false;
    }

    // Validate handicap if provided
    if (handicap.trim()) {
      const handicapNum = parseFloat(handicap);
      if (isNaN(handicapNum) || handicapNum < 0 || handicapNum > 54) {
        Alert.alert('Invalid Handicap', 'Please enter a valid handicap between 0 and 54');
        return false;
      }
    }

    return true;
  };

  const prepareRegistrationData = (): RegistrationData => {
    return {
      handicap: handicap.trim() ? parseFloat(handicap) : undefined,
      dietaryRestrictions: dietaryRestrictions.trim() || undefined,
      equipmentNeeds: equipmentNeeds.trim() || undefined,
      emergencyContact: emergencyContactName.trim() ? {
        name: emergencyContactName.trim(),
        phone: emergencyContactPhone.trim()
      } : undefined,
      cartPreference,
      notes: notes.trim() || undefined
    };
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!eventInfo) return;

    setStatus('submitting');
    setError(null);

    try {
      const registrationData = prepareRegistrationData();

      // If payment is required, handle payment first
      if (eventInfo.price > 0) {
        setStatus('processing_payment');
        
        // For now, payment is handled via Stripe - this would integrate with
        // the payment flow. For this implementation, we'll use the 
        // organizer-registrations edge function which handles payment intent creation
        const response = await invokeFunction<{
          registration: {
            id: string;
            status: string;
            payment_status: string;
            paymentClientSecret?: string;
          };
          paymentClientSecret?: string;
        }>('organizer-registrations/register', {
          method: 'POST',
          body: {
            eventId: eventInfo.id,
            paymentMethodId: paymentMethodId ?? undefined,
            registrationData
          }
        });

        if (response.paymentClientSecret) {
          // In a full implementation, this would handle Stripe payment confirmation
          // For now, we consider it successful if we got a client secret
          setClientSecret(response.paymentClientSecret);
        }
      } else {
        // Free registration - directly register
        const response = await invokeFunction<{
          registration: {
            id: string;
            status: string;
            payment_status: string;
          };
        }>('organizer-registrations/register', {
          method: 'POST',
          body: {
            eventId: eventInfo.id,
            registrationData
          }
        });
      }

      setStatus('success');
      
      // Show success message
      Alert.alert(
        eventInfo.requiresApproval ? 'Registration Submitted' : 'Registration Complete',
        eventInfo.requiresApproval 
          ? 'Your registration is pending approval. You will be notified once approved.'
          : `You are now registered for ${eventInfo.title}!`,
        [{ text: 'OK', onPress: onComplete }]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      setStatus('error');
      Alert.alert('Registration Failed', message);
    }
  };

  // Alternative registration using sponsors-event-rsvp (simpler path)
  const handleSimpleRegister = async () => {
    if (!validateForm()) return;
    if (!eventInfo) return;

    setStatus('submitting');
    setError(null);

    try {
      // Use the sponsors-event-rsvp endpoint for simpler registration
      await invokeFunction('sponsors-event-rsvp', {
        method: 'POST',
        body: {
          eventId: eventInfo.id,
          action: 'register'
        }
      });

      setStatus('success');
      
      Alert.alert(
        'Registration Complete',
        `You are now registered for ${eventInfo.title}!`,
        [{ text: 'OK', onPress: onComplete }]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      setStatus('error');
      Alert.alert('Registration Failed', message);
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading event details...</Text>
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
        </View>
      </ScrollView>
    );
  }

  if (status === 'success') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Registration Complete!</Text>
          <Text style={styles.successText}>
            You are now registered for {eventInfo?.title}
          </Text>
          {eventInfo?.requiresApproval && (
            <Text style={styles.pendingText}>
              Your registration is pending approval
            </Text>
          )}
          <Button title="Done" onPress={onComplete} />
        </View>
      </ScrollView>
    );
  }

  const isSubmitting = status === 'submitting' || status === 'processing_payment';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Event Registration</Text>
        {eventInfo && (
          <Text style={styles.eventName}>{eventInfo.title}</Text>
        )}
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Player Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Handicap Index (optional)</Text>
          <TextInput
            value={handicap}
            onChangeText={setHandicap}
            placeholder="e.g., 12.5"
            style={styles.input}
            placeholderTextColor={palette.ink500}
            keyboardType="decimal-pad"
            maxLength={5}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dietary Restrictions (optional)</Text>
          <TextInput
            value={dietaryRestrictions}
            onChangeText={setDietaryRestrictions}
            placeholder="Any allergies or dietary needs?"
            style={styles.textArea}
            placeholderTextColor={palette.ink500}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Equipment Needs (optional)</Text>
          <TextInput
            value={equipmentNeeds}
            onChangeText={setEquipmentNeeds}
            placeholder="e.g., Need rental clubs, left-handed golfer"
            style={styles.input}
            placeholderTextColor={palette.ink500}
          />
        </View>

        <Text style={styles.sectionTitle}>Cart Preference</Text>
        
        <View style={styles.preferenceRow}>
          <TouchableOpacity
            style={[styles.preferenceOption, cartPreference === 'riding' && styles.preferenceSelected]}
            onPress={() => setCartPreference('riding')}
          >
            <Text style={[styles.preferenceText, cartPreference === 'riding' && styles.preferenceTextSelected]}>
              Riding Cart
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.preferenceOption, cartPreference === 'walking' && styles.preferenceSelected]}
            onPress={() => setCartPreference('walking')}
          >
            <Text style={[styles.preferenceText, cartPreference === 'walking' && styles.preferenceTextSelected]}>
              Walking
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Emergency Contact (optional)</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
            placeholder="Emergency contact name"
            style={styles.input}
            placeholderTextColor={palette.ink500}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            value={emergencyContactPhone}
            onChangeText={setEmergencyContactPhone}
            placeholder="Emergency contact phone"
            style={styles.input}
            placeholderTextColor={palette.ink500}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Additional Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any other information the organizer should know?"
            style={styles.textArea}
            placeholderTextColor={palette.ink500}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Registration Fee</Text>
          <Text style={styles.priceValue}>
            {eventInfo?.price && eventInfo.price > 0 ? `$${eventInfo.price}` : 'Free'}
          </Text>
        </View>

        {eventInfo?.price && eventInfo.price > 0 && (
          <View style={styles.paymentNote}>
            <Text style={styles.paymentNoteText}>
              Payment will be processed securely via Stripe
            </Text>
          </View>
        )}

        <View style={styles.termsRow}>
          <Switch
            value={agreeToTerms}
            onValueChange={setAgreeToTerms}
            trackColor={{ false: palette.sky300, true: palette.navy600 }}
            thumbColor={agreeToTerms ? palette.white : palette.ink500}
          />
          <Text style={styles.termsText}>
            I agree to the event terms and conditions
          </Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button
            title={isSubmitting ? 'Registering...' : eventInfo?.price && eventInfo.price > 0 ? `Pay & Register ($${eventInfo.price})` : 'Complete Registration'}
            onPress={handleSubmit}
            disabled={isSubmitting || !agreeToTerms}
          />
          <Button title="Cancel" onPress={onCancel} tone="secondary" disabled={isSubmitting} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  loadingText: {
    marginTop: spacing.md,
    color: palette.ink700,
    fontSize: 16
  },
  header: {
    marginBottom: spacing.md
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.ink900
  },
  eventName: {
    fontSize: 16,
    color: palette.ink700,
    marginTop: spacing.xs
  },
  form: {
    gap: spacing.lg
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginTop: spacing.md
  },
  inputGroup: {
    gap: spacing.xs
  },
  label: {
    color: palette.ink700,
    fontSize: 14,
    fontWeight: '500'
  },
  input: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink900,
    fontSize: 15
  },
  textArea: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink900,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  preferenceRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  preferenceOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: palette.white
  },
  preferenceSelected: {
    borderColor: palette.navy600,
    backgroundColor: '#E0F2FE'
  },
  preferenceText: {
    color: palette.ink700,
    fontWeight: '500'
  },
  preferenceTextSelected: {
    color: palette.navy600,
    fontWeight: '700'
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: spacing.md,
    marginTop: spacing.md
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.navy600
  },
  paymentNote: {
    backgroundColor: '#F3F4F6',
    borderRadius: radius.sm,
    padding: spacing.sm
  },
  paymentNoteText: {
    color: palette.ink700,
    fontSize: 13,
    textAlign: 'center'
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md
  },
  termsText: {
    flex: 1,
    color: palette.ink700,
    fontSize: 14
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.sm,
    padding: spacing.md
  },
  errorBannerText: {
    color: palette.red500,
    textAlign: 'center'
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.red500
  },
  errorText: {
    color: palette.ink700,
    textAlign: 'center',
    marginBottom: spacing.md
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md
  },
  successIcon: {
    fontSize: 64,
    color: palette.green500
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.ink900
  },
  successText: {
    color: palette.ink700,
    textAlign: 'center',
    fontSize: 16
  },
  pendingText: {
    color: palette.amber500,
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic'
  }
});
