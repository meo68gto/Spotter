import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

export const fireRefreshStartHaptic = async () => {
  if (!supported) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore haptics failures to keep refresh path resilient.
  }
};

export const fireRefreshDoneHaptic = async () => {
  if (!supported) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore haptics failures to keep refresh path resilient.
  }
};
