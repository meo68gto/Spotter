import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  mobilePrimary?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'map', label: 'Discover', group: 'core', mobilePrimary: true },
  { key: 'network', label: 'Network', group: 'core', mobilePrimary: true },
  { key: 'events', label: 'Events', group: 'core', mobilePrimary: true },
  { key: 'ask', label: 'Ask', group: 'growth', mobilePrimary: true },
  { key: 'experts', label: 'Coaches', group: 'growth' },
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

const WEB_PHOTO_TILES = [
  {
    label: 'Golf Pairing',
    image:
      'https://images.pexels.com/photos/114972/pexels-photo-114972.jpeg?auto=compress&cs=tinysrgb&w=1200'
  },
  {
    label: 'Pickleball Community',
    image:
      'https://images.pexels.com/photos/8224736/pexels-photo-8224736.jpeg?auto=compress&cs=tinysrgb&w=1200'
  },
  {
    label: 'Coaching Progress',
    image:
      'https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=1200'
  }
];

const MOBILE_PRIMARY = NAV_ITEMS.filter((item) => item.mobilePrimary).map((item) => item.key) as TabKey[];

export function DashboardScreen({ session, onSignOut }: Props) {
  const [tab, setTab] = useState<TabKey>('map');
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Text style={styles.webBrand}>Spotter</Text>
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.webHeroStrip}>
            {WEB_PHOTO_TILES.map((tile) => (
              <ImageBackground key={tile.label} source={{ uri: tile.image }} style={styles.webHeroTile} imageStyle={styles.webHeroTileImage}>
                <View style={styles.webHeroOverlay}>
                  <Text style={styles.webHeroLabel}>{tile.label}</Text>
                </View>
              </ImageBackground>
            ))}
          </ScrollView>

          <View style={styles.content}>{renderContent()}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mobileRoot}>
      <View style={styles.mobileHeader}>
        <View>
          <Text style={styles.mobileBrand}>Spotter</Text>
          <Text style={styles.mobileTitle}>{title}</Text>
        </View>
        <Pressable onPress={() => setMenuOpen(true)} style={styles.hamburgerButton}>
          <Text style={styles.hamburgerText}>≡</Text>
        </Pressable>
      </View>

      <View style={styles.content}>{renderContent()}</View>

      <View style={styles.mobileTabBar}>
        {MOBILE_PRIMARY.map((key) => {
          const label = NAV_ITEMS.find((item) => item.key === key)?.label ?? key;
          const active = tab === key;
          return (
            <TouchableOpacity key={key} onPress={() => setTab(key)} style={styles.mobileTabButton}>
              <View style={[styles.mobileTabIcon, active ? styles.mobileTabIconActive : null]}>
                <Text style={[styles.mobileTabIconText, active ? styles.mobileTabIconTextActive : null]}>{label.charAt(0)}</Text>
              </View>
              <Text style={[styles.mobileTabText, active ? styles.mobileTabTextActive : null]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuOverlay}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuPanel}>
            <Text style={styles.menuTitle}>More</Text>
            {NAV_ITEMS.filter((item) => !item.mobilePrimary).map((item) => {
              const active = tab === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => {
                    setTab(item.key);
                    setMenuOpen(false);
                  }}
                  style={[styles.menuItem, active ? styles.menuItemActive : null]}
                >
                  <Text style={[styles.menuItemText, active ? styles.menuItemTextActive : null]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
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
  webBrand: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2
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
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
    backgroundColor: palette.white
  },
  mobileHeader: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
    backgroundColor: palette.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mobileBrand: {
    color: palette.navy600,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  mobileTitle: {
    color: palette.ink900,
    fontFamily: font.display,
    fontSize: 22,
    fontWeight: '800'
  },
  hamburgerButton: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.sky300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white
  },
  hamburgerText: {
    fontSize: 24,
    color: palette.navy600,
    marginTop: -2
  },
  headerTitle: {
    color: palette.ink900,
    fontFamily: font.display,
    fontSize: 30,
    fontWeight: '800'
  },
  headerMeta: {
    color: palette.ink500,
    marginTop: 3
  },
  webHeroStrip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md
  },
  webHeroTile: {
    width: 280,
    height: 124,
    justifyContent: 'flex-end'
  },
  webHeroTileImage: {
    borderRadius: radius.md
  },
  webHeroOverlay: {
    backgroundColor: 'rgba(8,47,67,0.58)',
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  webHeroLabel: {
    color: palette.white,
    fontWeight: '700'
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
  mobileTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
    backgroundColor: palette.white,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm
  },
  mobileTabButton: {
    alignItems: 'center',
    minWidth: 70,
    gap: 4
  },
  mobileTabIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.sky300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFD'
  },
  mobileTabIconActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600
  },
  mobileTabIconText: {
    color: palette.ink700,
    fontWeight: '700'
  },
  mobileTabIconTextActive: {
    color: palette.white
  },
  mobileTabText: {
    color: palette.ink500,
    fontWeight: '600',
    fontSize: 12
  },
  mobileTabTextActive: {
    color: palette.navy600,
    fontWeight: '800'
  },
  menuOverlay: {
    flex: 1,
    flexDirection: 'row'
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  menuPanel: {
    width: 280,
    backgroundColor: palette.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    borderLeftWidth: 1,
    borderLeftColor: palette.sky200
  },
  menuTitle: {
    fontFamily: font.display,
    fontWeight: '800',
    fontSize: 22,
    color: palette.ink900,
    marginBottom: spacing.md
  },
  menuItem: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: palette.sky300,
    backgroundColor: '#F8FBFD'
  },
  menuItemActive: {
    borderColor: palette.navy600,
    backgroundColor: palette.sky100
  },
  menuItemText: {
    color: palette.ink700,
    fontWeight: '600'
  },
  menuItemTextActive: {
    color: palette.navy600,
    fontWeight: '800'
  }
});
