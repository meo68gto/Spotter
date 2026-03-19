import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export interface NotificationData {
  notification_type?: string;
  screen?: string;
  round_id?: string;
  user_id?: string;
  event_id?: string;
  session_id?: string;
  [key: string]: unknown;
}

/**
 * Handles navigation when a notification is tapped.
 * Returns the deep link URL to navigate to.
 */
export function handleNotificationResponse(data: NotificationData): string | null {
  const { notification_type, screen, round_id, user_id, event_id, session_id } = data;

  // Map notification types to screens
  switch (notification_type) {
    case 'round_invitation':
      if (round_id) {
        return `spotter://rounds/${round_id}`;
      }
      return 'spotter://rounds';

    case 'round_reminder':
      if (round_id) {
        return `spotter://rounds/${round_id}`;
      }
      return 'spotter://rounds';

    case 'message':
      if (user_id) {
        return `spotter://profile/${user_id}`;
      }
      return 'spotter://network';

    case 'connection_request':
      return 'spotter://network';

    case 'event_registration':
      if (event_id) {
        return `spotter://events/${event_id}`;
      }
      return 'spotter://discover';

    case 'trust_update':
    case 'reputation_update':
      return 'spotter://profile';

    case 'session_reminder':
      if (session_id) {
        return `spotter://sessions/${session_id}`;
      }
      return 'spotter://sessions';

    default:
      // Fall back to explicit screen if provided
      if (screen) {
        return `spotter://${screen}`;
      }
      return 'spotter://home';
  }
}

/**
 * Configures notification categories for actionable notifications (iOS only)
 */
export async function configureNotificationCategories(): Promise<void> {
  if (Notifications.setNotificationCategoryAsync) {
    // Round invitation category with accept/decline actions
    await Notifications.setNotificationCategoryAsync('ROUND_INVITATION', [
      {
        identifier: 'ACCEPT',
        buttonTitle: 'Accept',
        options: {
          isDestructive: false,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'DECLINE',
        buttonTitle: 'Decline',
        options: {
          isDestructive: true,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'VIEW',
        buttonTitle: 'View',
        options: {
          isForeground: true,
        },
      },
    ]);

    // Message category with reply action
    await Notifications.setNotificationCategoryAsync('MESSAGE', [
      {
        identifier: 'REPLY',
        buttonTitle: 'Reply',
        textInput: {
          submitButtonTitle: 'Send',
          placeholder: 'Type a message...',
        },
        options: {
          isForeground: true,
        },
      },
      {
        identifier: 'VIEW',
        buttonTitle: 'View',
        options: {
          isForeground: true,
        },
      },
    ]);

    // Connection request category
    await Notifications.setNotificationCategoryAsync('CONNECTION_REQUEST', [
      {
        identifier: 'ACCEPT',
        buttonTitle: 'Accept',
        options: {
          isDestructive: false,
        },
      },
      {
        identifier: 'IGNORE',
        buttonTitle: 'Ignore',
        options: {
          isDestructive: true,
        },
      },
    ]);
  }
}

/**
 * Schedules a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: NotificationData,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        badge: 1,
        ...(data.notification_type === 'round_invitation' && { categoryIdentifier: 'ROUND_INVITATION' }),
        ...(data.notification_type === 'message' && { categoryIdentifier: 'MESSAGE' }),
        ...(data.notification_type === 'connection_request' && { categoryIdentifier: 'CONNECTION_REQUEST' }),
      },
      trigger: trigger || { seconds: 1 },
    });
    return id;
  } catch (err) {
    console.error('Failed to schedule local notification:', err);
    return null;
  }
}

/**
 * Cancels all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.error('Failed to cancel notifications:', err);
  }
}

/**
 * Gets the current badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

/**
 * Sets the badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (err) {
    console.error('Failed to set badge count:', err);
  }
}

/**
 * Clears the badge count
 */
export async function clearBadgeCount(): Promise<void> {
  await setBadgeCount(0);
}

/**
 * Parses notification data safely
 */
export function parseNotificationData(data: unknown): NotificationData {
  if (typeof data !== 'object' || data === null) {
    return {};
  }
  return data as NotificationData;
}
