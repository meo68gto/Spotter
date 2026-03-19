import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { HomeScreen } from './HomeScreen';
import { CoachingTabScreen } from './dashboard/CoachingTabScreen';
import { AskScreen } from './AskScreen';
import { RequestsScreen } from './RequestsScreen';
import { SessionsScreen } from './SessionsScreen';
import { ProfileScreen } from './ProfileScreen';
import { DiscoveryScreen } from './discovery/DiscoveryScreen';
import { MatchingScreen } from './matching/MatchingScreen';
import { RoundsScreen } from './rounds/RoundsScreen';
import { CreateRoundScreen } from './rounds/CreateRoundScreen';
import { RoundInvitationsScreen } from './rounds/RoundInvitationsScreen';
import { RoundDetailScreen } from './rounds/RoundDetailScreen';
import { NetworkScreen } from './network/NetworkScreen';
import { SavedMembersScreen } from './network/SavedMembersScreen';
import { SponsoredEventsScreen } from './dashboard/SponsoredEventsScreen';
import { EventDetailScreen } from './dashboard/EventDetailScreen';
import { EventRegistrationScreen } from './dashboard/EventRegistrationScreen';
import {
  OrganizerDashboardScreen,
  OrganizerEventCreateScreen,
  OrganizerEventDetailScreen,
  OrganizerRegistrationListScreen
} from './dashboard/organizer';
import { stockPhotos } from '../lib/stockPhotos';
import { loadFeatureFlags } from '../lib/flags';
import { font, isWeb, palette, radius, spacing } from '../theme/design';

export type DeepLinkTarget = 'home' | 'coaching' | 'ask' | 'requests' | 'sessions' | 'profile' | 'discover' | 'rounds' | 'network' | 'events' | 'organizer';

// BETA SCOPE: 10 tabs including Discovery, Rounds, Network, and Events for Phase 2
// Previously cut: feed, matches, videos, progress, expert console, call room, inbox
// Kept: home, coaching, ask, requests, sessions, profile, discover, rounds, network, events

type TabKey =
  | 'home'
  | 'coaching'
  | 'ask'
  | 'requests'
  | 'sessions'
  | 'profile'
  | 'discover'
  | 'rounds'
  | 'network'
  | 'events'
  | 'organizer';

type Props = {
  session: Session;
  onSignOut: () => void;
  deepLinkTarget?: DeepLinkTarget | null;
};

type NetworkView = 'network' | 'saved-members' | 'profile';
type EventsView = 'list' | 'detail' | 'register';
type OrganizerView = 'dashboard' | 'create' | 'detail' | 'registrations';

type NavItem = {
  key: TabKey;
  label: string;
  group: 'core' | 'growth' | 'ops' | 'account';
  mobilePrimary?: boolean;
};

// REPOSITIONED: Coaching moved from 'core' to 'account' group (Epic 8)
// ADDED: Events to core group
// ADDED: Organizer to account group
const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', group: 'core', mobilePrimary: true },
  { key: 'discover', label: 'Discover', group: 'core', mobilePrimary: true },
  { key: 'rounds', label: 'Rounds', group: 'core', mobilePrimary: true },
  { key: 'events', label: 'Events', group: 'core', mobilePrimary: true },
  { key: 'ask', label: 'Ask', group: 'core', mobilePrimary: true },
  { key: 'requests', label: 'Requests', group: 'core', mobilePrimary: true },
  { key: 'sessions', label: 'Sessions', group: 'core', mobilePrimary: true },
  { key: 'network', label: 'Network', group: 'core', mobilePrimary: true },
  { key: 'profile', label: 'Profile', group: 'account', mobilePrimary: true },
  { key: 'coaching', label: 'Coaching', group: 'account', mobilePrimary: false }, // Secondary nav
  { key: 'organizer', label: 'Organizer', group: 'account', mobilePrimary: false } // Secondary nav
];

const WEB_PHOTO_TILES = [
  { label: 'Golf Pairing', image: stockPhotos.dashboardHeroGolf },
  { label: 'Improve Your Game', image: stockPhotos.dashboardHeroProgress } // Changed from Pickleball Community
];

const MOBILE_PRIMARY = NAV_ITEMS.filter((item) => item.mobilePrimary).map((item) => item.key) as TabKey[];

const mapDeepLinkToTab = (target: DeepLinkTarget): TabKey => {
  // BETA: All 11 valid destinations
  if (target === 'home') return 'home';
  if (target === 'coaching') return 'coaching';
  if (target === 'ask') return 'ask';
  if (target === 'requests') return 'requests';
  if (target === 'sessions') return 'sessions';
  if (target === 'profile') return 'profile';
  if (target === 'discover') return 'discover';
  if (target === 'rounds') return 'rounds';
  if (target === 'network') return 'network';
  if (target === 'events') return 'events';
  if (target === 'organizer') return 'organizer';
  return 'home';
};

export function DashboardScreen({ session, onSignOut, deepLinkTarget }: Props) {
  const [tab, setTab] = useState<TabKey>('home');
  const [roundsView, setRoundsView] = useState<'list' | 'create' | 'invitations' | 'detail'>('list');
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [networkView, setNetworkView] = useState<NetworkView>('network');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [eventsView, setEventsView] = useState<EventsView>('list');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventPrice, setSelectedEventPrice] = useState<number>(0);
  const [organizerView, setOrganizerView] = useState<OrganizerView>('dashboard');
  const [selectedOrganizerEventId, setSelectedOrganizerEventId] = useState<string | null>(null);

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

  const handleCreateRound = () => {
    setRoundsView('create');
  };

  const handleRoundPress = (roundId: string) => {
    setSelectedRoundId(roundId);
    setRoundsView('detail');
  };

  const handleRoundComplete = () => {
    setRoundsView('list');
  };

  const handleCancelCreate = () => {
    setRoundsView('list');
  };

  // Network sub-view navigation handlers
  const handleNavigateToSavedMembers = () => {
    setNetworkView('saved-members');
  };

  const handleNavigateToNetwork = () => {
    setNetworkView('network');
  };

  const handleNavigateToProfile = (userId: string) => {
    setSelectedProfileId(userId);
    setNetworkView('profile');
  };

  // Events sub-view navigation handlers
  const handleEventPress = (eventId: string) => {
    setSelectedEventId(eventId);
    setEventsView('detail');
  };

  const handleEventRegister = (eventId: string, price: number) => {
    setSelectedEventId(eventId);
    setSelectedEventPrice(price);
    setEventsView('register');
  };

  const handleEventsBackToList = () => {
    setEventsView('list');
    setSelectedEventId(null);
    setSelectedEventPrice(0);
  };

  const handleRegistrationComplete = () => {
    setEventsView('list');
    setSelectedEventId(null);
    setSelectedEventPrice(0);
  };

  // Organizer navigation handlers
  const handleNavigateToOrganizerDashboard = () => {
    setOrganizerView('dashboard');
    setSelectedOrganizerEventId(null);
  };

  const handleNavigateToOrganizerEventCreate = () => {
    setOrganizerView('create');
  };

  const handleNavigateToOrganizerEventDetail = (eventId: string) => {
    setSelectedOrganizerEventId(eventId);
    setOrganizerView('detail');
  };

  const handleNavigateToOrganizerRegistrations = () => {
    setOrganizerView('registrations');
  };

  const handleOrganizerEventCreateComplete = () => {
    setOrganizerView('dashboard');
  };

  const renderContent = () => {
    // BETA SCOPE: 10 tabs including Discovery, Rounds, Network, and Events
    if (tab === 'home') return <HomeScreen session={session} onNavigate={jumpToQuickAction} />;
    if (tab === 'discover') return <DiscoveryScreen session={session} />;
    if (tab === 'network') {
      if (networkView === 'saved-members') {
        return (
          <SavedMembersScreen
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToNetwork={handleNavigateToNetwork}
            onBack={handleNavigateToNetwork}
          />
        );
      }
      if (networkView === 'profile' && selectedProfileId) {
        // For now, redirect back to network if profile navigation attempted
        // In a full implementation, this would render ProfileScreen with userId
        setNetworkView('network');
        setSelectedProfileId(null);
        return <NetworkScreen
          session={session}
          onNavigateToSavedMembers={handleNavigateToSavedMembers}
          onNavigateToProfile={handleNavigateToProfile}
          onNavigateToDiscovery={jumpToQuickAction.bind(null, 'discover')}
        />;
      }
      return <NetworkScreen
        session={session}
        onNavigateToSavedMembers={handleNavigateToSavedMembers}
        onNavigateToProfile={handleNavigateToProfile}
        onNavigateToDiscovery={jumpToQuickAction.bind(null, 'discover')}
      />;
    }
    if (tab === 'rounds') {
      if (roundsView === 'create') {
        return (
          <CreateRoundScreen
            session={session}
            onComplete={handleRoundComplete}
            onCancel={handleCancelCreate}
          />
        );
      }
      if (roundsView === 'invitations') {
        return (
          <RoundInvitationsScreen
            session={session}
            onRoundPress={handleRoundPress}
          />
        );
      }
      if (roundsView === 'detail' && selectedRoundId) {
        return (
          <RoundDetailScreen
            session={session}
            roundId={selectedRoundId}
            onBack={() => {
              setRoundsView('list');
              setSelectedRoundId(null);
            }}
          />
        );
      }
      return (
        <RoundsScreen
          session={session}
          onCreateRound={handleCreateRound}
          onRoundPress={(round) => handleRoundPress(round.id)}
        />
      );
    }
    if (tab === 'events') {
      if (eventsView === 'detail' && selectedEventId) {
        return (
          <EventDetailScreen
            session={session}
            eventId={selectedEventId}
            onRegister={handleEventRegister}
            onBack={handleEventsBackToList}
          />
        );
      }
      if (eventsView === 'register' && selectedEventId) {
        return (
          <EventRegistrationScreen
            session={session}
            eventId={selectedEventId}
            onComplete={handleRegistrationComplete}
            onCancel={handleEventsBackToList}
          />
        );
      }
      return (
        <SponsoredEventsScreen
          session={session}
          onEventPress={handleEventPress}
        />
      );
    }
    if (tab === 'coaching') return <CoachingTabScreen session={session} />;
    if (tab === 'organizer') {
      if (organizerView === 'create') {
        return (
          <OrganizerEventCreateScreen
            session={session}
            onComplete={handleOrganizerEventCreateComplete}
            onCancel={handleNavigateToOrganizerDashboard}
          />
        );
      }
      if (organizerView === 'detail' && selectedOrganizerEventId) {
        return (
          <OrganizerEventDetailScreen
            session={session}
            eventId={selectedOrganizerEventId}
            onBack={handleNavigateToOrganizerDashboard}
            onNavigateToRegistrations={handleNavigateToOrganizerRegistrations}
          />
        );
      }
      if (organizerView === 'registrations') {
        return (
          <OrganizerRegistrationListScreen
            session={session}
            eventId={selectedOrganizerEventId || undefined}
            onBack={selectedOrganizerEventId ? () => {
              setOrganizerView('detail');
            } : handleNavigateToOrganizerDashboard}
          />
        );
      }
      return (
        <OrganizerDashboardScreen
          session={session}
          onNavigateToEventCreate={handleNavigateToOrganizerEventCreate}
          onNavigateToEventDetail={handleNavigateToOrganizerEventDetail}
          onNavigateToRegistrations={handleNavigateToOrganizerRegistrations}
        />
      );
    }
    if (tab === 'ask') return <AskScreen session={session} />;
    if (tab === 'requests') return <RequestsScreen session={session} />;
    if (tab === 'sessions') return <SessionsScreen session={session} />;
    return <ProfileScreen session={session} onSignOut={onSignOut} />;
  };

  if (isWeb) {
    return (
      <View style={styles.webRoot}>
        <View style={styles.webSidebar}>
          <Text style={styles.webBrand}>Spotter</Text>
          <Text style={styles.sidebarSubtitle}>Match, improve, compete.</Text>

          <NavGroup title="Core" items={NAV_ITEMS.filter((item) => item.group === 'core')} activeTab={tab} onSelect={(newTab) => {
            setTab(newTab);
            setRoundsView('list');
            if (newTab !== 'events') {
              setEventsView('list');
              setSelectedEventId(null);
            }
            if (newTab !== 'organizer') {
              setOrganizerView('dashboard');
              setSelectedOrganizerEventId(null);
            }
          }} />
          <NavGroup title="Account" items={NAV_ITEMS.filter((item) => item.group === 'account')} activeTab={tab} onSelect={(newTab) => {
            setTab(newTab);
            setRoundsView('list');
            setEventsView('list');
            setSelectedEventId(null);
            if (newTab !== 'organizer') {
              setOrganizerView('dashboard');
              setSelectedOrganizerEventId(null);
            }
          }} />
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
            <TouchableOpacity 
              key={key} 
              onPress={() => {
                setTab(key);
                if (key !== 'rounds') {
                  setRoundsView('list');
                }
                if (key !== 'events') {
                  setEventsView('list');
                  setSelectedEventId(null);
                }
                if (key !== 'organizer') {
                  setOrganizerView('dashboard');
                  setSelectedOrganizerEventId(null);
                }
              }} 
              style={styles.mobileTabButton}
            >
              <View style={[styles.mobileTabIcon, active ? styles.mobileTabIconActive : null]}>
                <Text style={[styles.mobileTabIconText, active ? styles.mobileTabIconTextActive : null]}>{label.charAt(0)}</Text>
              </View>
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
  mobileTabText: { color: palette.ink700, fontSize: 10, fontWeight: '600' },
  mobileTabTextActive: { color: palette.navy600 },
});
