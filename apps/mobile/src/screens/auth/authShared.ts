import { Alert, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { trackEvent } from '../../lib/analytics';
import { extractOAuthCode } from '../../lib/auth-utils';
import { redirectTo, supabase } from '../../lib/supabase';

export const canShowApple = Platform.OS === 'ios' || Platform.OS === 'web';

export const signInWithPassword = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const user = (await supabase.auth.getUser()).data.user;
  if (user) await trackEvent('auth_sign_in', user.id, { provider: 'password' });
};

export const signUpWithPassword = async (email: string, password: string) => {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  const user = (await supabase.auth.getUser()).data.user;
  if (user) await trackEvent('auth_sign_up', user.id, { provider: 'password' });
};

export const oauthSignIn = async (provider: 'google' | 'apple') => {
  await trackEvent('auth_oauth_start', `oauth-${provider}`, { provider });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true
    }
  });

  if (error) {
    await trackEvent('auth_oauth_failure', `oauth-${provider}`, { provider, stage: 'start', reason: error.message });
    throw error;
  }

  if (!data?.url) return;

  const browser = await import('expo-web-browser');
  const result = await browser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    await trackEvent('auth_oauth_failure', `oauth-${provider}`, { provider, stage: 'browser', reason: result.type });
    return;
  }

  const code = extractOAuthCode(result.url);
  if (!code) {
    await trackEvent('auth_oauth_failure', `oauth-${provider}`, { provider, stage: 'code_extract', reason: 'missing_code' });
    throw new Error('OAuth code missing from callback URL');
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    await trackEvent('auth_oauth_failure', `oauth-${provider}`, { provider, stage: 'exchange', reason: exchangeError.message });
    throw exchangeError;
  }

  const user = (await supabase.auth.getUser()).data.user;
  if (user) {
    await trackEvent('auth_sign_in', user.id, { provider });
    await trackEvent('auth_oauth_success', user.id, { provider });
  }
};

export const signInWithApple = async () => {
  if (Platform.OS === 'ios') {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      await oauthSignIn('apple');
      return;
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL]
    });

    if (!credential.identityToken) {
      throw new Error('Apple identity token is missing');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken
    });

    if (error) throw error;

    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      await trackEvent('auth_sign_in', user.id, { provider: 'apple' });
      await trackEvent('auth_oauth_success', user.id, { provider: 'apple' });
    }

    return;
  }

  await oauthSignIn('apple');
};

export const handleAuthError = (title: string, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  Alert.alert(title, message);
};
