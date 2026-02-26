import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { MapScreen } from './MapScreen';
import { AskScreen } from './dashboard/AskScreen';
import { CallRoomScreen } from './dashboard/CallRoomScreen';
import { ExpertConsoleScreen } from './dashboard/ExpertConsoleScreen';
import { ExpertsScreen } from './dashboard/ExpertsScreen';
import { FeedScreen } from './dashboard/FeedScreen';
import { MatchesScreen } from './dashboard/MatchesScreen';
import { MyRequestsScreen } from './dashboard/MyRequestsScreen';
import { NetworkingHubScreen } from './dashboard/NetworkingHubScreen';
import { ProgressScreen } from './dashboard/ProgressScreen';
import { ProfileScreen } from './dashboard/ProfileScreen';
import { SessionsScreen } from './dashboard/SessionsScreen';
import { SponsoredEventsScreen } from './dashboard/SponsoredEventsScreen';
import { VideoPipelineScreen } from './dashboard/VideoPipelineScreen';
import { loadFeatureFlags } from '../lib/flags';

type TabKey =
  | 'map'
  | 'network'
  | 'events'
  | 'experts'
  | 'ask'
  | 'feed'
  | 'requests'
  | 'call'
  | 'expert'
  | 'sessions'
  | 'matches'
  | 'videos'
  | 'progress'
  | 'profile';

type Props = {
  session: Session;
  onSignOut: () => void;
};

// m-3: Replace if-chain tab title lookup with a Record
const TAB_LABELS: Record<TabKey, string> = {
  map: 'Map',
  network: 'Networking',
  events: 'Sponsored Events',
  experts: 'Experts',
  ask: 'Ask',
  feed: 'Feed',
  requests: 'My Requests',
  call: 'Call Room',
  expert: 'Expert Console',
  sessions: 'Sessions',
  matches: 'Matches',
  videos: 'Videos',
  progress: 'Progress',
  profile: 'Profile',
};

export function DashboardScreen({ session, onSignOut }: Props) {
  const [tab, setTab] = useState<TabKey>('map');

  useEffect(() => {
    const bootstrapFlags = async () => {
      const accessToken = session.access_token ?? '';
      if (!accessToken) return;
      await loadFeatureFlags(accessToken);
    };
    bootstrapFlags();
  }, [session.access_token]);

  const title = TAB_LABELS[tab];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>Spotter</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {/* M-5: Keep screens mounted using display style instead of conditional rendering.
          SessionsScreen and VideoPipelineScreen maintain realtime subscriptions so they
          must stay mounted; other screens are also preserved to avoid re-mount flicker. */}
      <View style={styles.content}>
        <View style={[styles.screen, tab === 'map' ? styles.screenVisible : styles.screenHidden]}>
          <MapScreen />
        </View>
        <View style={[styles.screen, tab === 'network' ? styles.screenVisible : styles.screenHidden]}>
          <NetworkingHubScreen />
        </View>
        <View style={[styles.screen, tab === 'events' ? styles.screenVisible : styles.screenHidden]}>
          <SponsoredEventsScreen />
        </View>
        <View style={[styles.screen, tab === 'experts' ? styles.screenVisible : styles.screenHidden]}>
          <ExpertsScreen session={session} />
        </View>
        <View style={[styles.screen, tab === 'ask' ? styles.screenVisible : styles.screenHidden]}>
          <AskScreen session={session} />
        </View>
        <View style={[styles.screen, tab === 'feed' ? styles.screenVisible : styles.screenHidden]}>
          <FeedScreen />
        </View>
        <View style={[styles.screen, tab === 'requests' ? styles.screenVisible : styles.screenHidden]}>
          <MyRequestsScreen session={session} />
        </View>
        <View style={[styles.screen, tab === 'call' ? styles.screenVisible : styles.screenHidden]}>
          <CallRoomScreen session={session} />
        </View>
        <View style={[styles.screen, tab === 'expert' ? styles.screenVisible : styles.screenHidden]}>
          <ExpertConsoleScreen session={session} />
        </View>
        <View style={[styles.screen, tab === 'sessions' ? styles.screenVisible : styles.screenHidden]}>
          <SessionsScreen session={session} />
        </View>
        <View style={[styles.screen, tab === 'matches' ? styles.screenVisible : styles.screenHidden]}>
          <MatchesScreen session={session} />
        </View>
        <View style={[styles.screen, tab === 'videos' ? styles.screenVisible : styles.screenHidden]}>
          <VideoPipelineScreen session={session} />
        </View>
        <View style={[styles.screen, tab === 'progress' ? styles.screenVisible : styles.screenHidden]}>
          <ProgressScreen session={session} />
        </View>
        <View style={[styles.screen, tab === 'profile' ? styles.screenVisible : styles.screenHidden]}>
          <ProfileScreen session={session} email={session.user.email ?? 'unknown'} onSignOut={onSignOut} />
        </View>
      </View>

      <ScrollView horizontal style={styles.tabBar} contentContainerStyle={styles.tabBarContent} showsHorizontalScrollIndicator={false}>
        <TabButton label="Map" active={tab === 'map'} onPress={() => setTab('map')} />
        <TabButton label="Network" active={tab === 'network'} onPress={() => setTab('network')} />
        <TabButton label="Events" active={tab === 'events'} onPress={() => setTab('events')} />
        <TabButton label="Experts" active={tab === 'experts'} onPress={() => setTab('experts')} />
        <TabButton label="Ask" active={tab === 'ask'} onPress={() => setTab('ask')} />
        <TabButton label="Feed" active={tab === 'feed'} onPress={() => setTab('feed')} />
        <TabButton label="Requests" active={tab === 'requests'} onPress={() => setTab('requests')} />
        <TabButton label="Call" active={tab === 'call'} onPress={() => setTab('call')} />
        <TabButton label="Expert" active={tab === 'expert'} onPress={() => setTab('expert')} />
        <TabButton label="Sessions" active={tab === 'sessions'} onPress={() => setTab('sessions')} />
        <TabButton label="Matches" active={tab === 'matches'} onPress={() => setTab('matches')} />
        <TabButton label="Videos" active={tab === 'videos'} onPress={() => setTab('videos')} />
        <TabButton label="Progress" active={tab === 'progress'} onPress={() => setTab('progress')} />
        <TabButton label="Profile" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </ScrollView>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabButton, active ? styles.tabActive : null]}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f9fc'
  },
  header: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e4ecf2',
    backgroundColor: '#ffffff'
  },
  brand: {
    color: '#0b3a53',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  headerTitle: {
    color: '#102a43',
    fontSize: 24,
    fontWeight: '800'
  },
  content: {
    flex: 1
  },
  // M-5: display:flex/none pattern for keeping screens mounted
  screen: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  screenVisible: {
    display: 'flex'
  },
  screenHidden: {
    display: 'none'
  },
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: '#e4ecf2',
    backgroundColor: '#ffffff',
    paddingVertical: 8
  },
  tabBarContent: {
    paddingHorizontal: 8,
    gap: 8,
    alignItems: 'center'
  },
  tabButton: {
    minWidth: 82,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  tabActive: {
    backgroundColor: '#0b3a53'
  },
  tabText: {
    color: '#486581',
    fontWeight: '600'
  },
  tabTextActive: {
    color: '#ffffff'
  }
});
