/**
 * Spotter Navigation — Type Definitions
 *
 * Defines every route in the app with its params.
 * All 14 original TabKey screens are preserved and routed to the correct tab.
 *
 * Tab structure (Option C — 5-Tab Marketplace-Optimized):
 *   Home     → HomeScreen
 *   Discover → MapScreen, ListView, NetworkingHubScreen, EventsListScreen, MatchesScreen,
 *              QuickMatch, EventDetail, PlayerProfile
 *   Coaching → ExpertsScreen, AskScreen, FeedScreen, SessionsScreen, CallRoomScreen
 *   Inbox    → MyRequestsScreen, MessageThreadScreen
 *   Profile  → ProfileScreen, VideoPipelineScreen, ProgressScreen, ExpertConsoleScreen
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

// ---------------------------------------------------------------------------
// Home Tab Stack
// ---------------------------------------------------------------------------

export type HomeStackParamList = {
  /** Main home dashboard — sessions, match updates, progress, quick actions */
  Home: undefined;
};

// ---------------------------------------------------------------------------
// Discover Tab Stack
// ---------------------------------------------------------------------------

export type DiscoverStackParamList = {
  /** Map view — root of Discover tab (legacy: map) */
  Map: undefined;
  /** List view — grid/list alternative to map */
  ListView: undefined;
  /** Networking hub — browse/connect with players (legacy: network) */
  NetworkingHub: undefined;
  /** Sponsored & community events — replaces SponsoredEvents */
  SponsoredEvents: undefined;
  /** Events list — browse all upcoming local events */
  EventsList: undefined;
  /** Match results / match list (legacy: matches) */
  Matches: undefined;
  /** Player public profile — deep link from networking/matches */
  PlayerProfile: { playerId: string; playerName?: string };
  /** Quick match flow — presented as modal */
  QuickMatch: undefined;
  /** Event detail — deep link from events list or networking hub */
  EventDetail: { eventId: string; eventTitle?: string };
};

// ---------------------------------------------------------------------------
// Coaching Tab Stack
// ---------------------------------------------------------------------------

export type CoachingStackParamList = {
  /** Browse experts / coaching marketplace (legacy: experts) */
  Experts: undefined;
  /** Ask a question / AI-powered advice (legacy: ask) */
  Ask: undefined;
  /** Community feed / content (legacy: feed) */
  Feed: undefined;
  /** Your coaching sessions list (legacy: sessions) */
  Sessions: undefined;
  /** Live call room (legacy: call) */
  CallRoom: undefined;
  /** Coach/expert public profile — deep link from experts */
  CoachProfile: { coachId: string; coachName?: string };
  /** Session booking flow */
  Booking: { coachId: string; coachName?: string; sessionType?: string };
};

// ---------------------------------------------------------------------------
// Inbox Tab Stack
// ---------------------------------------------------------------------------

export type InboxStackParamList = {
  /**
   * Unified inbox — messages, match requests, session invites, notifications
   * (legacy: requests)
   */
  MyRequests: undefined;
  /** Individual message thread */
  MessageThread: { threadId: string; participantName?: string };
};

// ---------------------------------------------------------------------------
// Profile Tab Stack
// ---------------------------------------------------------------------------

export type ProfileStackParamList = {
  /** User's own profile (legacy: profile) */
  Profile: undefined;
  /** Video upload & pipeline management (legacy: videos) */
  VideoPipeline: undefined;
  /** Progress tracking & analytics (legacy: progress) */
  Progress: undefined;
  /**
   * Expert console — tools for coaches/experts (legacy: expert)
   * Only accessible when user has expert role.
   */
  ExpertConsole: undefined;
  /** App settings */
  Settings: undefined;
};

// ---------------------------------------------------------------------------
// Tab Navigator Param List
// ---------------------------------------------------------------------------

export type TabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  CoachingTab: NavigatorScreenParams<CoachingStackParamList>;
  InboxTab: NavigatorScreenParams<InboxStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// ---------------------------------------------------------------------------
// Root Stack Param List (Auth + Main App)
// ---------------------------------------------------------------------------

export type RootStackParamList = {
  /** Auth screens (sign in, sign up) */
  Auth: undefined;
  /** Legal / Terms & Privacy */
  Legal: undefined;
  /** Onboarding flow */
  Onboarding: undefined;
  /** Main app — tab navigator */
  Main: NavigatorScreenParams<TabParamList>;
};

// ---------------------------------------------------------------------------
// Navigation prop type helpers
// ---------------------------------------------------------------------------

/**
 * @example
 * import type { ScreenProps } from '@/navigation/types';
 * function MapScreen({ navigation, route }: ScreenProps<'DiscoverTab', 'Map'>) {})
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type HomeStackScreenProps<T extends keyof HomeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, T>,
  TabScreenProps<'HomeTab'>
>;

export type DiscoverStackScreenProps<T extends keyof DiscoverStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<DiscoverStackParamList, T>,
  TabScreenProps<'DiscoverTab'>
>;

export type CoachingStackScreenProps<T extends keyof CoachingStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<CoachingStackParamList, T>,
  TabScreenProps<'CoachingTab'>
>;

export type InboxStackScreenProps<T extends keyof InboxStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<InboxStackParamList, T>,
  TabScreenProps<'InboxTab'>
>;

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, T>,
  TabScreenProps<'ProfileTab'>
>;

// ---------------------------------------------------------------------------
// Legacy tab key → new route mapping (for documentation)
// ---------------------------------------------------------------------------

/**
 * Maps every legacy DashboardScreen TabKey to its new navigation destination.
 * This is for developer reference only — not used at runtime.
 */
export const legacyTabKeyToRoute: Record<string, { tab: keyof TabParamList; screen: string }> = {
  map:      { tab: 'DiscoverTab',  screen: 'Map' },
  network:  { tab: 'DiscoverTab',  screen: 'NetworkingHub' },
  events:   { tab: 'DiscoverTab',  screen: 'EventsList' },
  matches:  { tab: 'DiscoverTab',  screen: 'Matches' },
  experts:  { tab: 'CoachingTab',  screen: 'Experts' },
  ask:      { tab: 'CoachingTab',  screen: 'Ask' },
  feed:     { tab: 'CoachingTab',  screen: 'Feed' },
  sessions: { tab: 'CoachingTab',  screen: 'Sessions' },
  call:     { tab: 'CoachingTab',  screen: 'CallRoom' },
  expert:   { tab: 'ProfileTab',   screen: 'ExpertConsole' },
  requests: { tab: 'InboxTab',     screen: 'MyRequests' },
  videos:   { tab: 'ProfileTab',   screen: 'VideoPipeline' },
  progress: { tab: 'ProfileTab',   screen: 'Progress' },
  profile:  { tab: 'ProfileTab',   screen: 'Profile' },
};

// ---------------------------------------------------------------------------
// Utility: typed navigation hook re-exports
// ---------------------------------------------------------------------------

/**
 * Re-export React Navigation hooks for convenience so screens
 * don't need to import from multiple packages.
 */
export { useNavigation, useRoute } from '@react-navigation/native';
