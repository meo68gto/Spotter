import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { CoachingTabScreen } from './dashboard/CoachingTabScreen';
import { HomeScreen } from './dashboard/HomeScreen';
import { InboxTabScreen } from './dashboard/InboxTabScreen';
import { ExpertsScreen } from './dashboard/ExpertsScreen';
import { MyRequestsScreen } from './dashboard/MyRequestsScreen';
import { ProfileTabScreen } from './dashboard/ProfileTabScreen';
import { SessionsScreen } from './dashboard/SessionsScreen';
import { stockPhotos } from '../lib/stockPhotos';
import { loadFeatureFlags } from '../lib/flags';
import { font, isWeb, palette, radius, spacing } from '../theme/design';

export type DeepLinkTarget = 'home' | 'discover' | 'coaching' | 'requests' | 'sessions' | 'inbox' | 'profile';

// BETA SCOPE: 7 primary tabs only
// Cut from beta: network, events, ask, feed, matches, videos, progress, expert console, call room, coaches (merged)
// Merged: experts into discover

type TabKey =
  | 'home'
  | 'discover'
  | 'coaching'
  | 'requests'
  | 'sessions'
  | 'inbox'
  | 'profile';

type Props = {
  session: Session;
  onSignOut: () => void;
  deepLinkTarget?: DeepLinkTarget | null;
};

type NavItem = {
  key: TabKey;
  label: string;
  group: 'core' | 'growth' | 'ops' | 'account';
  mobilePrimary?: boolean;
};

// BETA NAV: 7 primary tabs only
const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', group: 'core', mobilePrimary: true },
  { key: 'discover', label: 'Discover', group: 'core', mobilePrimary: true },
  { key: 'coaching', label: 'Coaching', group: 'core', mobilePrimary: true },
  { key: 'requests', label: 'Requests', group: 'core', mobilePrimary: true },
  { key: 'sessions', label: 'Sessions', group: 'core', mobilePrimary: true },
  { key: 'inbox', label: 'Inbox', group: 'core', mobilePrimary: true },
  { key: 'profile', label: 'Profile', group: 'account', mobilePrimary: true }
];

// BETA ONLY - 7 tabs. All other features cut for launch.

const WEB_PHOTO_TILES = [
  { label: 'Golf Pairing', image: stockPhotos.dashboardHeroGolf },
  { label: 'Pickleball Community', image: stockPhotos.dashboardHeroPickleball },
  { label: 'Coaching Progress', image: stockPhotos.dashboardHeroProgress }
];

const MOBILE_PRIMARY = NAV_ITEMS.filter((item) => item.mobilePrimary).map((item) => item.key) as TabKey[];

const mapDeepLinkToTab = (target: DeepLinkTarget): TabKey => {
  // BETA: Only 7 valid destinations
  if (target === 'home') return 'home';
  if (target === 'discover') return 'discover';
  if (target === 'coaching') return 'coaching';
  if (target === 'requests') return 'requests';
  if (target === 'sessions') return 'sessions';
  if (target === 'inbox') return 'inbox';
  if (target === 'profile') return 'profile';
  return 'home';
};

export function DashboardScreen({ session, onSignOut, deepLinkTarget }: Props) {
  const [tab, setTab] = useState<TabKey>('home');

  useEffect(() => {
    const bootstrapFlags = async () => {
      const accessToken = session.access_token ?? '';
      if (!accessToken) return;
      await loadFeatureFlags(accessToken);
    };
    bootstrapFlags();
  }, [session.access_token]);

  useEffect(() => {
    if (!deepLinkTarget) return;
    setTab(mapDeepLinkToTab(deepLinkTarget));
  }, [deepLinkTarget]);

  const title = useMemo(() => NAV_ITEMS.find((item) => item.key === tab)?.label ?? 'Spotter', [tab]);

  const jumpToQuickAction = (target: DeepLinkTarget) => setTab(mapDeepLinkToTab(target));

  const renderContent = () => {
    // BETA SCOPE: 7 tabs only
    if (tab === 'home') return <HomeScreen session={session} onNavigate={jumpToQuickAction} />;
    if (tab === 'discover') return <ExpertsScreen session={session} />; // Merged: discover shows coaches
    if (tab === 'coaching') return <CoachingTabScreen session={session} />;
    if (tab === 'requests') return <MyRequestsScreen session={session} />;
    if (tab === 'sessions') return <SessionsScreen session={session} />;
    if (tab === 'inbox') return <InboxTabScreen session={session} />;
    return <ProfileTabScreen session={session} onSignOut={onSignOut} />;
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

      {/* BETA: No "More" menu - all 7 beta tabs are in the tab bar */}
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
  webMain: { flex: 1 },
  mobileRoot: { flex: 1, backgroundColor: palette.sky100 },
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
  hamburgerText: { fontSize: 24, color: palette.navy600, marginTop: -2 },
  headerTitle: {
    color: palette.ink900,
    fontFamily: font.display,
    fontSize: 30,
    fontWeight: '800'
  },
  headerMeta: { color: palette.ink500 },
  navGroup: { marginTop: spacing.lg },
  navGroupTitle: { color: '#D9E8F2', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  navItem: { borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: 4 },
  navItemActive: { backgroundColor: '#0F4A6A' },
  navItemText: { color: '#D9E8F2', fontFamily: font.body, fontWeight: '600' },
  navItemTextActive: { color: palette.white },
  content: { flex: 1 },
  webHeroStrip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  webHeroTile: { width: 260, height: 120, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'flex-end' },
  webHeroTileImage: { borderRadius: radius.md },
  webHeroOverlay: { backgroundColor: 'rgba(8, 47, 67, 0.45)', padding: spacing.sm },
  webHeroLabel: { color: palette.white, fontWeight: '700', fontSize: 16 },
  mobileTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: palette.sky300,
    backgroundColor: palette.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs
  },
  mobileTabButton: { alignItems: 'center', flex: 1 },
  mobileTabIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.sky200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  mobileTabIconActive: { backgroundColor: palette.navy600 },
  mobileTabIconText: { color: palette.ink700, fontWeight: '700', fontSize: 12 },
  mobileTabIconTextActive: { color: palette.white },
  mobileTabText: { color: palette.ink700, fontSize: 12, fontWeight: '600' },
  mobileTabTextActive: { color: palette.navy600 },
  menuOverlay: { flex: 1, justifyContent: 'flex-end' },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16, 42, 67, 0.4)' },
  menuPanel: { backgroundColor: palette.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  menuTitle: { fontSize: 18, fontWeight: '800', color: palette.ink900, marginBottom: spacing.sm },
  menuItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, marginBottom: 6 },
  menuItemActive: { backgroundColor: palette.sky100 },
  menuItemText: { color: palette.ink700, fontWeight: '600' },
  menuItemTextActive: { color: palette.navy700 }
});
