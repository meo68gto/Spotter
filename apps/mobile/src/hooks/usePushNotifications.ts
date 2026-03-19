import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastHost';

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  date: Date;
  read: boolean;
}

export interface NotificationSettings {
  round_invitation: { push: boolean; email: boolean };
  round_reminder: { push: boolean; email: boolean };
  trust_update: { push: boolean; email: boolean };
  reputation_update: { push: boolean; email: boolean };
  event_registration: { push: boolean; email: boolean };
  message: { push: boolean; email: boolean };
  connection_request: { push: boolean; email: boolean };
  session_reminder: { push: boolean; email: boolean };
  general: { push: boolean; email: boolean };
}

interface NotificationDelivery {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channel: 'push' | 'email' | 'sms';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

type NotificationHandler = (notification: PushNotification) => void;
type ResponseHandler = (response: Notifications.NotificationResponse) => void;

export function usePushNotifications(
  userId?: string,
  onNotificationReceived?: NotificationHandler,
  onNotificationResponse?: ResponseHandler
) {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<NotificationDelivery[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const { showToast } = useToast();

  // Initialize notification handler
  useEffect(() => {
    // Set up how notifications are displayed when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    return () => {
      // Cleanup listeners
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Check and load existing permissions/token
  useEffect(() => {
    if (!userId) return;

    const initialize = async () => {
      try {
        // Check existing permission status
        const existingStatus = await Notifications.getPermissionsAsync();
        setPermissionStatus(existingStatus);

        // If permissions granted, try to get existing token
        if (existingStatus.granted) {
          await refreshPushToken();
        }

        // Load settings
        await loadSettings();
        await loadDeliveryHistory();
      } catch (err) {
        console.error('Failed to initialize push notifications:', err);
        setError('Failed to initialize notifications');
      }
    };

    initialize();
  }, [userId]);

  // Set up notification listeners
  useEffect(() => {
    if (!userId) return;

    // Listen for received notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const pushNotification: PushNotification = {
          id: notification.request.identifier,
          title: notification.request.content.title || 'Spotter',
          body: notification.request.content.body || '',
          data: notification.request.content.data as Record<string, unknown>,
          date: new Date(notification.date),
          read: false,
        };

        // Increment unread count
        setUnreadCount((prev) => prev + 1);

        // Call custom handler if provided
        onNotificationReceived?.(pushNotification);

        // Log delivery to backend
        logNotificationDelivery(notification.request.content.data as Record<string, unknown>, 'received');
      }
    );

    // Listen for user interaction with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // Mark as read
        setUnreadCount((prev) => Math.max(0, prev - 1));
        
        // Call custom handler
        onNotificationResponse?.(response);

        // Log interaction
        logNotificationDelivery(response.notification.request.content.data as Record<string, unknown>, 'opened');
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [userId, onNotificationReceived, onNotificationResponse]);

  const refreshPushToken = async (): Promise<string | null> => {
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      if (token?.data) {
        setPushToken(token.data);
        if (userId) {
          await registerTokenWithBackend(token.data);
        }
        return token.data;
      }
      return null;
    } catch (err) {
      console.error('Failed to get push token:', err);
      return null;
    }
  };

  const registerTokenWithBackend = async (token: string): Promise<void> => {
    if (!userId) return;

    try {
      const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      const appVersion = Constants.expoConfig?.version;

      await supabase.rpc('upsert_push_token', {
        p_user_id: userId,
        p_token: token,
        p_platform: platform,
        p_app_version: appVersion,
        p_device_info: {
          model: Device.modelName,
          brand: Device.brand,
          systemVersion: Device.systemVersion,
        },
      });
    } catch (err) {
      console.error('Failed to register token with backend:', err);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (!Device.isDevice) {
      showToast('Push notifications require a physical device', 'warning');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check current permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true,
          },
        });
        finalStatus = status;
      }

      setPermissionStatus({ granted: finalStatus === 'granted' } as Notifications.PermissionStatus);

      if (finalStatus !== 'granted') {
        setError('Permission denied for push notifications');
        showToast('Push notifications disabled. You can enable them in settings.', 'info');
        return false;
      }

      // Get push token
      const token = await refreshPushToken();
      if (!token) {
        throw new Error('Failed to get push token');
      }

      showToast('Push notifications enabled!', 'success');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error requesting permissions:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermissions = async (): Promise<Notifications.PermissionStatus> => {
    const status = await Notifications.getPermissionsAsync();
    setPermissionStatus(status);
    return status;
  };

  const loadSettings = async (): Promise<void> => {
    if (!userId) return;

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', userId);

      if (supabaseError) throw supabaseError;

      if (data) {
        const settingsMap: NotificationSettings = {
          round_invitation: { push: true, email: true },
          round_reminder: { push: true, email: true },
          trust_update: { push: true, email: true },
          reputation_update: { push: true, email: true },
          event_registration: { push: true, email: true },
          message: { push: true, email: true },
          connection_request: { push: true, email: true },
          session_reminder: { push: true, email: true },
          general: { push: true, email: true },
        };

        data.forEach((row) => {
          if (row.notification_type in settingsMap) {
            settingsMap[row.notification_type as keyof NotificationSettings] = {
              push: row.push_enabled,
              email: row.email_enabled,
            };
          }
        });

        setSettings(settingsMap);
      }
    } catch (err) {
      console.error('Failed to load notification settings:', err);
    }
  };

  const updateSetting = async (
    type: keyof NotificationSettings,
    channel: 'push' | 'email',
    enabled: boolean
  ): Promise<void> => {
    if (!userId) return;

    try {
      const { error: supabaseError } = await supabase
        .from('user_notification_settings')
        .upsert(
          {
            user_id: userId,
            notification_type: type,
            [`${channel}_enabled`]: enabled,
          },
          { onConflict: 'user_id,notification_type' }
        );

      if (supabaseError) throw supabaseError;

      // Update local state
      setSettings((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          [type]: {
            ...prev[type],
            [channel]: enabled,
          },
        };
      });
    } catch (err) {
      console.error('Failed to update notification setting:', err);
      throw err;
    }
  };

  const loadDeliveryHistory = async (): Promise<void> => {
    if (!userId) return;

    try {
      const { data, error: supabaseError } = await supabase
        .from('notification_deliveries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (supabaseError) throw supabaseError;

      if (data) {
        setDeliveryHistory(data);
      }
    } catch (err) {
      console.error('Failed to load delivery history:', err);
    }
  };

  const logNotificationDelivery = async (
    data: Record<string, unknown>,
    action: 'received' | 'opened'
  ): Promise<void> => {
    // This is a background operation, don't block on it
    try {
      // Could send to analytics or backend
      console.log(`Notification ${action}:`, data);
    } catch {
      // Silently fail
    }
  };

  const clearUnreadCount = (): void => {
    setUnreadCount(0);
  };

  const scheduleLocalNotification = async (
    title: string,
    body: string,
    data?: Record<string, unknown>,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string | null> => {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          badge: 1,
        },
        trigger: trigger || { seconds: 1 },
      });
      return id;
    } catch (err) {
      console.error('Failed to schedule local notification:', err);
      return null;
    }
  };

  const cancelAllNotifications = async (): Promise<void> => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (err) {
      console.error('Failed to cancel notifications:', err);
    }
  };

  const removeToken = async (): Promise<void> => {
    if (!userId || !pushToken) return;

    try {
      await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('token', pushToken);

      setPushToken(null);
    } catch (err) {
      console.error('Failed to remove token:', err);
    }
  };

  return {
    // State
    pushToken,
    permissionStatus,
    isLoading,
    error,
    settings,
    deliveryHistory,
    unreadCount,
    
    // Actions
    requestPermissions,
    checkPermissions,
    refreshPushToken,
    updateSetting,
    loadSettings,
    loadDeliveryHistory,
    clearUnreadCount,
    scheduleLocalNotification,
    cancelAllNotifications,
    removeToken,
    
    // Derived state
    hasPermissions: permissionStatus?.granted ?? false,
    canRequestPermissions: permissionStatus?.canAskAgain ?? true,
  };
}

export default usePushNotifications;
