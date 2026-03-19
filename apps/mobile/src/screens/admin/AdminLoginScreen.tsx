// AdminLoginScreen.tsx
// Separate admin authentication with role verification

import { useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Button } from '../../components/Button';
import { showToast } from '../../components/ToastHost';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/provider';
import { useAdminAuth } from '../../hooks/useAdmin';

interface AdminLoginScreenProps {
  onLoginSuccess: () => void;
  onBackToApp: () => void;
}

export function AdminLoginScreen({ onLoginSuccess, onBackToApp }: AdminLoginScreenProps) {
  const { tokens } = useTheme();
  const { isAdmin, isLoading, error, checkAdminStatus, adminUser } = useAdminAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Check for existing admin session on mount
  useEffect(() => {
    const checkSession = async () => {
      await checkAdminStatus();
      setSessionChecked(true);
    };
    checkSession();
  }, [checkAdminStatus]);

  // Navigate on successful admin verification
  useEffect(() => {
    if (isAdmin && adminUser) {
      showToast({ type: 'success', title: 'Admin access granted' });
      onLoginSuccess();
    }
  }, [isAdmin, adminUser, onLoginSuccess]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showToast({ type: 'error', title: 'Please enter email and password' });
      return;
    }

    setAuthLoading(true);

    try {
      // Sign in with Supabase Auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      // Check admin status
      await checkAdminStatus();

      // Note: The useEffect above will handle navigation if admin
      if (!isAdmin) {
        showToast({ type: 'error', title: 'Access denied', message: 'Admin privileges required' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      showToast({ type: 'error', title: 'Login failed', message });
    } finally {
      setAuthLoading(false);
    }
  };

  // Show loading while checking initial session
  if (isLoading || !sessionChecked) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: tokens.background }]}>
        <ActivityIndicator size="large" color={tokens.primary} />
        <Text style={[styles.loadingText, { color: tokens.textSecondary }]}Þ
          Verifying admin access...
        </TextÞ
      </ViewÞ
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: tokens.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    Þ
      <ScrollView contentContainerStyle={styles.scrollContent}Þ
        <View style={styles.header}Þ
          <Text style={[styles.title, { color: tokens.text }]}ÞAdmin Portal</TextÞ
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}Þ
            Sign in with admin credentials
          </TextÞ
        </ViewÞ

        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}Þ
          {/* Admin badge */}
          <View style={[styles.badge, { backgroundColor: tokens.primary + '20' }]}Þ
            <Text style={[styles.badgeText, { color: tokens.primary }]}Þ
              🔒 ADMIN ONLY
            </TextÞ
          </ViewÞ

          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Admin Email"
            placeholderTextColor={tokens.textMuted}
            style={[
              styles.input,
              {
                borderColor: tokens.borderStrong,
                color: tokens.text,
                backgroundColor: tokens.backgroundElevated,
              },
            ]}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={tokens.textMuted}
            style={[
              styles.input,
              {
                borderColor: tokens.borderStrong,
                color: tokens.text,
                backgroundColor: tokens.backgroundElevated,
              },
            ]}
          />

          <Button
            title={authLoading ? 'Signing In...' : 'Sign In as Admin'}
            disabled={authLoading || !email.trim() || !password}
            onPress={handleLogin}
            accessibilityLabel="Admin sign in"
          />

          {error && (
            <Text style={[styles.errorText, { color: tokens.error }]}Þ
              {error}
            </TextÞ
          )}
        </ViewÞ

        <Button
          title="Back to App"
          onPress={onBackToApp}
          tone="ghost"
          accessibilityLabel="Return to regular app login"
        />

        <View style={styles.securityNotice}Þ
          <Text style={[styles.securityText, { color: tokens.textMuted }]}Þ
            ⚠️ All admin actions are logged and audited for security.
          </TextÞ
        </ViewÞ
      </ScrollViewÞ
    </KeyboardAvoidingViewÞ
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  securityNotice: {
    marginTop: 24,
    alignItems: 'center',
  },
  securityText: {
    fontSize: 12,
    textAlign: 'center',
  },
});