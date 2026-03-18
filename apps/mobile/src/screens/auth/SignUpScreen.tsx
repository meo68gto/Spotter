import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { showToast } from '../../components/ToastHost';
import { canShowApple, handleAuthError, oauthSignIn, signInWithApple, signUpWithPassword } from './authShared';
import { useTheme } from '../../theme/provider';

export function SignUpScreen({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const { tokens } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: tokens.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
        <Text style={[styles.title, { color: tokens.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>Set up your Spotter profile and start matching.</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          accessibilityLabel="Email address"
          accessibilityHint="Enter your email for account creation"
          placeholderTextColor={tokens.textMuted}
          style={[styles.input, { borderColor: tokens.borderStrong, color: tokens.text, backgroundColor: tokens.backgroundElevated }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          accessibilityLabel="Password"
          accessibilityHint="Enter a password for your account"
          placeholderTextColor={tokens.textMuted}
          style={[styles.input, { borderColor: tokens.borderStrong, color: tokens.text, backgroundColor: tokens.backgroundElevated }]}
        />

        <Button
          title={loading ? 'Creating Account...' : 'Sign Up'}
          accessibilityLabel="Create account"
          disabled={loading}
          onPress={async () => {
            try {
              setLoading(true);
              await signUpWithPassword(email.trim(), password);
              showToast({ type: 'success', title: 'Account created', message: 'Check your inbox for verification if required.' });
            } catch (error) {
              handleAuthError('Sign up failed', error);
            } finally {
              setLoading(false);
            }
          }}
        />

        <Button
          title="Continue with Google"
          accessibilityLabel="Continue with Google"
          tone="secondary"
          onPress={async () => {
            try {
              await oauthSignIn('google');
            } catch (error) {
              handleAuthError('Google sign-up failed', error);
            }
          }}
        />

        {canShowApple ? (
          <Button
            title="Continue with Apple"
            accessibilityLabel="Continue with Apple"
            tone="secondary"
            onPress={async () => {
              try {
                await signInWithApple();
              } catch (error) {
                handleAuthError('Apple sign-up failed', error);
              }
            }}
          />
        ) : null}

        <Button title="Already have an account? Log In" accessibilityLabel="Switch to login screen" tone="ghost" onPress={onSwitchToLogin} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 18
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  title: {
    fontSize: 28,
    fontWeight: '900'
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 14
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12
  }
});
