/**
 * Profile Tab Stack Navigator
 *
 * Screen tree:
 *   Profile (root)       — legacy: profile
 *   VideoPipeline        — legacy: videos
 *   Progress             — legacy: progress
 *   ExpertConsole        — legacy: expert (coach role only)
 *   Settings             — new: settings (placeholder)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { useSession } from '../contexts/SessionContext';
import { palette } from '../theme/design';

// Import real existing screens
import { ProfileScreen } from '../screens/dashboard/ProfileScreen';
import { VideoPipelineScreen } from '../screens/dashboard/VideoPipelineScreen';
import { ProgressScreen } from '../screens/dashboard/ProgressScreen';
import { ExpertConsoleScreen } from '../screens/dashboard/ExpertConsoleScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// ---------------------------------------------------------------------------
// Screen wrappers — bridge session from context to legacy screen props
// ---------------------------------------------------------------------------

function ProfileWrapper() {
  const { session, onSignOut } = useSession();
  return (
    <ProfileScreen
      session={session}
      email={session.user.email ?? 'unknown'}
      onSignOut={onSignOut}
    />
  );
}

function VideoPipelineWrapper() {
  const { session } = useSession();
  return <VideoPipelineScreen session={session} />;
}

function ProgressWrapper() {
  const { session } = useSession();
  return <ProgressScreen session={session} />;
}

function ExpertConsoleWrapper() {
  const { session } = useSession();
  return <ExpertConsoleScreen session={session} />;
}

// Placeholder for new screen
function SettingsScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>Settings</Text>
      <Text style={styles.placeholderText}>Notification, privacy, and account settings</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------

const screenOptions = {
  headerStyle: { backgroundColor: palette.white },
  headerTintColor: palette.ink900,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: '#F8FAFC' },
} as const;

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Profile"
        component={ProfileWrapper}
        options={{ title: 'Profile', headerShown: false }}
      />
      <Stack.Screen
        name="VideoPipeline"
        component={VideoPipelineWrapper}
        options={{ title: 'Video Pipeline' }}
      />
      <Stack.Screen
        name="Progress"
        component={ProgressWrapper}
        options={{ title: 'Progress' }}
      />
      <Stack.Screen
        name="ExpertConsole"
        component={ExpertConsoleWrapper}
        options={{ title: 'Expert Console' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B2B4B',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#64748B',
  },
});
