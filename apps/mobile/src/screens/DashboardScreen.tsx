import { useEffect, useMemo, useState } from 'react';
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
import { font, isWeb, palette, radius, spacing } from '../theme/design';

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

type NavItem = {
  key: TabKey;
  label: string;
  group: 'core' | 'growth' | 'ops' | 'account';
};

const NAV_ITEMS: NavItem[] = [
  { key: 'map', label: 'Discover', group: 'core' },
  { key: 'network', label: 'Network', group: 'core' },
  { key: 'events', label: 'Events', group: 'core' },
  { key: 'experts', label: 'Coaches', group: 'growth' },
  { key: 'ask', label: 'Ask', group: 'growth' },
  { key: 'feed', label: 'Feed', group: 'growth' },
  { key: 'requests', label: 'Requests', group: 'growth' },
  { key: 'sessions', label: 'Sessions', group: 'ops' },
  { key: 'matches', label: 'Matches', group: 'ops' },
  { key: 'videos', label: 'Videos', group: 'ops' },
  { key: 'progress', label: 'Progress', group: 'ops' },
  { key: 'expert', label: 'Expert Console', group: 'ops' },
  { key: 'call', label: 'Call Room', group: 'ops' },
  { key: 'profile', label: 'Profile', group: 'account' }
];

const MOBILE_PRIMARY: TabKey[] = ['map', 'network', 'events', 'experts', 'profile'];
const MOBILE_SECONDARY: TabKey[] = ['ask', 'feed', 'requests', 'sessions', 'matches', 'videos', 'progress', 'expert', 'call'];

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

  const title = useMemo(() => NAV_ITEMS.find((item) => item.key === tab)?.label ?? 'Spotter', [tab]);

  const renderContent = () => {
    if (tab === 'map') return <MapScreen />;
    if (tab === 'network') return <NetworkingHubScreen />;
    if (tab === 'events') return <SponsoredEventsScreen />;
    if (tab === 'experts') return <ExpertsScreen session={session} />;
    if (tab === 'ask') return <AskScreen session={session} />;
    if (tab === 'feed') return <FeedScreen />;
    if (tab === 'requests') return <MyRequestsScreen session={session} />;
    if (tab === 'call') return <CallRoomScreen session={session} />;
    if (tab === 'expert') return <ExpertConsoleScreen session={session} />;
    if (tab === 'sessions') return <SessionsScreen session={session} />;
    if (tab === 'matches') return <MatchesScreen session={session} />;
    if (tab === 'videos') return <VideoPipelineScreen session={session} />;
    if (tab === 'progress') return <ProgressScreen session={session} />;
    return <ProfileScreen session={session} email={session.user.email ?? 'unknown'} onSignOut={onSignOut} />;
  };

  if (isWeb) {
    return (
      <View style={styles.webRoot}>
        <View style={styles.webSidebar}>
          <Text style={styles.brand}>Spotter</Text>
          <Text style={styles.sidebarSubtitle}>Match, improve, compete.</Text>

          <NavGroup title="Core" items={NAV_ITEMS.filter((item) => item.group === 'core')} activeTab={tab} onSelect={setTab} />
          <NavGroup title="Growth" items={NAV_ITEMS.filter((item) => item.group === 'growth')} activeTab={tab} onSelect={setTab} />
          <NavGroup title="Operations" items={NAV_ITEMS.filter((item) => item.group === 'ops')} activeTab={tab} onSelect={setTab} />
          <NavGroup title="Account" items={NAV_ITEMS.filter((item) => item.group === 'account')} activeTab={tab} onSelect={setTab} />
        </View>

        <View style={styles.webMain}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerMeta}>{session.user.email ?? 'unknown'}</Text>
          </View>
          <View style={styles.content}>{renderContent()}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mobileRoot}>
      <View style={styles.header}>
        <Text style={styles.brand}>Spotter</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <View style={styles.secondaryRail}>
        <ScrollView horizontal contentContainerStyle={styles.secondaryRailContent} showsHorizontalScrollIndicator={false}>
          {MOBILE_SECONDARY.map((key) => {
            const label = NAV_ITEMS.find((item) => item.key === key)?.label ?? key;
            const active = tab === key;
            return (
              <TouchableOpacity key={key} onPress={() => setTab(key)} style={[styles.secondaryPill, active ? styles.secondaryPillActive : null]}>
                <Text style={[styles.secondaryPillText, active ? styles.secondaryPillTextActive : null]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.content}>{renderContent()}</View>

      <View style={styles.mobileTabBar}>
        {MOBILE_PRIMARY.map((key) => {
          const label = NAV_ITEMS.find((item) => item.key === key)?.label ?? key;
          const active = tab === key;
          return (
            <TouchableOpacity key={key} onPress={() => setTab(key)} style={styles.mobileTabButton}>
              <Text style={[styles.mobileTabText, active ? styles.mobileTabTextActive : null]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function NavGroup({
  title,
  items,
  activeTab,
  onSelect
}: {
  title: string;
  items: NavItem[];
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <View style={styles.navGroup}>
      <Text style={styles.navGroupTitle}>{title}</Text>
      {items.map((item) => {
        const active = item.key === activeTab;
        return (
          <TouchableOpacity key={item.key} onPress={() => onSelect(item.key)} style={[styles.navItem, active ? styles.navItemActive : null]}>
            <Text style={[styles.navItemText, active ? styles.navItemTextActive : null]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: palette.sky100
  },
  webSidebar: {
    width: 280,
    backgroundColor: palette.navy600,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl
  },
  sidebarSubtitle: {
    color: '#CBE4F3',
    marginTop: 2,
    marginBottom: spacing.lg
  },
  webMain: {
    flex: 1
  },
  mobileRoot: {
    flex: 1,
    backgroundColor: palette.sky100
  },
  header: {
    paddingTop: isWeb ? spacing.lg : spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
    backgroundColor: palette.white
  },
  brand: {
    color: isWeb ? palette.white : palette.navy600,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  headerTitle: {
    color: palette.ink900,
    fontFamily: font.display,
    fontSize: isWeb ? 30 : 22,
    fontWeight: '800'
  },
  headerMeta: {
    color: palette.ink500,
    marginTop: 3
  },
  content: {
    flex: 1
  },
  navGroup: {
    marginBottom: spacing.lg
  },
  navGroupTitle: {
    color: '#D8EAF5',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    fontWeight: '700'
  },
  navItem: {
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: 6
  },
  navItemActive: {
    backgroundColor: palette.mint500
  },
  navItemText: {
    color: '#EAF4FA',
    fontWeight: '600'
  },
  navItemTextActive: {
    color: palette.navy700,
    fontWeight: '700'
  },
  secondaryRail: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
    backgroundColor: '#F8FBFD'
  },
  secondaryRailContent: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center'
  },
  secondaryPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: palette.sky300,
    backgroundColor: palette.white
  },
  secondaryPillActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600
  },
  secondaryPillText: {
    color: palette.ink700,
    fontWeight: '600',
    fontSize: 13
  },
  secondaryPillTextActive: {
    color: palette.white
  },
  mobileTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
    backgroundColor: palette.white,
    paddingVertical: spacing.sm
  },
  mobileTabButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  mobileTabText: {
    color: palette.ink500,
    fontWeight: '600',
    fontSize: 13
  },
  mobileTabTextActive: {
    color: palette.navy600,
    fontWeight: '800'
  }
});
