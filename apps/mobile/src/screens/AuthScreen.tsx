import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { trackEvent } from '../lib/analytics';
import { redirectTo, supabase } from '../lib/supabase';
import { extractOAuthCode } from '../lib/auth-utils';
import { font, isWeb, palette, radius, spacing } from '../theme/design';

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
    await trackEvent('auth_oauth_start', `oauth-${provider}`, { provider });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });
    if (error) {
      await trackEvent('auth_oauth_failure', `oauth-${provider}`, {
        provider,
        stage: 'start',
        reason: error.message
      });
      Alert.alert('OAuth failed', error.message);
      return;
    }
    if (data?.url) {
      const supported = await import('expo-web-browser');
      const result = await supported.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const code = extractOAuthCode(result.url);
        if (!code) {
          await trackEvent('auth_oauth_failure', `oauth-${provider}`, {
            provider,
            stage: 'code_extract',
            reason: 'missing_code'
          });
          return;
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          await trackEvent('auth_oauth_failure', `oauth-${provider}`, {
            provider,
            stage: 'exchange',
            reason: exchangeError.message
          });
          Alert.alert('OAuth exchange failed', exchangeError.message);
        } else {
          const user = (await supabase.auth.getUser()).data.user;
          if (user) {
            await trackEvent('auth_sign_in', user.id, { provider });
            await trackEvent('auth_oauth_success', user.id, { provider });
          }
        }
      } else {
        await trackEvent('auth_oauth_failure', `oauth-${provider}`, {
          provider,
          stage: 'browser',
          reason: result.type
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SPOTTER</Text>
        <Text style={styles.title}>Build your local sports network.</Text>
        <Text style={styles.subtitle}>Pair with golfers, pickleball players, and coaches. Join sponsored events that match your level.</Text>
        <View style={styles.heroPoints}>
          <Text style={styles.heroPoint}>- Smart partner matching by skill + distance</Text>
          <Text style={styles.heroPoint}>- Sponsor-powered tournament invites</Text>
          <Text style={styles.heroPoint}>- Coaching loop with measurable progress</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Sign in</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholderTextColor={palette.ink500}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          placeholderTextColor={palette.ink500}
        />

        <Button title="Sign In" onPress={signIn} disabled={loading} />
        <Button title="Create Account" onPress={signUp} disabled={loading} tone="secondary" />
        <Button title="Continue with Google" onPress={() => oauth('google')} tone="ghost" />
        <Button title="Continue with LinkedIn" onPress={() => oauth('linkedin_oidc')} tone="ghost" />
        <Button title="Explore Demo Mode" onPress={() => onDemoMode?.()} tone="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: palette.sky100,
    ...(isWeb
      ? {
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: spacing.xl
        }
      : {})
  },
  hero: {
    flex: 1,
    backgroundColor: palette.navy600,
    borderRadius: radius.lg,
    padding: spacing.xl,
    justifyContent: 'center',
    marginBottom: isWeb ? 0 : spacing.xl
  },
  eyebrow: {
    color: '#B7D7EA',
    letterSpacing: 2.2,
    fontWeight: '700',
    marginBottom: spacing.sm
  },
  title: {
    fontFamily: font.display,
    fontSize: isWeb ? 44 : 34,
    fontWeight: '800',
    color: palette.white,
    lineHeight: isWeb ? 50 : 40
  },
  subtitle: {
    color: '#D1E6F3',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontSize: 16,
    lineHeight: 22
  },
  heroPoints: {
    gap: spacing.xs
  },
  heroPoint: {
    color: '#E3F2FB',
    fontSize: 14
  },
  formCard: {
    flex: 1,
    maxWidth: isWeb ? 520 : undefined,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.sky200,
    padding: spacing.xl,
    justifyContent: 'center'
  },
  formTitle: {
    fontFamily: font.display,
    fontSize: 28,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.md
  },
  input: {
    backgroundColor: '#F8FBFD',
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.sky300,
    color: palette.ink900
  }
});
