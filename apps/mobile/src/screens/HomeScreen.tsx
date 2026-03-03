import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, radius, font, isWeb } from '../../theme/design';
import {
  Button,
  Avatar,
  Badge,
  StatCard,
  SkeletonLoader,
  EmptyState,
  ProgressRing,
  MatchCard,
  Header,
} from '../../components';
import { useSession } from '../../contexts/SessionContext';
import { useHomeData } from '../hooks/useHomeData';
import type { SessionRecord, MatchRecord } from '../hooks/useHomeData';
import { supabase } from '../../lib/supabase';

type RootNavigation = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

function formatSessionTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getPartnerName(session: SessionRecord, userId: string): string {
  const partnerId = session.proposer_user_id === userId ? session.partner_user_id : session.proposer_user_id;
  return `Player #${partnerId.slice(0, 6).toUpperCase()}`;
}

function getSportName(activityId: string): string {
  return activityId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface SessionCardProps { session: SessionRecord; userId: string; onPress: () => void; }

const SessionCard: React.FC<SessionCardProps> = ({ session, userId, onPress }) => {
  const partnerName = getPartnerName(session, userId);
  const time = formatSessionTime(session.proposed_start_time);
  const sport = getSportName(session.activity_id);
  const isConfirmed = session.status === 'confirmed';
  return (
    <TouchableOpacity style={styles.sessionCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.sessionCardHeader}>
        <Badge label={isConfirmed ? 'Confirmed' : 'Pending'} variant={isConfirmed ? 'success' : 'warning'} />
        <Text style={styles.sessionTime}>Today · {time}</Text>
      </View>
      <Text style={styles.sessionTitle}>{sport} with {partnerName}</Text>
      <Button label="View Details" variant="outline" size="sm" onPress={onPress} style={styles.sessionCTA} />
    </TouchableOpacity>
  );
};

interface BookSessionCardProps { onPress: () => void; }

const BookSessionCard: React.FC<BookSessionCardProps> = ({ onPress }) => (
  <TouchableOpacity style={[styles.sessionCard, styles.bookSessionCard]} onPress={onPress} activeOpacity={0.85}>
    <Ionicons name="calendar-outline" size={28} color={palette.mint400} />
    <Text style={styles.bookSessionTitle}>No sessions today</Text>
    <Text style={styles.bookSessionSub}>Book a session with a coach or partner</Text>
    <Button label="Book a session" variant="primary" size="sm" onPress={onPress} style={styles.sessionCTA} />
  </TouchableOpacity>
);

interface MatchRequestCardProps { match: MatchRecord; onAccept: () => void; onDecline: () => void; }

const MatchRequestCard: React.FC<MatchRequestCardProps> = ({ match, onAccept, onDecline }) => {
  const sport = getSportName(match.activity_id);
  const requesterId = match.requester_user_id.slice(0, 6).toUpperCase();
  return (
    <View style={styles.matchRequestCard}>
      <Avatar userId={match.requester_user_id} size="md" />
      <View style={styles.matchRequestInfo}>
        <Text style={styles.matchRequestName}>Player #{requesterId}</Text>
        <Text style={styles.matchRequestSub}>Wants to play {sport}</Text>
      </View>
      <View style={styles.matchRequestActions}>
        <TouchableOpacity style={[styles.matchActionBtn, styles.acceptBtn]} onPress={onAccept} activeOpacity={0.8}>
          <Ionicons name="checkmark" size={16} color={palette.white} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.matchActionBtn, styles.declineBtn]} onPress={onDecline} activeOpacity={0.8}>
          <Ionicons name="close" size={16} color={palette.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface MapPreviewStripProps { onPress: () => void; }

const MapPreviewStrip: React.FC<MapPreviewStripProps> = ({ onPress }) => (
  <TouchableOpacity style={styles.mapPreview} onPress={onPress} activeOpacity={0.9}>
    <View style={styles.mapPlaceholderBg} />
    {[{ top: 44, left: 60 }, { top: 72, left: 140 }, { top: 56, left: 220 }, { top: 88, left: 290 }].map((pos, i) => (
      <View key={i} style={[styles.mapPinWrapper, { top: pos.top, left: pos.left }]}>
        <Ionicons name="location" size={20} color={palette.mint500} />
      </View>
    ))}
    <View style={styles.mapOverlayLabel}>
      <Ionicons name="map-outline" size={14} color={palette.white} />
      <Text style={styles.mapOverlayText}>Tap to explore nearby players</Text>
    </View>
  </TouchableOpacity>
);

interface SectionHeaderProps { label: string; actionLabel?: string; onAction?: () => void; }

const SectionHeader: React.FC<SectionHeaderProps> = ({ label, actionLabel, onAction }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionOverline}>{label}</Text>
    {actionLabel && onAction ? (
      <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
        <Text style={styles.sectionSeeAll}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigation>();
  const { session } = useSession();
  const userId = session?.user?.id ?? '';
  const userMetadata = session?.user?.user_metadata ?? {};
  const firstName: string =
    (userMetadata.full_name as string | undefined)?.split(' ')[0] ??
    (userMetadata.name as string | undefined)?.split(' ')[0] ??
    'Athlete';
  const avatarUrl: string | null = (userMetadata.avatar_url as string | null) ?? null;
  const { todaySessions, pendingMatches, weeklyStats, loading, error, refresh } = useHomeData();
  const SESSION_GOAL = 3;
  const goalProgress = useMemo(() => Math.min(weeklyStats.sessionsPlayed / SESSION_GOAL, 1), [weeklyStats.sessionsPlayed]);

  const handleAcceptMatch = useCallback(async (match: MatchRecord) => {
    try { await supabase.from('matches').update({ status: 'accepted' }).eq('id', match.id); await refresh(); } catch {}
  }, [refresh]);

  const handleDeclineMatch = useCallback(async (match: MatchRecord) => {
    try { await supabase.from('matches').update({ status: 'declined' }).eq('id', match.id); await refresh(); } catch {}
  }, [refresh]);

  const navigateTo = useCallback((tab: string, params?: Record<string, unknown>) => { navigation.navigate(tab, params); }, [navigation]);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.loadingHeader}>
          <SkeletonLoader width={200} height={28} borderRadius={radius.md} />
          <SkeletonLoader width={40} height={40} borderRadius={radius.full} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.skeletonSection}>
            <SkeletonLoader width={120} height={12} borderRadius={radius.sm} style={styles.skeletonLabel} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <SkeletonLoader width={240} height={120} borderRadius={radius.lg} style={styles.skeletonCard} />
              <SkeletonLoader width={240} height={120} borderRadius={radius.lg} style={styles.skeletonCard} />
            </ScrollView>
          </View>
          <View style={styles.skeletonSection}>
            <SkeletonLoader width={140} height={12} borderRadius={radius.sm} style={styles.skeletonLabel} />
            <SkeletonLoader width="100%" height={72} borderRadius={radius.lg} style={styles.skeletonCard} />
            <SkeletonLoader width="100%" height={72} borderRadius={radius.lg} style={styles.skeletonCard} />
          </View>
          <View style={styles.skeletonSection}>
            <SkeletonLoader width={80} height={12} borderRadius={radius.sm} style={styles.skeletonLabel} />
            <SkeletonLoader width="100%" height={160} borderRadius={radius.lg} style={styles.skeletonCard} />
          </View>
          <View style={styles.quickActionsRow}>
            <SkeletonLoader width="30%" height={72} borderRadius={radius.lg} />
            <SkeletonLoader width="30%" height={72} borderRadius={radius.lg} />
            <SkeletonLoader width="30%" height={72} borderRadius={radius.lg} />
          </View>
          <SkeletonLoader width="100%" height={120} borderRadius={radius.lg} style={styles.skeletonCard} />
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.root}>
        <EmptyState icon="alert-circle-outline" title="Couldn't load your dashboard" subtitle={error} action={{ label: 'Try again', onPress: refresh }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header
        variant="large-title"
        left={
          <View style={styles.headerLeft}>
            <Ionicons name="tennisball" size={24} color={palette.mint500} style={styles.headerLogo} />
            <Text style={styles.headerGreeting}>{getGreeting()}, {firstName}</Text>
          </View>
        }
        right={
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifBtn} onPress={() => navigateTo('Notifications')} accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={22} color={palette.ink700} />
              {pendingMatches.length > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{pendingMatches.length > 9 ? '9+' : pendingMatches.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigateTo('Profile')} accessibilityLabel="Profile">
              <Avatar userId={userId} avatarUrl={avatarUrl} size="sm" />
            </TouchableOpacity>
          </View>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.mint500} colors={[palette.mint500]} />}
      >
        <SectionHeader label="TODAY" />
        {todaySessions.length === 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            <BookSessionCard onPress={() => navigateTo('Coaching')} />
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {todaySessions.map((s) => (
              <SessionCard key={s.id} session={s} userId={userId} onPress={() => navigateTo('SessionDetail', { sessionId: s.id })} />
            ))}
            <TouchableOpacity style={[styles.sessionCard, styles.addMoreCard]} onPress={() => navigateTo('Coaching')} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={28} color={palette.mint400} />
              <Text style={styles.addMoreText}>Add session</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
        <SectionHeader label="MATCH UPDATES" actionLabel={pendingMatches.length > 0 ? 'See all' : undefined} onAction={() => navigateTo('Inbox')} />
        {pendingMatches.length === 0 ? (
          <EmptyState icon="people-outline" title="No new match requests" subtitle="When someone wants to play with you, they'll appear here." compact action={{ label: 'Find players', onPress: () => navigateTo('Discover') }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {pendingMatches.map((m) => (
              <MatchRequestCard key={m.id} match={m} onAccept={() => void handleAcceptMatch(m)} onDecline={() => void handleDeclineMatch(m)} />
            ))}
          </ScrollView>
        )}
        <SectionHeader label="NEAR YOU" />
        <MapPreviewStrip onPress={() => navigateTo('Discover')} />
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigateTo('Discover')} activeOpacity={0.85}>
            <View style={[styles.quickActionIcon, { backgroundColor: palette.navy600 }]}>
              <Ionicons name="compass" size={20} color={palette.white} />
            </View>
            <Text style={styles.quickActionLabel}>Find{'\n'}Partner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigateTo('Coaching')} activeOpacity={0.85}>
            <View style={[styles.quickActionIcon, { backgroundColor: palette.navy600 }]}>
              <Ionicons name="school" size={20} color={palette.white} />
            </View>
            <Text style={styles.quickActionLabel}>Book{'\n'}Coach</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigateTo('Upload')} activeOpacity={0.85}>
            <View style={[styles.quickActionIcon, { backgroundColor: palette.navy600 }]}>
              <Ionicons name="camera" size={20} color={palette.white} />
            </View>
            <Text style={styles.quickActionLabel}>Upload{'\n'}Video</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressCard}>
          <View style={styles.progressCardHeader}>
            <Text style={styles.progressCardTitle}>Your week</Text>
            <ProgressRing progress={goalProgress} size={52} strokeWidth={5} color={palette.mint500} label={`${weeklyStats.sessionsPlayed}/${SESSION_GOAL}`} />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Sessions" value={weeklyStats.sessionsPlayed} icon="tennisball-outline" style={styles.statCard} />
            <StatCard label="Partners" value={weeklyStats.partnersMet} icon="people-outline" style={styles.statCard} />
            <StatCard label="Videos" value={weeklyStats.videosUploaded} icon="videocam-outline" style={styles.statCard} />
          </View>
          {goalProgress >= 1 && (<View style={styles.goalBadgeRow}><Badge label="Weekly goal achieved! 🎉" variant="success" /></View>)}
          {goalProgress < 1 && weeklyStats.sessionsPlayed === 0 && (<Text style={styles.goalHint}>Play {SESSION_GOAL} sessions this week to hit your goal</Text>)}
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const CARD_WIDTH = 240;
const CARD_WIDTH_MATCH = 280;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.gray50 },
  loadingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: palette.white },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerLogo: { marginRight: spacing.xs },
  headerGreeting: { fontFamily: font.family.bold, fontSize: font.size.h2, color: palette.ink900, flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notifBtn: { position: 'relative', padding: spacing.xs },
  notifBadge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: radius.full, backgroundColor: palette.red500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifBadgeText: { fontFamily: font.family.bold, fontSize: 9, color: palette.white },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  sectionOverline: { fontFamily: font.family.bold, fontSize: font.size.overline ?? 11, letterSpacing: 1.1, color: palette.ink400, textTransform: 'uppercase' },
  sectionSeeAll: { fontFamily: font.family.medium, fontSize: font.size.caption, color: palette.mint600 },
  hScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  sessionCard: { width: CARD_WIDTH, backgroundColor: palette.white, borderRadius: radius.lg, padding: spacing.lg, ...Platform.select({ ios: { shadowColor: palette.ink900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }, android: { elevation: 3 }, web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } as any }) },
  sessionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sessionTime: { fontFamily: font.family.regular, fontSize: font.size.caption, color: palette.ink400 },
  sessionTitle: { fontFamily: font.family.semibold, fontSize: font.size.body, color: palette.ink800, marginBottom: spacing.md },
  sessionCTA: { alignSelf: 'flex-start' },
  bookSessionCard: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1.5, borderColor: palette.mint200, borderStyle: 'dashed', backgroundColor: palette.mint50 },
  bookSessionTitle: { fontFamily: font.family.semibold, fontSize: font.size.body, color: palette.ink700 },
  bookSessionSub: { fontFamily: font.family.regular, fontSize: font.size.caption, color: palette.ink400, textAlign: 'center' },
  addMoreCard: { width: 140, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: palette.gray100, borderStyle: 'dashed', backgroundColor: palette.gray50, gap: spacing.xs },
  addMoreText: { fontFamily: font.family.medium, fontSize: font.size.caption, color: palette.ink400 },
  matchRequestCard: { width: CARD_WIDTH_MATCH, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.white, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, ...Platform.select({ ios: { shadowColor: palette.ink900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 }, android: { elevation: 2 }, web: { boxShadow: '0 2px 6px rgba(0,0,0,0.07)' } as any }) },
  matchRequestInfo: { flex: 1 },
  matchRequestName: { fontFamily: font.family.semibold, fontSize: font.size.body, color: palette.ink800, marginBottom: 2 },
  matchRequestSub: { fontFamily: font.family.regular, fontSize: font.size.caption, color: palette.ink400 },
  matchRequestActions: { flexDirection: 'row', gap: spacing.xs },
  matchActionBtn: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: palette.green500 },
  declineBtn: { backgroundColor: palette.red500 },
  mapPreview: { marginHorizontal: spacing.lg, height: 160, borderRadius: radius.lg, overflow: 'hidden', position: 'relative', ...Platform.select({ ios: { shadowColor: palette.ink900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 3 }, web: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } as any }) },
  mapPlaceholderBg: { ...StyleSheet.absoluteFillObject, backgroundColor: palette.sky200 },
  mapPinWrapper: { position: 'absolute' },
  mapOverlayLabel: { position: 'absolute', bottom: spacing.md, left: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  mapOverlayText: { fontFamily: font.family.medium, fontSize: font.size.caption, color: palette.white },
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  quickActionBtn: { flex: 1, alignItems: 'center', gap: spacing.sm },
  quickActionIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontFamily: font.family.medium, fontSize: font.size.caption, color: palette.ink700, textAlign: 'center', lineHeight: 16 },
  progressCard: { marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: palette.white, borderRadius: radius.xl, padding: spacing.lg, ...Platform.select({ ios: { shadowColor: palette.ink900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 3 }, web: { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' } as any }) },
  progressCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  progressCardTitle: { fontFamily: font.family.bold, fontSize: font.size.h3, color: palette.ink900 },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1 },
  goalBadgeRow: { marginTop: spacing.md, alignItems: 'flex-start' },
  goalHint: { marginTop: spacing.md, fontFamily: font.family.regular, fontSize: font.size.caption, color: palette.ink400 },
  skeletonSection: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  skeletonLabel: { marginBottom: spacing.sm },
  skeletonCard: { marginBottom: spacing.sm, marginRight: spacing.md },
  bottomSpacer: { height: spacing.xxl + spacing.xl },
});

export default HomeScreen;
