import { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { loadFeatureFlags } from '../lib/flags';
import { useTheme } from '../theme/provider';
import { radius, spacing } from '../theme/design';
import { DiscoveryScreen } from './discovery/DiscoveryScreen';
import { GolfHomeHubScreen } from './redesign/GolfHomeHubScreen';
import { PlayHubScreen } from './redesign/PlayHubScreen';
import { ImproveHubScreen } from './redesign/ImproveHubScreen';
import { GolferProfileScreen } from './redesign/GolferProfileScreen';
import { RoundsScreen } from './rounds/RoundsScreen';
import { CreateRoundScreen } from './rounds/CreateRoundScreen';
import { RoundInvitationsScreen } from './rounds/RoundInvitationsScreen';
import { RoundDetailScreen } from './rounds/RoundDetailScreen';
import { SponsoredEventsScreen } from './dashboard/SponsoredEventsScreen';
import { EventDetailScreen } from './dashboard/EventDetailScreen';
import { EventRegistrationScreen } from './dashboard/EventRegistrationScreen';
import { CoachingTabScreen } from './dashboard/CoachingTabScreen';
import { VideoScreen } from './VideoScreen';
import { InboxTabScreen } from './dashboard/InboxTabScreen';
import { ProfileScreen } from './ProfileScreen';
import type { DiscoverableGolfer } from '@spotter/types';

export type DeepLinkTarget =
  | 'home'
  | 'feed'
  | 'discover'
  | 'rounds'
  | 'network'
  | 'events'
  | 'coaching'
  | 'videos'
  | 'profile'
  | 'ask'
  | 'requests'
  | 'sessions';

type TabKey = 'home' | 'discover' | 'play' | 'events' | 'improve';
type PlayView = 'hub' | 'rounds' | 'create' | 'invitations' | 'detail' | 'inbox';
type EventsView = 'list' | 'detail' | 'register';
type ImproveView = 'hub' | 'coaching' | 'videos';

type Props = {
  session: Session;
  onSignOut: () => void;
  deepLinkTarget?: DeepLinkTarget | null;
};

const NAV_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'discover', label: 'Discover' },
  { key: 'play', label: 'Play' },
  { key: 'events', label: 'Events' },
  { key: 'improve', label: 'Improve' },
];

export function DashboardScreen({ session, onSignOut, deepLinkTarget }: Props) {
  const { tokens } = useTheme();
  const [tab, setTab] = useState<TabKey>('home');
  const [playView, setPlayView] = useState<PlayView>('hub');
  const [eventsView, setEventsView] = useState<EventsView>('list');
  const [improveView, setImproveView] = useState<ImproveView>('hub');
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedGolfer, setSelectedGolfer] = useState<DiscoverableGolfer | null>(null);
  const [showProfile, setShowProfile] = useState(false);

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
    if (deepLinkTarget === 'events') {
      setTab('events');
      return;
    }
    if (deepLinkTarget === 'coaching' || deepLinkTarget === 'videos') {
      setTab('improve');
      setImproveView(deepLinkTarget === 'videos' ? 'videos' : 'coaching');
      return;
    }
    if (deepLinkTarget === 'discover' || deepLinkTarget === 'network') {
      setTab('discover');
      return;
    }
    if (deepLinkTarget === 'ask' || deepLinkTarget === 'requests' || deepLinkTarget === 'sessions') {
      setTab('play');
      setPlayView('inbox');
      return;
    }
    if (deepLinkTarget === 'rounds') {
      setTab('play');
      setPlayView('rounds');
      return;
    }
    if (deepLinkTarget === 'profile') {
      setShowProfile(true);
      return;
    }
    setTab('home');
  }, [deepLinkTarget]);

  const title = useMemo(() => {
    if (showProfile) return 'Profile';
    return NAV_ITEMS.find((item) => item.key === tab)?.label ?? 'Spotter';
  }, [showProfile, tab]);

  const resetSupportingViews = () => {
    setSelectedGolfer(null);
    setShowProfile(false);
  };

  const selectTab = (next: TabKey) => {
    setTab(next);
    resetSupportingViews();
  };

  const openInbox = () => {
    setTab('play');
    setPlayView('inbox');
  };

  const renderPlay = () => {
    if (playView === 'create') {
      return (
        <CreateRoundScreen
          session={session}
          onComplete={() => setPlayView('rounds')}
          onCancel={() => setPlayView('hub')}
        />
      );
    }
    if (playView === 'invitations') {
      return (
        <RoundInvitationsScreen
          session={session}
          onRoundPress={(roundId) => {
            setSelectedRoundId(roundId);
            setPlayView('detail');
          }}
        />
      );
    }
    if (playView === 'detail' && selectedRoundId) {
      return (
        <RoundDetailScreen
          session={session}
          roundId={selectedRoundId}
          onBack={() => {
            setSelectedRoundId(null);
            setPlayView('rounds');
          }}
        />
      );
    }
    if (playView === 'rounds') {
      return (
        <RoundsScreen
          session={session}
          onCreateRound={() => setPlayView('create')}
          onRoundPress={(round) => {
            setSelectedRoundId(round.id);
            setPlayView('detail');
          }}
        />
      );
    }
    if (playView === 'inbox') {
      return <InboxTabScreen session={session} />;
    }
    return (
      <PlayHubScreen
        session={session}
        onOpenCreateRound={() => setPlayView('create')}
        onOpenMyRounds={() => setPlayView('rounds')}
        onOpenInvites={() => setPlayView('invitations')}
        onOpenInbox={openInbox}
      />
    );
  };

  const renderEvents = () => {
    if (eventsView === 'detail' && selectedEventId) {
      return (
        <EventDetailScreen
          session={session}
          eventId={selectedEventId}
          onRegister={(eventId) => {
            setSelectedEventId(eventId);
            setEventsView('register');
          }}
          onBack={() => setEventsView('list')}
        />
      );
    }
    if (eventsView === 'register' && selectedEventId) {
      return (
        <EventRegistrationScreen
          session={session}
          eventId={selectedEventId}
          onComplete={() => setEventsView('list')}
          onCancel={() => setEventsView('detail')}
        />
      );
    }
    return (
      <SponsoredEventsScreen
        session={session}
        onEventPress={(eventId) => {
          setSelectedEventId(eventId);
          setEventsView('detail');
        }}
      />
    );
  };

  const renderImprove = () => {
    if (improveView === 'coaching') {
      return <CoachingTabScreen session={session} />;
    }
    if (improveView === 'videos') {
      return <VideoScreen session={session} />;
    }
    return (
      <ImproveHubScreen
        session={session}
        onOpenCoaching={() => setImproveView('coaching')}
        onOpenVideo={() => setImproveView('videos')}
      />
    );
  };

  const renderContent = () => {
    if (showProfile) {
      return <ProfileScreen session={session} onSignOut={onSignOut} />;
    }
    if (selectedGolfer) {
      return (
        <GolferProfileScreen
          golfer={selectedGolfer}
          onBack={() => setSelectedGolfer(null)}
          onInvite={() => {
            setSelectedGolfer(null);
            setTab('play');
            setPlayView('create');
          }}
          onSave={() => setSelectedGolfer(null)}
        />
      );
    }
    if (tab === 'home') {
      return (
        <GolfHomeHubScreen
          session={session}
          onOpenDiscover={() => selectTab('discover')}
          onOpenPlay={() => {
            setTab('play');
            setPlayView('rounds');
          }}
          onOpenEvents={() => selectTab('events')}
          onOpenImprove={() => selectTab('improve')}
          onOpenInbox={openInbox}
        />
      );
    }
    if (tab === 'discover') {
      return (
        <DiscoveryScreen
          session={session}
          onOpenGolfer={(golfer) => setSelectedGolfer(golfer)}
          onOpenPlay={() => {
            setTab('play');
            setPlayView('create');
          }}
        />
      );
    }
    if (tab === 'play') return renderPlay();
    if (tab === 'events') return renderEvents();
    return renderImprove();
  };

  return (
    <View style={[styles.root, { backgroundColor: tokens.background }]}>
      <View style={[styles.header, { backgroundColor: tokens.backgroundElevated, borderBottomColor: tokens.border }]}>
        <View>
          <Text style={[styles.brand, { color: tokens.text }]}>Spotter</Text>
          <Text style={[styles.title, { color: tokens.textSecondary }]}>{title}</Text>
        </View>
        <Pressable style={[styles.avatarButton, { backgroundColor: tokens.backgroundMuted, borderColor: tokens.borderStrong }]} onPress={() => setShowProfile(true)}>
          <Text style={[styles.avatarText, { color: tokens.text }]}>{(session.user.email ?? 'G').charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>

      <View style={styles.content}>{renderContent()}</View>

      {!showProfile && !selectedGolfer ? (
        <View style={[styles.tabBar, { backgroundColor: tokens.backgroundElevated, borderTopColor: tokens.border }]}>
          {NAV_ITEMS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable key={item.key} style={styles.tabItem} onPress={() => selectTab(item.key)}>
                <Text style={[styles.tabLabel, { color: active ? tokens.primary : tokens.textMuted }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { fontSize: 22, fontWeight: '900' },
  title: { fontSize: 14, marginTop: 2 },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  tabLabel: { fontSize: 13, fontWeight: '800' },
});
