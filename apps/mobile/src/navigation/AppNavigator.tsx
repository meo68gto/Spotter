/**
 * Spotter — Root App Navigator
 *
 * Wraps TabNavigator in a NavigationContainer.
 * This replaces DashboardScreen as the main post-auth component.
 *
 * The NavigationContainer is placed here so that AppNavigator can be
 * dropped in as a direct replacement for DashboardScreen in App.tsx:
 *
 *   // Before:
 *   <DashboardScreen session={session} onSignOut={handleSignOut} />
 *
 *   // After:
 *   <AppNavigator />
 *
 * Session state is accessed via SessionContext — no prop drilling needed.
 *
 * Linking config can be added here for deep links and universal links.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import TabNavigator from './TabNavigator';
import { palette } from '../theme/design';

// ---------------------------------------------------------------------------
// Navigation theme (matches Spotter brand)
// ---------------------------------------------------------------------------

const navigationTheme = {
  dark: false,
  colors: {
    primary: palette.mint500,
    background: palette.gray50,
    card: palette.white,
    text: palette.ink900,
    border: palette.gray100,
    notification: palette.red500,
  },
};

// ---------------------------------------------------------------------------
// Linking configuration
// Deep link scheme: spotter://
// ---------------------------------------------------------------------------

const linking = {
  prefixes: ['spotter://', 'https://app.spotter.com'],
  config: {
    screens: {
      HomeTab: {
        screens: {
          Home: 'home',
        },
      },
      DiscoverTab: {
        screens: {
          Map: 'discover',
          NetworkingHub: 'discover/network',
          SponsoredEvents: 'discover/events',
          Matches: 'discover/matches',
          PlayerProfile: 'discover/player/:playerId',
        },
      },
      CoachingTab: {
        screens: {
          Experts: 'coaching',
          Ask: 'coaching/ask',
          Feed: 'coaching/feed',
          Sessions: 'coaching/sessions',
          CallRoom: 'coaching/call/:sessionId',
          CoachProfile: 'coaching/coach/:coachId',
          Booking: 'coaching/book/:coachId',
        },
      },
      InboxTab: {
        screens: {
          MyRequests: 'inbox',
          MessageThread: 'inbox/thread/:threadId',
        },
      },
      ProfileTab: {
        screens: {
          Profile: 'profile',
          VideoPipeline: 'profile/videos',
          Progress: 'profile/progress',
          ExpertConsole: 'profile/expert',
          Settings: 'profile/settings',
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// AppNavigator
// ---------------------------------------------------------------------------

export default function AppNavigator(): React.ReactElement {
  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      <TabNavigator />
    </NavigationContainer>
  );
}
