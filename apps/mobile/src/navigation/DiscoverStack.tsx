/**
 * Discover Tab Stack Navigator
 *
 * Root: MapScreen (legacy: map)
 *
 * Screen tree:
 *   Map (root)           — legacy: map
 *   NetworkingHub        — legacy: network
 *   SponsoredEvents      — legacy: events
 *   Matches              — legacy: matches
 *   PlayerProfile        — new: player detail (placeholder)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { DiscoverStackParamList } from './types';
import { useSession } from '../contexts/SessionContext';
import { palette } from '../theme/design';

// Import real existing screens
import { MapScreen } from '../screens/MapScreen';
import { NetworkingHubScreen } from '../screens/dashboard/NetworkingHubScreen';
import { SponsoredEventsScreen } from '../screens/dashboard/SponsoredEventsScreen';
import { MatchesScreen } from '../screens/dashboard/MatchesScreen';

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

// ---------------------------------------------------------------------------
// Screen wrappers — bridge session from context to legacy screen props
// ---------------------------------------------------------------------------

function MapScreenWrapper() {
  return <MapScreen />;
}

function NetworkingHubWrapper() {
  return <NetworkingHubScreen />;
}

function SponsoredEventsWrapper() {
  return <SponsoredEventsScreen />;
}

function MatchesWrapper() {
  const { session } = useSession();
  return <MatchesScreen session={session} />;
}

// Placeholder for new screen
function PlayerProfileScreen({ route }: any) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>Player Profile</Text>
      <Text style={styles.placeholderText}>Player ID: {route.params?.playerId}</Text>
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

export default function DiscoverStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Map"
        component={MapScreenWrapper}
        options={{ title: 'Discover', headerShown: false }}
      />
      <Stack.Screen
        name="NetworkingHub"
        component={NetworkingHubWrapper}
        options={{ title: 'Networking' }}
      />
      <Stack.Screen
        name="SponsoredEvents"
        component={SponsoredEventsWrapper}
        options={{ title: 'Events' }}
      />
      <Stack.Screen
        name="Matches"
        component={MatchesWrapper}
        options={{ title: 'Matches' }}
      />
      <Stack.Screen
        name="PlayerProfile"
        component={PlayerProfileScreen}
        options={({ route }: any) => ({
          title: route.params?.playerName ?? 'Player Profile',
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
