/**
 * Inbox Tab Stack Navigator
 *
 * Screen tree:
 *   MyRequests (root)    — legacy: requests (messages, match requests, invites, notifications)
 *   MessageThread        — new: individual message thread (placeholder)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { InboxStackParamList } from './types';
import { useSession } from '../contexts/SessionContext';
import { palette } from '../theme/design';

// Import real existing screen
import { MyRequestsScreen } from '../screens/dashboard/MyRequestsScreen';

const Stack = createNativeStackNavigator<InboxStackParamList>();

// ---------------------------------------------------------------------------
// Screen wrappers
// ---------------------------------------------------------------------------

function MyRequestsWrapper() {
  const { session } = useSession();
  return <MyRequestsScreen session={session} />;
}

// Placeholder for new screen
function MessageThreadScreen({ route }: any) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>Message Thread</Text>
      <Text style={styles.placeholderText}>Thread ID: {route.params?.threadId}</Text>
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

export default function InboxStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="MyRequests"
        component={MyRequestsWrapper}
        options={{ title: 'Inbox', headerShown: false }}
      />
      <Stack.Screen
        name="MessageThread"
        component={MessageThreadScreen}
        options={({ route }: any) => ({
          title: route.params?.participantName ?? 'Message',
        })}
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
