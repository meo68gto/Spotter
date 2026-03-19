import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';

type RegistrationStatus = 'idle' | 'submitting' | 'success' | 'error';

type Props = {
  eventId: string;
  eventPrice: number;
  onComplete: (guestSessionId: string, email: string) => void;
  onCancel: () => void;
};

export function GuestRegistrationScreen({ eventId, eventPrice, onComplete, onCancel }: Props) {
  const [status, setStatus] = useState<RegistrationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [handicap, setHandicap] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);

  const validateForm = (): boolean => {
    if (!firstName.trim()) {
      Alert.alert('Required', 'Please enter your first name');
      return false;
    }
    if (!lastName.trim()) {
      Alert.alert('Required', 'Please enter your last name');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address');
      return false;
    }
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return false;
    }
    if (!agreeToTerms) {
      Alert.alert('Agreement Required', 'Please agree to the terms and conditions');
      return false;
    }
    if (!agreeToPrivacy) {
      Alert.alert('Agreement Required', 'Please agree to the privacy policy');
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

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setStatus('submitting');
    setError(null);

    try {
      // Step 1: Create guest checkout session
      const guestResponse = await invokeFunction<{
        data: {
          id: string;
          email: string;
          expires_at: string;
          verificationToken: string;
        };
      }>('guest-start-checkout', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          eventId,
          handicap: handicap.trim() ? parseFloat(handicap) : undefined,
          dietaryRestrictions: dietaryRestrictions.trim() || undefined,
        },
      });

      if (!guestResponse.data?.id) {
        throw new Error('Failed to create guest session');
      }

      const guestSessionId = guestResponse.data.id;

      // Step 2: If event has a price, proceed to payment
      // If free, complete registration immediately
      if (eventPrice > 0) {
        // Store registration data temporarily and proceed to payment
        onComplete(guestSessionId, email.trim().toLowerCase());
      } else {
        // Free event - complete registration
        setStatus('success');
        Alert.alert(
          'Registration Initiated!',
          'Please check your email to verify your registration.',
          [{ text: 'OK', onPress: () => onComplete(guestSessionId, email.trim().toLowerCase()) }]
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      setStatus('error');
      Alert.alert('Registration Failed', message);
    }
  }, [firstName, lastName, email, phone, handicap, dietaryRestrictions, agreeToTerms, agreeToPrivacy, eventId, eventPrice, onComplete]);

  if (status === 'submitting') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Creating your guest account...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Guest Registration</Text>
        <Text style={styles.headerSubtitle}>
          Enter your details to register as a guest
        </Text>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>First Name *</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your first name"
            style={styles.input}
            placeholderTextColor={palette.ink500}
            autoCapitalize="words"
            editable={status !== 'submitting'}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Last Name *</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter your last name"
            style={styles.input}
            placeholderTextColor={palette.ink500}
            autoCapitalize="words"
            editable={status !== 'submitting'}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            style={styles.input}
            placeholderTextColor={palette.ink500}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={status !== 'submitting'}
          />
          <Text style={styles.helperText}>We'll send a verification link to this email</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number (optional)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 123-4567"
            style={styles.input}
            placeholderTextColor={palette.ink500}
            keyboardType="phone-pad"
            editable={status !== 'submitting'}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Event Information</Text>

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
            editable={status !== 'submitting'}
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
            editable={status !== 'submitting'}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Event Fee</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Registration Fee</Text>
          <Text style={styles.priceValue}>{eventPrice > 0 ? `$${eventPrice}` : 'Free'}</Text>
        </View>
        {eventPrice > 0 && (
          <Text style={styles.paymentNote}>Payment will be processed securely via Stripe</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Legal Agreements</Text>

        <View style={styles.checkboxRow}>
          <TouchableOpacity
            style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}
            onPress={() => setAgreeToTerms(!agreeToTerms)}
          >
            {agreeToTerms && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <Text style={styles.checkboxText}>
            I agree to the Terms of Service and Event Participation Agreement *
          </Text>
        </View>

        <View style={styles.checkboxRow}>
          <TouchableOpacity
            style={[styles.checkbox, agreeToPrivacy && styles.checkboxChecked]}
            onPress={() => setAgreeToPrivacy(!agreeToPrivacy)}
          >
            {agreeToPrivacy && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <Text style={styles.checkboxText}>
            I agree to the Privacy Policy and consent to data processing (GDPR) *
          </Text>
        </View>

        <Text style={styles.gdprNote}>
          Your data will be stored securely and only used for event registration purposes.
          You can request data deletion at any time by contacting support.
        </Text>
      </Card>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title={eventPrice > 0 ? 'Continue to Payment' : 'Complete Registration'}
          onPress={handleSubmit}
          disabled={status === 'submitting' || !agreeToTerms || !agreeToPrivacy}
        />
        <Button title="Cancel" onPress={onCancel} tone="secondary" disabled={status === 'submitting'} />
      </View>
    </ScrollView>
  );
}

// Need to import TouchableOpacity
import { TouchableOpacity } from 'react-native';

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
  inputGroup: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    color: palette.ink700,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink900,
    fontSize: 15,
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
    textAlignVertical: 'top',
  },
  helperText: {
    color: palette.ink500,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.navy600,
  },
  paymentNote: {
    color: palette.ink500,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: palette.sky300,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  checkmark: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxText: {
    flex: 1,
    color: palette.ink700,
    fontSize: 14,
    lineHeight: 20,
  },
  gdprNote: {
    color: palette.ink500,
    fontSize: 12,
    marginTop: spacing.sm,
    fontStyle: 'italic',
    lineHeight: 18,
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
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
