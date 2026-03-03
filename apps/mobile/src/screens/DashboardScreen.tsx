/**
 * DashboardScreen.tsx — LEGACY REFERENCE (kept for rollback safety)
 *
 * This file is preserved as a reference during the UI Redesign Week 1-2.
 * It is NO LONGER rendered by App.tsx — AppNavigator + TabNavigator
 * replaced it as the main post-auth entry point.
 *
 * DO NOT DELETE until UI Redesign Week 3 sign-off.
 *
 * Original role: single-screen container with custom tab bar and prop-drilled session.
 * New role: reference only.
 *
 * The new architecture uses:
 *   - SessionContext for session state (no prop drilling)
 *   - React Navigation bottom tabs (TabNavigator)
 *   - Per-tab stack navigators with typed param lists
 */

import { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MyRequestsScreen } from './dashboard/MyRequestsScreen';
import { AskScreen } from './dashboard/AskScreen';
import { ExpertsScreen } from './dashboard/ExpertsScreen';
import { FeedScreen } from './dashboard/FeedScreen';
import { SessionsScreen } from './dashboard/SessionsScreen';
import { CallRoomScreen } from './dashboard/CallRoomScreen';
import { MapScreen } from './MapScreen';
import { MatchesScreen } from './dashboard/MatchesScreen';
import { ProfileScreen } from './dashboard/ProfileScreen';
import { NetworkingHubScreen } from './dashboard/NetworkingHubScreen';
import { SponsoredEventsScreen } from './dashboard/SponsoredEventsScreen';
import { ProgressScreen } from './dashboard/ProgressScreen';
import { VideoPipelineScreen } from './dashboard/VideoPipelineScreen';
import { ExpertConsoleScreen } from './dashboard/ExpertConsoleScreen';
import { CustomTabBar } from '../components/CustomTabBar';
import type { TabId } from '../types/navigation';

interface Props {
  session: Session;
  onSignOut: () => void;
}

export function DashboardScreen({ session, onSignOut }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('map');

  const renderScreen = () => {
    switch (activeTab) {
      case 'map':      return <MapScreen />;
      case 'network':  return <NetworkingHubScreen />;
      case 'events':   return <SponsoredEventsScreen />;
      case 'matches':  return <MatchesScreen session={session} />;
      case 'experts':  return <ExpertsScreen session={session} />;
      case 'ask':      return <AskScreen session={session} />;
      case 'feed':     return <FeedScreen />;
      case 'sessions': return <SessionsScreen session={session} />;
      case 'call':     return <CallRoomScreen session={session} />;
      case 'requests': return <MyRequestsScreen session={session} />;
      case 'profile':  return <ProfileScreen session={session} email={session.user.email ?? 'unknown'} onSignOut={onSignOut} />;
      case 'videos':   return <VideoPipelineScreen session={session} />;
      case 'progress': return <ProgressScreen session={session} />;
      case 'expert':   return <ExpertConsoleScreen session={session} />;
      default:         return <MapScreen />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>{renderScreen()}</View>
      <CustomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { flex: 1 },
});
