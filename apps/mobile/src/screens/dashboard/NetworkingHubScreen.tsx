/**
 * NetworkingHubScreen — Redesigned networking hub using Week 2 design system
 *
 * PRESERVES ALL EXISTING FUNCTIONALITY:
 *   - Activity selection (now via FilterChip instead of TextInput)
 *   - MCP booking plan API call (mcp-booking-plan)
 *   - Player filtering by sport and city (via Input components)
 *   - Invite sending (networking-invite-send)
 *   - Event hints from booking plan response
 *   - Refresh plan button
 *   - Connected players / sent invites avatar grid
 *
 * REDESIGNED with:
 *   - Design tokens (palette, spacing, radius, font) — no inline hex colors
 *   - FilterChip for sport selection
 *   - PlayerCard components with Connect action
 *   - Input components for filters
 *   - Card components for sections
 *   - Pull-to-refresh
 *   - Loading skeletons
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { palette, spacing, radius, font } from '../../theme/design';
import { FilterChip } from '../../components/FilterChip';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { SpotterTextInput as Input } from '../../components/Input';

import { invokeFunction } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../contexts/SessionContext';
import type { DiscoverStackParamList } from '../../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<DiscoverStackParamList, 'NetworkingHub'>;

interface ActivityItem {
  id: string;
  slug: string;
  name: string;
}

interface PlayerData {
  id: string;
  name: string;
  sport: string;
  level: string;
  city: string;
  openToInvite: boolean;
  note: string;
  score?: number;
}

interface EventHint {
  id: string;
  title: string;
  city?: string | null;
  sponsor?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORT_SLUGS = ['golf', 'pickleball', 'tennis', 'padel', 'soccer'];

const SEED_PLAYERS: PlayerData[] = [
  {
    id: 'u-1',
    name: 'Chris M.',
    sport: 'Golf',
    level: 'Intermediate',
    city: 'Scottsdale',
    openToInvite: true,
    note: 'Prefers 9-hole weekday rounds.',
  },
  {
    id: 'u-2',
    name: 'Jamie R.',
    sport: 'Pickleball',
    level: 'Advanced',
    city: 'Austin',
    openToInvite: true,
    note: 'Great drill partner, evenings only.',
  },
  {
    id: 'u-3',
    name: 'Taylor S.',
    sport: 'Tennis',
    level: 'Intermediate',
    city: 'San Diego',
    openToInvite: false,
    note: 'Booked this week, available next weekend.',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PlayerNetworkCardProps {
  player: PlayerData;
  invited: boolean;
  onConnect: () => void;
  onViewProfile: () => void;
  isSuggested?: boolean;
}

function PlayerNetworkCard({
  player,
  invited,
  onConnect,
  onViewProfile,
  isSuggested = false,
}: PlayerNetworkCardProps) {
  return (
    <TouchableOpacity
      onPress={onViewProfile}
      style={styles.playerCard}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`View ${player.name}'s profile`}
    >
      {/* Avatar */}
      <Avatar
        size="lg"
        initials={player.name.slice(0, 2).toUpperCase()}
        badge={player.openToInvite ? 'online' : null}
      />

      {/* Info */}
      <View style={styles.playerInfo}>
        <View style={styles.playerNameRow}>
          <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
          {isSuggested && typeof player.score === 'number' && (
            <View style={styles.scoreBadge}>
              <Ionicons name="sparkles" size={10} color={palette.amber500} />
              <Text style={styles.scoreText}>{Math.round(player.score * 100)}%</Text>
            </View>
          )}
        </View>
        <Text style={styles.playerMeta} numberOfLines={1}>
          {player.sport} · {player.level} · {player.city}
        </Text>
        <Text style={styles.playerNote} numberOfLines={1}>{player.note}</Text>
      </View>

      {/* Connect button */}
      <Button
        label={invited ? 'Sent' : 'Connect'}
        variant={invited ? 'ghost' : 'primary'}
        size="sm"
        onPress={onConnect}
        disabled={invited || !player.openToInvite}
        leadingIcon={invited ? 'checkmark' : 'person-add-outline'}
        style={styles.connectBtn}
      />
    </TouchableOpacity>
  );
}

function SectionHeader({
  overline,
  title,
  action,
  onAction,
}: {
  overline?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View>
        {overline && <Text style={styles.overline}>{overline}</Text>}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function NetworkingSkeletons() {
  return (
    <View style={styles.skeletonGroup}>
      {[0, 1, 2].map((i) => (
        <SkeletonLoader key={i} variant="cardPlayer" style={{ height: 90, borderRadius: radius.md, marginBottom: spacing.sm }} />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function NetworkingHubScreen() {
  const navigation = useNavigation<NavProp>();
  const { session } = useSession();

  // Activities
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>('golf');

  // Filters
  const [cityFilter, setCityFilter] = useState('');

  // Data
  const [players, setPlayers] = useState<PlayerData[]>(SEED_PLAYERS);
  const [eventHints, setEventHints] = useState<EventHint[]>([]);
  const [sentInvites, setSentInvites] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  // ── Load activities ───────────────────────────────────────────────────────

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const { data } = await supabase
          .from('activities')
          .select('id, slug, name')
          .in('slug', SPORT_SLUGS)
          .order('name', { ascending: true });

        if (data?.length) {
          setActivities(data as ActivityItem[]);
          const preferred =
            data.find((a) => a.slug === 'golf') ??
            data.find((a) => a.slug === 'pickleball') ??
            data[0];
          setActivityId(preferred.id);
          setSelectedSlug(preferred.slug);
        }
      } finally {
        setLoading(false);
      }
    };
    loadActivities();
  }, []);

  // ── Run booking plan ──────────────────────────────────────────────────────

  const runBookingPlan = useCallback(
    async (showRefreshing = false) => {
      if (!activityId) return;

      if (showRefreshing) setRefreshing(true);
      else setPlanLoading(true);

      try {
        const response = await invokeFunction<{
          pairings: Array<{
            candidateUserId: string | null;
            candidateDisplayName: string;
            score: number;
            distanceKm?: number | null;
          }>;
          events: Array<{
            eventId: string | null;
            title: string;
            city?: string | null;
            sponsorName?: string | null;
          }>;
        }>('mcp-booking-plan', {
          method: 'POST',
          body: {
            activityId,
            radiusKm: 35,
            limit: 8,
            includeEvents: true,
            objective: 'balanced',
          },
        });

        const currentActivity = activities.find((a) => a.id === activityId);
        const sportName = currentActivity?.name ?? selectedSlug;

        const mapped: PlayerData[] = response.pairings
          .filter((p) => p.candidateUserId)
          .map((p) => ({
            id: p.candidateUserId as string,
            name: p.candidateDisplayName || 'Local player',
            sport: sportName,
            level: 'Matched',
            city: cityFilter || 'Nearby',
            openToInvite: true,
            note: `${p.distanceKm?.toFixed(1) ?? '?'} km away`,
            score: p.score,
          }));

        setPlayers(mapped.length ? mapped : SEED_PLAYERS);
        setEventHints(
          response.events
            .filter((e) => e.eventId)
            .map((e) => ({
              id: e.eventId as string,
              title: e.title,
              city: e.city,
              sponsor: e.sponsorName ?? null,
            })),
        );
      } catch {
        setPlayers(SEED_PLAYERS);
      } finally {
        setPlanLoading(false);
        setRefreshing(false);
        setLoading(false);
      }
    },
    [activityId, activities, cityFilter, selectedSlug],
  );

  // Auto-run when activityId changes
  useEffect(() => {
    if (!activityId) return;
    runBookingPlan();
  }, [activityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered players ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return players.filter((p) => {
      const cityOk = cityFilter
        ? p.city.toLowerCase().includes(cityFilter.toLowerCase())
        : true;
      return cityOk;
    });
  }, [players, cityFilter]);

  // Top 3 by score for "AI Suggested" section
  const suggested = useMemo(() => {
    return [...filtered]
      .filter((p) => typeof p.score === 'number')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3);
  }, [filtered]);

  // ── Invite action ─────────────────────────────────────────────────────────

  const sendInvite = useCallback(
    async (playerId: string) => {
      if (sentInvites.includes(playerId)) return;
      if (!activityId) {
        Alert.alert('Select a sport', 'Choose a sport before connecting.');
        return;
      }
      try {
        await invokeFunction('networking-invite-send', {
          method: 'POST',
          body: {
            receiverUserId: playerId,
            activityId,
            purpose: 'tournament',
            message:
              'You are invited to connect and join a local sponsored tournament via Spotter.',
          },
        });
        setSentInvites((prev) => [...prev, playerId]);
      } catch (error) {
        Alert.alert(
          'Invite failed',
          error instanceof Error ? error.message : 'Unable to send invite',
        );
      }
    },
    [sentInvites, activityId],
  );

  // ── Pull-to-refresh ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    await runBookingPlan(true);
  }, [runBookingPlan]);

  // ── Activity selection ────────────────────────────────────────────────────

  const selectActivity = useCallback(
    (slug: string) => {
      const match = activities.find((a) => a.slug === slug);
      if (match) {
        setActivityId(match.id);
        setSelectedSlug(match.slug);
      } else {
        // No Supabase match — set slug anyway, plan will use seed data
        setSelectedSlug(slug);
      }
    },
    [activities],
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.mint500}
            colors={[palette.mint500]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Networking</Text>
        </View>

        {/* Intro card */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Connect Locally</Text>
          <Text style={styles.introBody}>
            Connect with local players who share your sports. Spotter matches you by skill,
            distance, and availability.
          </Text>
        </View>

        {/* Sport picker */}
        <View style={styles.section}>
          <SectionHeader overline="YOUR SPORT" title="Select Activity" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {SPORT_SLUGS.map((slug) => {
              const activity = activities.find((a) => a.slug === slug);
              const label = activity?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
              return (
                <FilterChip
                  key={slug}
                  label={label}
                  selected={selectedSlug === slug}
                  onPress={() => selectActivity(slug)}
                  style={styles.chipGap}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* City filter */}
        <View style={styles.section}>
          <SectionHeader overline="FILTERS" title="Location" />
          <Input
            value={cityFilter}
            onChangeText={setCityFilter}
            placeholder="Filter by city (e.g. Scottsdale)"
            leadingIcon="location-outline"
          />
        </View>

        {/* AI Suggested Connections */}
        <View style={styles.section}>
          <SectionHeader
            overline="AI-SUGGESTED CONNECTIONS"
            title="Best Matches"
            action="Refresh Plan"
            onAction={() => runBookingPlan()}
          />
          {loading || planLoading ? (
            <NetworkingSkeletons />
          ) : suggested.length > 0 ? (
            suggested.map((player) => (
              <PlayerNetworkCard
                key={player.id}
                player={player}
                invited={sentInvites.includes(player.id)}
                onConnect={() => sendInvite(player.id)}
                onViewProfile={() =>
                  navigation.navigate('PlayerProfile', {
                    playerId: player.id,
                    playerName: player.name,
                  })
                }
                isSuggested
              />
            ))
          ) : (
            <EmptyState
              icon="people-outline"
              headline="No matches yet"
              body="Select a sport and refresh to find nearby players."
              ctaLabel="Refresh Plan"
              onCtaPress={() => runBookingPlan()}
              style={styles.miniEmpty}
            />
          )}
        </View>

        {/* People Nearby (remaining players) */}
        {!loading && filtered.length > suggested.length && (
          <View style={styles.section}>
            <SectionHeader overline="NEARBY" title="People Nearby" />
            {filtered
              .filter((p) => !suggested.some((s) => s.id === p.id))
              .map((player) => (
                <PlayerNetworkCard
                  key={player.id}
                  player={player}
                  invited={sentInvites.includes(player.id)}
                  onConnect={() => sendInvite(player.id)}
                  onViewProfile={() =>
                    navigation.navigate('PlayerProfile', {
                      playerId: player.id,
                      playerName: player.name,
                    })
                  }
                />
              ))}
          </View>
        )}

        {/* Suggested Events from booking plan */}
        {eventHints.length > 0 && (
          <View style={styles.section}>
            <SectionHeader overline="FROM YOUR PLAN" title="Suggested Events" />
            {eventHints.slice(0, 4).map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventHintCard}
                onPress={() =>
                  navigation.navigate('EventDetail', {
                    eventId: event.id,
                    eventTitle: event.title,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={event.title}
              >
                <View style={styles.eventHintIcon}>
                  <Ionicons name="calendar" size={20} color={palette.navy600} />
                </View>
                <View style={styles.eventHintContent}>
                  <Text style={styles.eventHintTitle} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.eventHintMeta}>
                    {[event.city, event.sponsor].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.ink500} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Connected players (sent invites avatar grid) */}
        {sentInvites.length > 0 && (
          <View style={styles.section}>
            <SectionHeader overline="OUTREACH" title="Invited Players" />
            <View style={styles.connectedGrid}>
              {sentInvites.map((id) => {
                const player = players.find((p) => p.id === id);
                return (
                  <View key={id} style={styles.connectedItem}>
                    <Avatar
                      size="md"
                      initials={player?.name.slice(0, 2).toUpperCase() ?? '??'}
                      badge="verified"
                    />
                    <Text style={styles.connectedName} numberOfLines={1}>
                      {player?.name ?? 'Player'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Refresh plan button (bottom) */}
        <View style={[styles.section, { paddingBottom: spacing.xxl }]}>
          <Button
            label={planLoading || refreshing ? 'Refreshing…' : 'Refresh MCP Booking Plan'}
            variant="secondary"
            size="md"
            onPress={() => runBookingPlan()}
            loading={planLoading || refreshing}
            leadingIcon="refresh-outline"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.gray50,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: font.display,
    color: palette.navy700,
  },

  // Intro card
  introCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: palette.navy600,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.white,
    fontFamily: font.display,
  },
  introBody: {
    fontSize: 13,
    color: `rgba(255,255,255,0.80)`,
    lineHeight: 20,
    fontFamily: font.body,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: palette.ink500,
    textTransform: 'uppercase',
    fontFamily: font.body,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.navy700,
    fontFamily: font.display,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.mint500,
    fontFamily: font.body,
  },

  // Sport chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  chipGap: {
    marginRight: spacing.xs,
  },

  // Player card
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: palette.gray100,
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
    fontFamily: font.display,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  scoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.amber500,
    fontFamily: font.body,
  },
  playerMeta: {
    fontSize: 12,
    color: palette.ink700,
    fontWeight: '500',
    fontFamily: font.body,
  },
  playerNote: {
    fontSize: 11,
    color: palette.ink500,
    fontFamily: font.body,
  },
  connectBtn: {
    minWidth: 80,
  },

  // Skeleton
  skeletonGroup: {
    gap: spacing.xs,
  },

  // Empty state
  miniEmpty: {
    paddingVertical: spacing.lg,
  },

  // Event hints
  eventHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: palette.gray100,
  },
  eventHintIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventHintContent: {
    flex: 1,
    gap: 2,
  },
  eventHintTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
    fontFamily: font.display,
  },
  eventHintMeta: {
    fontSize: 12,
    color: palette.ink500,
    fontFamily: font.body,
  },

  // Connected grid
  connectedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  connectedItem: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 56,
  },
  connectedName: {
    fontSize: 11,
    color: palette.ink700,
    fontFamily: font.body,
    textAlign: 'center',
    width: 56,
  },
});
