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
  onLoginSuccess: (user: { id: string; email: string; display_name: string | null }) => void;
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
      onLoginSuccess({
        id: adminUser.id,
        email: adminUser.email,
        display_name: adminUser.display_name,
      });
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
        <Text style={[styles.loadingText, { color: tokens.textSecondary }]}>
          Verifying admin access...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: tokens.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: tokens.text }]}>Admin Portal</Text>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
            Sign in with admin credentials
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          {/* Admin badge */}
          <View style={[styles.badge, { backgroundColor: tokens.primary + '20' }]}>
            <Text style={[styles.badgeText, { color: tokens.primary }]}>
              🔒 ADMIN ONLY
            </Text>
          </View>

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
            <Text style={[styles.errorText, { color: tokens.error }]}>
              {error}
            </Text>
          )}
        </View>

        <Button
          title="Back to App"
          onPress={onBackToApp}
          tone="ghost"
          accessibilityLabel="Return to regular app login"
        />

        <View style={styles.securityNotice}>
          <Text style={[styles.securityText, { color: tokens.textMuted }]}>
            ⚠️ All admin actions are logged and audited for security.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  card: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  securityNotice: {
    marginTop: 32,
    alignItems: 'center',
  },
  securityText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
