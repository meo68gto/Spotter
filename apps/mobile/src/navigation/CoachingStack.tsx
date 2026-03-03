/**
 * Coaching Tab Stack Navigator
 *
 * Screen tree:
 *   Experts (root)       — legacy: experts (Coach browse)
 *   Ask                  — legacy: ask
 *   Feed                 — legacy: feed
 *   Sessions             — legacy: sessions
 *   CallRoom             — legacy: call (fullscreen modal)
 *   CoachProfile         — new: coach detail (placeholder)
 *   Booking              — new: booking flow (placeholder)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CoachingStackParamList } from './types';
import { useSession } from '../contexts/SessionContext';
import { palette } from '../theme/design';

// Import real existing screens
import { ExpertsScreen } from '../screens/dashboard/ExpertsScreen';
import { AskScreen } from '../screens/dashboard/AskScreen';
import { FeedScreen } from '../screens/dashboard/FeedScreen';
import { SessionsScreen } from '../screens/dashboard/SessionsScreen';
import { CallRoomScreen } from '../screens/dashboard/CallRoomScreen';

const Stack = createNativeStackNavigator<CoachingStackParamList>();

// ---------------------------------------------------------------------------
// Screen wrappers — bridge session from context to legacy screen props
// ---------------------------------------------------------------------------

function ExpertsWrapper() {
  const { session } = useSession();
  return <ExpertsScreen session={session} />;
}

function AskWrapper() {
  const { session } = useSession();
  return <AskScreen session={session} />;
}

function FeedWrapper() {
  return <FeedScreen />;
}

function SessionsWrapper() {
  const { session } = useSession();
  return <SessionsScreen session={session} />;
}

function CallRoomWrapper() {
  const { session } = useSession();
  return <CallRoomScreen session={session} />;
}

// Placeholders for new screens
function CoachProfileScreen({ route }: any) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>Coach Profile</Text>
      <Text style={styles.placeholderText}>Coach ID: {route.params?.coachId}</Text>
    </View>
  );
}

function BookingScreen({ route }: any) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>Book Session</Text>
      <Text style={styles.placeholderText}>Coach ID: {route.params?.coachId}</Text>
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

export default function CoachingStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Experts"
        component={ExpertsWrapper}
        options={{ title: 'Coaching', headerShown: false }}
      />
      <Stack.Screen
        name="Ask"
        component={AskWrapper}
        options={{ title: 'Ask a Coach' }}
      />
      <Stack.Screen
        name="Feed"
        component={FeedWrapper}
        options={{ title: 'Feed' }}
      />
      <Stack.Screen
        name="Sessions"
        component={SessionsWrapper}
        options={{ title: 'Sessions' }}
      />
      <Stack.Screen
        name="CallRoom"
        component={CallRoomWrapper}
        options={{
          title: 'Call Room',
          presentation: 'fullScreenModal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CoachProfile"
        component={CoachProfileScreen}
        options={({ route }: any) => ({
          title: route.params?.coachName ?? 'Coach Profile',
        })}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ title: 'Book Session' }}
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
