import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { trackEvent } from '../lib/analytics';
import { redirectTo, supabase } from '../lib/supabase';
import { extractOAuthCode } from '../lib/auth-utils';

type Props = {
  onDemoMode?: () => void;
};

export function AuthScreen({ onDemoMode }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Sign in failed', error.message);
    else {
      const user = (await supabase.auth.getUser()).data.user;
      if (user) await trackEvent('auth_sign_in', user.id, { provider: 'password' });
    }
  };

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) Alert.alert('Sign up failed', error.message);
    else {
      const user = (await supabase.auth.getUser()).data.user;
      if (user) await trackEvent('auth_sign_up', user.id, { provider: 'password' });
      Alert.alert('Success', 'Check your email for confirmation.');
    }
  };

  const oauth = async (provider: 'google' | 'linkedin_oidc') => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });
    if (error) {
      Alert.alert('OAuth failed', error.message);
      return;
    }
    if (data?.url) {
      const supported = await import('expo-web-browser');
      const result = await supported.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const code = extractOAuthCode(result.url);
        if (!code) return;

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          Alert.alert('OAuth exchange failed', exchangeError.message);
        } else {
          const user = (await supabase.auth.getUser()).data.user;
          if (user) await trackEvent('auth_sign_in', user.id, { provider });
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spotter</Text>
      <Text style={styles.subtitle}>Find the right activity partner. Improve every session.</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />

      <Button title="Sign In" onPress={signIn} disabled={loading} />
      <Button title="Create Account" onPress={signUp} disabled={loading} />
      <Button title="Continue with Google" onPress={() => oauth('google')} />
      <Button title="Continue with LinkedIn" onPress={() => oauth('linkedin_oidc')} />
      <Button title="Explore Demo Mode" onPress={() => onDemoMode?.()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f2f5f7'
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0b3a53'
  },
  subtitle: {
    color: '#4d6675',
    marginBottom: 24
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#d3dde3'
  }
});
