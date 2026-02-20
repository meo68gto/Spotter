import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { MapScreen } from './MapScreen';
import { MatchesScreen } from './dashboard/MatchesScreen';
import { ProgressScreen } from './dashboard/ProgressScreen';
import { ProfileScreen } from './dashboard/ProfileScreen';
import { SessionsScreen } from './dashboard/SessionsScreen';
import { VideoPipelineScreen } from './dashboard/VideoPipelineScreen';
import { loadFeatureFlags } from '../lib/flags';

type TabKey = 'map' | 'sessions' | 'matches' | 'videos' | 'progress' | 'profile';

type Props = {
  session: Session;
  onSignOut: () => void;
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

  const title = useMemo(() => {
    if (tab === 'map') return 'Map';
    if (tab === 'sessions') return 'Sessions';
    if (tab === 'matches') return 'Matches';
    if (tab === 'videos') return 'Videos';
    if (tab === 'progress') return 'Progress';
    return 'Profile';
  }, [tab]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>Spotter</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <View style={styles.content}>
        {tab === 'map' ? <MapScreen /> : null}
        {tab === 'sessions' ? <SessionsScreen session={session} /> : null}
        {tab === 'matches' ? <MatchesScreen session={session} /> : null}
        {tab === 'videos' ? <VideoPipelineScreen session={session} /> : null}
        {tab === 'progress' ? <ProgressScreen session={session} /> : null}
        {tab === 'profile' ? (
          <ProfileScreen session={session} email={session.user.email ?? 'unknown'} onSignOut={onSignOut} />
        ) : null}
      </View>

      <View style={styles.tabBar}>
        <TabButton label="Map" active={tab === 'map'} onPress={() => setTab('map')} />
        <TabButton label="Sessions" active={tab === 'sessions'} onPress={() => setTab('sessions')} />
        <TabButton label="Matches" active={tab === 'matches'} onPress={() => setTab('matches')} />
        <TabButton label="Videos" active={tab === 'videos'} onPress={() => setTab('videos')} />
        <TabButton label="Progress" active={tab === 'progress'} onPress={() => setTab('progress')} />
        <TabButton label="Profile" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>
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
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e4ecf2',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
    paddingVertical: 10,
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
