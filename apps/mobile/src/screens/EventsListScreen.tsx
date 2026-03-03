/**
 * EventsListScreen — Browse all upcoming local events
 *
 * Features:
 * - Filter chips for time (This Week / This Month) and sport (Tennis, Pickleball, etc.)
 * - Featured event large hero card (280px)
 * - Upcoming events compact list (120px each, accent bar + RSVP)
 * - Pull-to-refresh, loading skeletons, empty state
 * - Tapping any card navigates to EventDetail
 */

import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { palette, spacing, radius, font } from '../../theme/design';
import { FilterChip } from '../../components/FilterChip';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';

import type { DiscoverStackParamList } from '../../navigation/types';
import { useEvents } from '../hooks/useEvents';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<DiscoverStackParamList, 'EventsList'>;

type TimeFilter = 'This Week' | 'This Month';
type SportFilter = 'Tennis' | 'Pickleball' | 'Golf' | 'Padel' | 'Soccer';

const TIME_FILTERS: TimeFilter[] = ['This Week', 'This Month'];
const SPORT_FILTERS: SportFilter[] = ['Tennis', 'Pickleball', 'Golf', 'Padel', 'Soccer'];

// Sport to accent color mapping
const SPORT_COLOR: Record<string, string> = {
  Tennis: palette.mint500,
  Pickleball: palette.amber500,
  Golf: palette.green500,
  Padel: palette.sky300,
  Soccer: palette.red500,
  default: palette.navy600,
};

function getSportColor(sport: string): string {
  return SPORT_COLOR[sport] ?? SPORT_COLOR.default;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function EventsListSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {/* Featured skeleton */}
      <SkeletonLoader variant="cardEvent" style={{ height: 280, borderRadius: radius.lg, marginBottom: spacing.lg }} />
      {/* List skeletons */}
      {[0, 1, 2, 3].map((i) => (
        <SkeletonLoader key={i} variant="listItem" style={{ height: 120, borderRadius: radius.md, marginBottom: spacing.sm }} />
      ))}
    </View>
  );
}

// ─── Featured Event Card ──────────────────────────────────────────────────────

interface FeaturedEventCardProps {
  event: {
    id: string;
    title: string;
    sport: string;
    date: string;
    location: string;
    rsvpCount: number;
  };
  onPress: () => void;
}

function FeaturedEventCard({ event, onPress }: FeaturedEventCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.featuredCard, { opacity: pressed ? 0.93 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`Featured event: ${event.title}`}
    >
      {/* Background */}
      <View style={styles.featuredBg} />
      {/* Gradient overlay */}
      <View style={styles.featuredGradient} />

      {/* FEATURED overline */}
      <View style={styles.featuredOverlineRow}>
        <Text style={styles.featuredOverline}>FEATURED</Text>
      </View>

      {/* Sport badge top-right */}
      <View style={styles.featuredBadgeRow}>
        <View style={[styles.sportBadge, { backgroundColor: getSportColor(event.sport) }]}>
          <Text style={styles.sportBadgeText}>{event.sport}</Text>
        </View>
      </View>

      {/* Bottom content */}
      <View style={styles.featuredContent}>
        <Text style={styles.featuredTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.featuredChips}>
          <View style={styles.chip}>
            <Ionicons name="calendar-outline" size={12} color={palette.white} />
            <Text style={styles.chipText}>{event.date}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="location-outline" size={12} color={palette.white} />
            <Text style={styles.chipText}>{event.location}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="people-outline" size={12} color={palette.mint500} />
            <Text style={[styles.chipText, { color: palette.mint500 }]}>{event.rsvpCount} going</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Upcoming Event Row ───────────────────────────────────────────────────────

interface UpcomingEventRowProps {
  event: {
    id: string;
    title: string;
    sport: string;
    date: string;
    location: string;
    rsvpCount: number;
  };
  onPress: () => void;
  onRSVP: () => void;
}

function UpcomingEventRow({ event, onPress, onRSVP }: UpcomingEventRowProps) {
  const accentColor = getSportColor(event.sport);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.eventRow, { opacity: pressed ? 0.93 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={event.title}
    >
      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Image placeholder */}
      <View style={styles.eventRowImage}>
        <Ionicons name="calendar" size={28} color={palette.sky300} />
      </View>

      {/* Content */}
      <View style={styles.eventRowContent}>
        <Text style={styles.eventRowTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.eventRowMeta}>
          <Ionicons name="time-outline" size={12} color={palette.ink500} />
          <Text style={styles.eventRowMetaText}>{event.date}</Text>
          <View style={styles.metaDot} />
          <Ionicons name="location-outline" size={12} color={palette.ink500} />
          <Text style={styles.eventRowMetaText}>{event.location}</Text>
        </View>
        <View style={styles.eventRowFooter}>
          <View style={styles.rsvpBadge}>
            <Ionicons name="people" size={11} color={palette.navy600} />
            <Text style={styles.rsvpBadgeText}>{event.rsvpCount} going</Text>
          </View>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onRSVP(); }}
            style={styles.rsvpButton}
            accessibilityRole="button"
            accessibilityLabel={`RSVP to ${event.title}`}
          >
            <Text style={styles.rsvpButtonText}>RSVP</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventsListScreen() {
  const navigation = useNavigation<NavProp>();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('This Week');
  const [sportFilters, setSportFilters] = useState<Set<SportFilter>>(new Set());
  const [page, setPage] = useState(1);

  const { events, loading, error, refresh } = useEvents({
    timeFilter,
    sportFilters: [...sportFilters],
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleTimeFilter = useCallback((filter: TimeFilter) => {
    setTimeFilter(filter);
    setPage(1);
  }, []);

  const toggleSportFilter = useCallback((sport: SportFilter) => {
    setSportFilters((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) {
        next.delete(sport);
      } else {
        next.add(sport);
      }
      return next;
    });
    setPage(1);
  }, []);

  const goToDetail = useCallback(
    (eventId: string, eventTitle?: string) => {
      navigation.navigate('EventDetail', { eventId, eventTitle });
    },
    [navigation],
  );

  const handleRSVP = useCallback(
    (eventId: string) => {
      navigation.navigate('EventDetail', { eventId });
    },
    [navigation],
  );

  // Slice events for current page (12 per page)
  const pageSize = 12;
  const featuredEvent = events[0] ?? null;
  const upcomingEvents = events.slice(1, 1 + pageSize * page);
  const hasMore = events.length > 1 + pageSize * page;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
          <Text style={styles.headerTitle}>Events</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('EventsList')}
            style={styles.headerAction}
            accessibilityRole="button"
            accessibilityLabel="Filter events"
          >
            <Ionicons name="options-outline" size={22} color={palette.navy700} />
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {TIME_FILTERS.map((tf) => (
            <FilterChip
              key={tf}
              label={tf}
              selected={timeFilter === tf}
              onPress={() => handleTimeFilter(tf)}
              style={styles.filterChipGap}
            />
          ))}
          <View style={styles.filterDivider} />
          {SPORT_FILTERS.map((sf) => (
            <FilterChip
              key={sf}
              label={sf}
              selected={sportFilters.has(sf)}
              onPress={() => toggleSportFilter(sf)}
              variant="accent"
              style={styles.filterChipGap}
            />
          ))}
        </ScrollView>

        {/* Content */}
        {loading && !refreshing ? (
          <EventsListSkeleton />
        ) : error && events.length === 0 ? (
          <EmptyState
            icon="warning-outline"
            headline="Could not load events"
            body={error}
            ctaLabel="Try Again"
            onCtaPress={handleRefresh}
            style={styles.emptyState}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            headline="No events near you"
            body="Be the first to bring your local sports community together."
            ctaLabel="Organize an Event"
            onCtaPress={() => {
              // Navigate to event creation or Networking hub with pre-filled intent
              navigation.navigate('NetworkingHub');
            }}
            style={styles.emptyState}
          />
        ) : (
          <>
            {/* Featured event */}
            {featuredEvent && (
              <View style={styles.featuredSection}>
                <FeaturedEventCard
                  event={featuredEvent}
                  onPress={() => goToDetail(featuredEvent.id, featuredEvent.title)}
                />
              </View>
            )}

            {/* Upcoming section */}
            {upcomingEvents.length > 0 && (
              <View style={styles.upcomingSection}>
                <Text style={styles.sectionHeader}>Upcoming</Text>
                {upcomingEvents.map((event) => (
                  <UpcomingEventRow
                    key={event.id}
                    event={event}
                    onPress={() => goToDetail(event.id, event.title)}
                    onRSVP={() => handleRSVP(event.id)}
                  />
                ))}

                {/* Load more */}
                {hasMore && (
                  <TouchableOpacity
                    onPress={() => setPage((p) => p + 1)}
                    style={styles.loadMoreRow}
                    accessibilityRole="button"
                    accessibilityLabel="Load more events"
                  >
                    <Text style={styles.loadMoreText}>Load more events</Text>
                    <Ionicons name="chevron-down" size={16} color={palette.navy600} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
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
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChipGap: {
    marginRight: spacing.xs,
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: palette.gray200,
    marginHorizontal: spacing.xs,
  },
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Featured card
  featuredSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  featuredCard: {
    height: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  featuredBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.navy600,
  },
  featuredGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,27,51,0.55)',
  },
  featuredOverlineRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
  },
  featuredOverline: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: palette.mint500,
    fontFamily: font.body,
  },
  featuredBadgeRow: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sportBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.white,
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.white,
    fontFamily: font.display,
    marginBottom: spacing.sm,
  },
  featuredChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  chipText: {
    fontSize: 11,
    color: palette.white,
    fontFamily: font.body,
  },

  // Upcoming section
  upcomingSection: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.navy700,
    fontFamily: font.display,
    marginBottom: spacing.md,
  },

  // Event row
  eventRow: {
    flexDirection: 'row',
    height: 120,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  accentBar: {
    width: 4,
  },
  eventRowImage: {
    width: 80,
    backgroundColor: palette.sky200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventRowContent: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  eventRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
    fontFamily: font.display,
    lineHeight: 20,
  },
  eventRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexWrap: 'wrap',
  },
  eventRowMetaText: {
    fontSize: 11,
    color: palette.ink500,
    fontFamily: font.body,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.ink500,
    marginHorizontal: 2,
  },
  eventRowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rsvpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  rsvpBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.navy600,
    fontFamily: font.body,
  },
  rsvpButton: {
    backgroundColor: palette.mint500,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  rsvpButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.navy700,
    fontFamily: font.body,
  },

  // Load more
  loadMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy600,
    fontFamily: font.body,
  },

  // Empty state
  emptyState: {
    marginTop: spacing.xxl,
    marginHorizontal: spacing.lg,
  },
});
