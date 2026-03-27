import { useCallback, useEffect, useState } from 'react';
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
import { invokeFunction } from '../lib/api';
import { palette, radius, spacing } from '../theme/design';

type VerificationStatus = 'idle' | 'verifying' | 'success' | 'error';

type Props = {
  initialToken?: string;
  onVerified: (email: string) => void;
  onBack: () => void;
};

export function GuestVerificationScreen({ initialToken, onVerified, onBack }: Props) {
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(initialToken || '');
  const [email, setEmail] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(!initialToken);

  // Auto-verify if token is provided
  useEffect(() => {
    if (initialToken && status === 'idle') {
      verifyToken(initialToken);
    }
  }, [initialToken]);

  const verifyToken = useCallback(async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) {
      Alert.alert('Error', 'Please enter a verification token');
      return;
    }

    setStatus('verifying');
    setError(null);

    try {
      const response = await invokeFunction<{
        data: {
          guestSessionId: string;
          email: string;
          requests: Array<{
            id: string;
            status: string;
            engagement_mode: string;
            question_text: string;
            created_at: string;
          }>;
        };
      }>('guest-verify', {
        method: 'POST',
        body: { token: tokenToVerify.trim() },
      });

      if (!response.data?.guestSessionId) {
        throw new Error('Verification failed');
      }

      setEmail(response.data.email);
      setStatus('success');

      // Show success message
      Alert.alert(
        'Email Verified!',
        'Your email has been verified successfully.',
        [{ text: 'Continue', onPress: () => onVerified(response.data.email) }]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
      setStatus('error');
      setShowTokenInput(true);
    }
  }, [onVerified]);

  const handleVerify = () => {
    verifyToken(token);
  };

  const handleResend = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      // This would trigger a new verification email
      // For now, just show a message
      Alert.alert(
        'Verification Email Sent',
        'Please check your inbox for the verification link.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend';
      Alert.alert('Error', message);
    }
  };

  if (status === 'verifying') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Verifying your email...</Text>
      </View>
    );
  }

  if (status === 'success') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Email Verified!</Text>
          <Text style={styles.successText}>
            Your email {email} has been successfully verified.
          </Text>
          <Button title="Continue" onPress={() => onVerified(email)} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Verify Your Email</Text>
        <Text style={styles.headerSubtitle}>
          Enter the verification token from your email to complete your registration
        </Text>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Email Verification</Text>

        <Text style={styles.instructions}>
          We've sent a verification email to your inbox. Please check your email and enter
          the verification token below, or click the link in the email.
        </Text>

        {showTokenInput && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Verification Token</Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              placeholder="Enter your verification token"
              style={styles.input}
              placeholderTextColor={palette.ink500}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>
              Paste the token from your verification email
            </Text>
          </View>
        )}

        {!showTokenInput && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              style={styles.input}
              placeholderTextColor={palette.ink500}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Didn't receive the email?</Text>

        <Text style={styles.helpText}>
          • Check your spam or junk folder{'\n'}
          • Make sure you entered the correct email address{'\n'}
          • Wait a few minutes and try again
        </Text>

        <Button title="Resend Verification Email" onPress={handleResend} tone="secondary" />
      </Card>

      <View style={styles.actions}>
        {showTokenInput && (
          <Button title="Verify" onPress={handleVerify} disabled={!token.trim()} />
        )}
        <Button title="Back" onPress={onBack} tone="ghost" />
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
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.md,
  },
  instructions: {
    color: palette.ink700,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
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
  helperText: {
    color: palette.ink500,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  helpText: {
    color: palette.ink700,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
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
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
