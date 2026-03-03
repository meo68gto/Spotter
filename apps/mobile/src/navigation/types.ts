/**
 * Spotter Navigation — TypeScript Type Definitions
 *
 * Defines param lists for all navigators in the app:
 *   - TabParamList           — 5-tab bottom tab navigator
 *   - HomeStackParamList     — Home tab stack
 *   - DiscoverStackParamList — Discover tab stack
 *   - CoachingStackParamList — Coaching tab stack
 *   - InboxStackParamList    — Inbox tab stack
 *   - ProfileStackParamList  — Profile tab stack
 *
 * Usage in screen components:
 *
 *   import type { NativeStackScreenProps } from '@react-navigation/native-stack';
 *   import type { HomeStackParamList } from '../navigation/types';
 *
 *   type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;
 *
 *   export function HomeScreen({ navigation, route }: Props) { ... }
 *
 * Usage in navigation calls:
 *
 *   const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
 *   navigation.navigate('Home');
 */

import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ---------------------------------------------------------------------------
// Root Tab Navigator
// ---------------------------------------------------------------------------

export type TabParamList = {
  HomeTab:     NavigatorScreenParams<HomeStackParamList>;
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  CoachingTab: NavigatorScreenParams<CoachingStackParamList>;
  InboxTab:    NavigatorScreenParams<InboxStackParamList>;
  ProfileTab:  NavigatorScreenParams<ProfileStackParamList>;
};

// ---------------------------------------------------------------------------
// Home Stack
// ---------------------------------------------------------------------------

export type HomeStackParamList = {
  Home: undefined;
};

export type HomeScreenProps = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  BottomTabScreenProps<TabParamList>
>;

// ---------------------------------------------------------------------------
// Discover Stack
// ---------------------------------------------------------------------------

export type DiscoverStackParamList = {
  Map:             undefined;
  NetworkingHub:   undefined;
  SponsoredEvents: undefined;
  Matches:         undefined;
  PlayerProfile:   { playerId: string; playerName?: string };
};

export type MapScreenProps = CompositeScreenProps<
  NativeStackScreenProps<DiscoverStackParamList, 'Map'>,
  BottomTabScreenProps<TabParamList>
>;

export type PlayerProfileScreenProps = CompositeScreenProps<
  NativeStackScreenProps<DiscoverStackParamList, 'PlayerProfile'>,
  BottomTabScreenProps<TabParamList>
>;

// ---------------------------------------------------------------------------
// Coaching Stack
// ---------------------------------------------------------------------------

export type CoachingStackParamList = {
  Experts:      undefined;
  Ask:          undefined;
  Feed:         undefined;
  Sessions:     undefined;
  CallRoom:     undefined;
  CoachProfile: { coachId: string; coachName?: string };
  Booking:      { coachId: string };
};

export type ExpertsScreenProps = CompositeScreenProps<
  NativeStackScreenProps<CoachingStackParamList, 'Experts'>,
  BottomTabScreenProps<TabParamList>
>;

export type CoachProfileScreenProps = CompositeScreenProps<
  NativeStackScreenProps<CoachingStackParamList, 'CoachProfile'>,
  BottomTabScreenProps<TabParamList>
>;

export type BookingScreenProps = CompositeScreenProps<
  NativeStackScreenProps<CoachingStackParamList, 'Booking'>,
  BottomTabScreenProps<TabParamList>
>;

// ---------------------------------------------------------------------------
// Inbox Stack
// ---------------------------------------------------------------------------

export type InboxStackParamList = {
  MyRequests:    undefined;
  MessageThread: { threadId: string; participantName?: string };
};

export type MyRequestsScreenProps = CompositeScreenProps<
  NativeStackScreenProps<InboxStackParamList, 'MyRequests'>,
  BottomTabScreenProps<TabParamList>
>;

export type MessageThreadScreenProps = CompositeScreenProps<
  NativeStackScreenProps<InboxStackParamList, 'MessageThread'>,
  BottomTabScreenProps<TabParamList>
>;

// ---------------------------------------------------------------------------
// Profile Stack
// ---------------------------------------------------------------------------

export type ProfileStackParamList = {
  Profile:       undefined;
  VideoPipeline: undefined;
  Progress:      undefined;
  ExpertConsole: undefined;
  Settings:      undefined;
};

export type ProfileScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'Profile'>,
  BottomTabScreenProps<TabParamList>
>;

export type SettingsScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'Settings'>,
  BottomTabScreenProps<TabParamList>
>;

// ---------------------------------------------------------------------------
// Utility: typed navigation hook
// ---------------------------------------------------------------------------

/**
 * Re-export React Navigation hooks for convenience so screens
 * don't need to import from multiple packages.
 *
 * Usage:
 *   import { useNavigation } from '../navigation/types';
 *   // — or for typed version —
 *   import { useNavigation } from '@react-navigation/native';
 *   const nav = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
 */
export { useNavigation, useRoute } from '@react-navigation/native';
