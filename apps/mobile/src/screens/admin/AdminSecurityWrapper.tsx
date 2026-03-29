// AdminSecurityWrapper.tsx
// Handles admin session timeout, verification, and access control

import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { Button } from '../../components/Button';
import { useAdminAuth } from '../../hooks/useAdmin';
import { useTheme } from '../../theme/provider';

// Session timeout in milliseconds (30 minutes)
const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000;
// Check interval in milliseconds (1 minute)
const CHECK_INTERVAL = 60 * 1000;

interface AdminSecurityWrapperProps {
  children: React.ReactNode;
  onSessionExpired: () => void;
}

export function AdminSecurityWrapper({ children, onSessionExpired }: AdminSecurityWrapperProps) {
  const { tokens } = useTheme();
  const { isAdmin, checkAdminStatus, logout } = useAdminAuth();

  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(ADMIN_SESSION_TIMEOUT);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update last activity on user interaction
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
  }, []);

  // Check session validity
  const checkSession = useCallback(async () => {
    const elapsed = Date.now() - lastActivity;
    const remaining = ADMIN_SESSION_TIMEOUT - elapsed;

    setTimeRemaining(Math.max(0, remaining));

    // Show warning 5 minutes before timeout
    if (remaining < 5 * 60 * 1000 && remaining > 0) {
      setShowWarning(true);
    }

    // Session expired
    if (remaining <= 0) {
      await logout();
      onSessionExpired();
    }

    // Verify admin status periodically
    if (elapsed % (5 * 60 * 1000) < CHECK_INTERVAL) {
      await checkAdminStatus();
      if (!isAdmin) {
        onSessionExpired();
      }
    }
  }, [lastActivity, isAdmin, logout, checkAdminStatus, onSessionExpired]);

  // Setup activity monitoring
  useEffect(() => {
    // Start interval
    intervalRef.current = setInterval(checkSession, CHECK_INTERVAL);

    // Monitor app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - check session immediately
        checkSession();
      }
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [checkSession]);

  const handleExtendSession = useCallback(() => {
    updateActivity();
  }, [updateActivity]);

  const handleLogout = useCallback(async () => {
    await logout();
    onSessionExpired();
  }, [logout, onSessionExpired]);

  // Format remaining time
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Warning banner */}
      {showWarning && (
        <View style={[styles.warningBanner, { backgroundColor: tokens.warning }]}>
          <Text style={styles.warningText}>
            Session expires in {formatTime(timeRemaining)}
          </Text>
          <Button
            title="Extend Session"
            onPress={handleExtendSession}
            tone="secondary"
            accessibilityLabel="Extend admin session"
          />
        </View>
      )}

      {/* Main content with activity wrapper */}
      <View style={styles.content} onTouchStart={updateActivity}>
        {children}
      </View>

      {/* Session indicator */}
      <View style={[styles.sessionIndicator, { backgroundColor: tokens.success + '20' }]}>
        <View style={[styles.indicatorDot, { backgroundColor: tokens.success }]} />
        <Text style={[styles.sessionText, { color: tokens.textSecondary }]}>
          Admin Session Active
        </Text>
        <Button title="Logout" onPress={handleLogout} tone="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  warningText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  sessionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sessionText: {
    flex: 1,
    fontSize: 12,
  },
});