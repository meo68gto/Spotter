/**
 * Discover Tab Stack Navigator — Week 3 Update
 *
 * New screens added:
 *   ListView    → DiscoverListScreen
 *   QuickMatch  → QuickMatchSheet (modal)
 *   EventDetail → EventDetailScreen
 *   EventsList  → EventsListScreen
 *
 * Updated:
 *   Map           → DiscoverMapScreen (replaces MapScreen)
 *   SponsoredEvents → EventsListScreen (legacy route redirected)
 *   PlayerProfile → PlayerProfileSheet (replaces placeholder)
 *   NetworkingHub → NetworkingHubScreen (redesigned, same import)
 *   Matches       → MatchesScreen (preserved)
 *
 * Screen tree:
 *   Map (root)       — Discover map view
 *   ListView         — Grid / list alternative
 *   NetworkingHub    — Redesigned networking hub
 *   SponsoredEvents  — Kept for legacy deep-links → renders EventsListScreen
 *   EventsList       — Events browse screen
 *   Matches          — Match list
 *   PlayerProfile    — Player detail sheet
 *   QuickMatch       — Quick match modal
 *   EventDetail      — Event detail with RSVP
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { DiscoverStackParamList } from './types';
import { useSession } from '../contexts/SessionContext';
import { palette } from '../theme/design';

// ── Week 3 screens ──────────────────────────────────────────────────────────
import DiscoverMapScreen from '../screens/DiscoverMapScreen';
import DiscoverListScreen from '../screens/DiscoverListScreen';
import PlayerProfileSheet from '../screens/PlayerProfileSheet';
import QuickMatchSheet from '../screens/QuickMatchSheet';
import EventDetailScreen from '../screens/EventDetailScreen';
import EventsListScreen from '../screens/EventsListScreen';

// ── Existing screens (preserved / redesigned) ───────────────────────────────
import { NetworkingHubScreen } from '../screens/dashboard/NetworkingHubScreen';
import { MatchesScreen } from '../screens/dashboard/MatchesScreen';

// ─── Stack ────────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

// ─── Screen wrappers — bridge session from context to legacy screen props ────

function DiscoverMapWrapper() {
  return <DiscoverMapScreen />;
}

function DiscoverListWrapper() {
  return <DiscoverListScreen />;
}

function NetworkingHubWrapper() {
  return <NetworkingHubScreen />;
}

function MatchesWrapper() {
  const { session } = useSession();
  return <MatchesScreen session={session} />;
}

function EventsListWrapper() {
  return <EventsListScreen />;
}

function EventDetailWrapper({ route }: any) {
  return <EventDetailScreen />;
}

function PlayerProfileWrapper({ route }: any) {
  return <PlayerProfileSheet playerId={route.params?.playerId} playerName={route.params?.playerName} />;
}

function QuickMatchWrapper() {
  return <QuickMatchSheet />;
}

// ─── Shared screen options ────────────────────────────────────────────────────

const screenOptions = {
  headerStyle: { backgroundColor: palette.white },
  headerTintColor: palette.ink900,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: '#F8FAFC' },
} as const;

// ─── Navigator ────────────────────────────────────────────────────────────────

export default function DiscoverStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {/* Root — Map view */}
      <Stack.Screen
        name="Map"
        component={DiscoverMapWrapper}
        options={{ title: 'Discover', headerShown: false }}
      />

      {/* List / grid view */}
      <Stack.Screen
        name="ListView"
        component={DiscoverListWrapper}
        options={{ title: 'Browse Players', headerShown: false }}
      />

      {/* Networking hub (redesigned) */}
      <Stack.Screen
        name="NetworkingHub"
        component={NetworkingHubWrapper}
        options={{ title: 'Networking', headerShown: false }}
      />

      {/* SponsoredEvents — kept for backward-compat deep links, renders EventsList */}
      <Stack.Screen
        name="SponsoredEvents"
        component={EventsListWrapper}
        options={{ title: 'Events', headerShown: false }}
      />

      {/* Events list — primary route */}
      <Stack.Screen
        name="EventsList"
        component={EventsListWrapper}
        options={{ title: 'Events', headerShown: false }}
      />

      {/* Event detail */}
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.eventTitle ?? 'Event',
          headerShown: false,
        })}
      />

      {/* Match list */}
      <Stack.Screen
        name="Matches"
        component={MatchesWrapper}
        options={{ title: 'Matches' }}
      />

      {/* Player profile sheet */}
      <Stack.Screen
        name="PlayerProfile"
        component={PlayerProfileWrapper}
        options={({ route }: any) => ({
          title: route.params?.playerName ?? 'Player Profile',
          presentation: 'card',
        })}
      />

      {/* Quick match — modal presentation */}
      <Stack.Screen
        name="QuickMatch"
        component={QuickMatchWrapper}
        options={{
          title: 'Quick Match',
          presentation: 'modal',
          headerShown: false,
        }}
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
    color: palette.ink900,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: palette.ink500,
  },
});
