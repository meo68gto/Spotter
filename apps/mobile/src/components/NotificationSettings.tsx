import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { usePushNotifications, NotificationSettings as Settings } from '../hooks/usePushNotifications';
import { Button } from './Button';
import { palette, spacing, font, radius } from '../theme/design';

interface NotificationSettingsProps {
  userId: string;
  sessionToken: string;
}

const NOTIFICATION_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  round_invitation: {
    label: 'Round Invitations',
    description: 'When someone invites you to join a round',
  },
  round_reminder: {
    label: 'Round Reminders',
    description: 'Reminders before scheduled rounds',
  },
  trust_update: {
    label: 'Trust Updates',
    description: 'When your trust score changes',
  },
  reputation_update: {
    label: 'Reputation Updates',
    description: 'Updates about your reputation',
  },
  event_registration: {
    label: 'Event Registrations',
    description: 'Updates about events you registered for',
  },
  message: {
    label: 'Messages',
    description: 'New messages from other users',
  },
  connection_request: {
    label: 'Connection Requests',
    description: 'When someone wants to connect',
  },
  session_reminder: {
    label: 'Session Reminders',
    description: 'Reminders about upcoming sessions',
  },
  general: {
    label: 'General',
    description: 'Other app updates and announcements',
  },
};

export function NotificationSettings({ userId, sessionToken }: NotificationSettingsProps) {
  const {
    pushToken,
    permissionStatus,
    isLoading,
    error,
    settings,
    hasPermissions,
    requestPermissions,
    updateSetting,
    removeToken,
  } = usePushNotifications(userId);

  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);

  const handleToggle = useCallback(
    async (type: keyof Settings, channel: 'push' | 'email', enabled: boolean) => {
      const key = `${type}_${channel}`;
      setUpdating((prev) => ({ ...prev, [key]: true }));

      try {
        await updateSetting(type, channel, enabled);
      } catch (err) {
        console.error('Failed to update setting:', err);
        Alert.alert('Error', 'Failed to update notification settings. Please try again.');
      } finally {
        setUpdating((prev) => ({ ...prev, [key]: false }));
      }
    },
    [updateSetting]
  );

  const handleRequestPermissions = useCallback(async () => {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(
        'Push Notifications',
        'To enable push notifications, please allow notifications in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => {
            // On iOS, this would open settings
            // Linking.openSettings();
          }},
        ]
      );
    }
  }, [requestPermissions]);

  const handleDisablePush = useCallback(() => {
    Alert.alert(
      'Disable Push Notifications',
      'This will disable push notifications on this device. You can re-enable them anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disable', 
          style: 'destructive',
          onPress: async () => {
            await removeToken();
          }
        },
      ]
    );
  }, [removeToken]);

  const renderPermissionSection = () => {
    if (isLoading) {
      return (
        <View style={styles.section}>
          <ActivityIndicator size="small" color={palette.navy600} />
        </View>
      );
    }

    if (!hasPermissions) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          <Text style={styles.description}>
            Enable push notifications to stay updated on rounds, messages, and more.
          </Text>
          <Button
            title="Enable Push Notifications"
            onPress={handleRequestPermissions}
            tone="primary"
            style={styles.enableButton}
          />
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.permissionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Push Notifications</Text>
            <Text style={styles.permissionStatus}>Enabled</Text>
          </View>
          <Switch
            value={true}
            onValueChange={handleDisablePush}
            trackColor={{ false: palette.sky300, true: palette.navy600 }}
          />
        </View>
        {pushToken && (
          <Text style={styles.tokenInfo}>
            Token: {pushToken.substring(0, 20)}...
          </Text>
        )}
      </View>
    );
  };

  const renderSettingsSection = () => {
    if (!settings) {
      return (
        <View style={styles.section}>
          <ActivityIndicator size="small" color={palette.navy600} />
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Types</Text>
        <Text style={styles.description}>
          Choose what notifications you'd like to receive.
        </Text>

        {Object.entries(settings).map(([type, config]) => {
          const info = NOTIFICATION_TYPE_LABELS[type] || {
            label: type,
            description: '',
          };
          const pushKey = `${type}_push`;
          const emailKey = `${type}_email`;

          return (
            <View key={type} style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{info.label}</Text>
                <Text style={styles.settingDescription}>{info.description}</Text>
              </View>

              <View style={styles.toggles}>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Push</Text>
                  <Switch
                    value={config.push}
                    onValueChange={(enabled) =>
                      handleToggle(type as keyof Settings, 'push', enabled)
                    }
                    disabled={updating[pushKey]}
                    trackColor={{ false: palette.sky300, true: palette.navy600 }}
                  />
                </View>

                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Email</Text>
                  <Switch
                    value={config.email}
                    onValueChange={(enabled) =>
                      handleToggle(type as keyof Settings, 'email', enabled)
                    }
                    disabled={updating[emailKey]}
                    trackColor={{ false: palette.sky300, true: palette.navy600 }}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {renderPermissionSection()}

      <View style={styles.divider} />

      {renderSettingsSection()}

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>
          Push notifications help you stay connected with your golfing community. 
          You'll receive notifications for round invitations, messages, and important updates.
        </Text>
        <Text style={styles.description}>
          You can manage these settings anytime. Disabling a notification type 
          won't affect your ability to use the app.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
  },
  section: {
    padding: spacing.lg,
    backgroundColor: palette.white,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
    fontFamily: font.display,
  },
  description: {
    fontSize: 14,
    color: palette.ink500,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  permissionStatus: {
    fontSize: 14,
    color: palette.green500,
    fontWeight: '600',
  },
  tokenInfo: {
    fontSize: 12,
    color: palette.ink300,
    marginTop: spacing.sm,
  },
  enableButton: {
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: palette.sky200,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  settingInfo: {
    flex: 1,
    paddingRight: spacing.md,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900,
  },
  settingDescription: {
    fontSize: 13,
    color: palette.ink400,
    marginTop: 2,
  },
  toggles: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggleLabel: {
    fontSize: 12,
    color: palette.ink500,
  },
  errorBanner: {
    backgroundColor: palette.red50,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.sm,
  },
  errorText: {
    color: palette.red500,
    fontSize: 14,
  },
});

export default NotificationSettings;
