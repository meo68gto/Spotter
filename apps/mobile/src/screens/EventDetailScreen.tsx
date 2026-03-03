/**
 * EventDetailScreen — Event detail view with full RSVP functionality
 *
 * Features:
 * - Full-width hero photo with gradient overlay + event title
 * - Date/time, location, and RSVP count chips
 * - Expandable description ("Read more")
 * - Organizer card with avatar
 * - Attendee avatar stack
 * - Map placeholder with "Tap to open Maps" hint
 * - Sticky bottom bar: RSVP + Invite Locals
 * - Handles: open / full (waitlist) / already RSVP'd / past event states
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { palette, spacing, radius, font } from '../../theme/design';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SkeletonLoader } from '../../components/SkeletonLoader';

import { supabase } from '../../lib/supabase';
import { invokeFunction } from '../../lib/api';
import { useSession } from '../../contexts/SessionContext';
import type { DiscoverStackParamList } from '../../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<DiscoverStackParamList, 'EventDetail'>;
type RouteProps = RouteProp<DiscoverStackParamList, 'EventDetail'>;

type RSVPState = 'idle' | 'loading' | 'rsvpd' | 'waitlisted' | 'cancelled';

type EventStatus = 'open' | 'full' | 'past';

interface EventAttendee {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface EventDetail {
  id: string;
  title: string;
  description: string;
  sport: string;
  start_time: string;
  end_time: string | null;
  city: string;
  venue_name: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  max_participants: number | null;
  registration_count: number;
  my_registration_status: 'registered' | 'waitlisted' | 'cancelled' | null;
  organizer_name: string | null;
  organizer_id: string | null;
  is_free: boolean;
  status: 'published' | 'cancelled' | 'completed';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

function deriveEventStatus(event: EventDetail): EventStatus {
  if (event.status === 'completed' || event.status === 'cancelled') return 'past';
  if (new Date(event.start_time) < new Date()) return 'past';
  if (event.max_participants !== null && event.registration_count >= event.max_participants) {
    return 'full';
  }
  return 'open';
}

function getSportColor(sport: string): string {
  const map: Record<string, string> = {
    Tennis: palette.mint500,
    Pickleball: palette.amber500,
    Golf: palette.green500,
    Padel: palette.sky300,
    Soccer: palette.red500,
  };
  return map[sport] ?? palette.navy600;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EventDetailSkeleton() {
  return (
    <View>
      <SkeletonLoader
        variant="cardEvent"
        style={{ height: 220, borderRadius: 0, marginBottom: spacing.lg }}
      />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <SkeletonLoader variant="textBlock" style={{ height: 20, borderRadius: radius.sm }} />
        <SkeletonLoader variant="textBlock" style={{ height: 16, borderRadius: radius.sm, width: '60%' }} />
        <SkeletonLoader variant="textBlock" style={{ height: 80, borderRadius: radius.md }} />
        <SkeletonLoader variant="cardPlayer" style={{ height: 72, borderRadius: radius.md }} />
      </View>
    </View>
  );
}

// ─── Organizer Card ───────────────────────────────────────────────────────────

interface OrganizerCardProps {
  name: string;
}

function OrganizerCard({ name }: OrganizerCardProps) {
  return (
    <View style={styles.organizerCard}>
      <Avatar size="md" initials={name.slice(0, 2).toUpperCase()} />
      <View style={styles.organizerInfo}>
        <Text style={styles.organizerLabel}>Organizer</Text>
        <Text style={styles.organizerName}>{name}</Text>
      </View>
    </View>
  );
}

// ─── Attendee Stack ───────────────────────────────────────────────────────────

interface AttendeeStackProps {
  attendees: EventAttendee[];
  totalCount: number;
}

function AttendeeStack({ attendees, totalCount }: AttendeeStackProps) {
  const visible = attendees.slice(0, 5);
  const overflow = totalCount - visible.length;

  return (
    <View style={styles.attendeeStackRow}>
      <View style={styles.attendeeStack}>
        {visible.map((attendee, i) => (
          <View key={attendee.id} style={[styles.attendeeAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 5 - i }]}>
            <Avatar
              size="sm"
              imageUri={attendee.avatar_url ?? undefined}
              initials={attendee.display_name?.slice(0, 2).toUpperCase()}
            />
          </View>
        ))}
      </View>
      {overflow > 0 && (
        <Text style={styles.attendeeOverflow}>+{overflow} more</Text>
      )}
      {visible.length === 0 && (
        <Text style={styles.attendeeEmpty}>Be the first to RSVP!</Text>
      )}
    </View>
  );
}

// ─── Map Placeholder ──────────────────────────────────────────────────────────

interface MapPlaceholderProps {
  venueName: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
}

function MapPlaceholder({ venueName, city, lat, lng }: MapPlaceholderProps) {
  const openMaps = useCallback(() => {
    const query = venueName ? `${venueName}, ${city}` : city;
    const scheme = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(query)}`,
      android: `geo:0,0?q=${encodeURIComponent(query)}`,
    });
    if (scheme) Linking.openURL(scheme).catch(() => {});
  }, [venueName, city]);

  return (
    <TouchableOpacity
      onPress={openMaps}
      style={styles.mapPlaceholder}
      accessibilityRole="button"
      accessibilityLabel="Open location in Maps"
    >
      <Ionicons name="location" size={36} color={palette.sky300} />
      <Text style={styles.mapVenueName}>{venueName ?? city}</Text>
      <Text style={styles.mapHint}>Tap to open Maps</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { eventId } = route.params;
  const { session } = useSession();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpState, setRsvpState] = useState<RSVPState>('idle');
  const [descExpanded, setDescExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load event ────────────────────────────────────────────────────────────

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try Supabase direct query first
      const { data, error: dbError } = await supabase
        .from('sponsor_events')
        .select(`
          id,
          title,
          description,
          start_time,
          end_time,
          city,
          venue_name,
          venue_lat,
          venue_lng,
          max_participants,
          registration_count,
          status,
          sponsor:sponsor_id (name),
          activity:activity_id (name)
        `)
        .eq('id', eventId)
        .single();

      if (dbError || !data) {
        // Fall back to function
        const fnData = await invokeFunction<EventDetail>('sponsors-event-list', {
          method: 'POST',
          body: { eventId },
        });
        setEvent(fnData);
      } else {
        const row = data as any;
        const mappedEvent: EventDetail = {
          id: row.id,
          title: row.title ?? 'Untitled Event',
          description: row.description ?? '',
          sport: row.activity?.name ?? 'Sport',
          start_time: row.start_time,
          end_time: row.end_time,
          city: row.city ?? '',
          venue_name: row.venue_name,
          venue_lat: row.venue_lat,
          venue_lng: row.venue_lng,
          max_participants: row.max_participants,
          registration_count: row.registration_count ?? 0,
          my_registration_status: null,
          organizer_name: row.sponsor?.name ?? null,
          organizer_id: row.sponsor_id ?? null,
          is_free: row.price_cents === 0 || row.price_cents == null,
          status: row.status ?? 'published',
        };
        setEvent(mappedEvent);

        // Check user RSVP
        if (session?.user?.id) {
          const { data: regData } = await supabase
            .from('event_registrations')
            .select('status')
            .eq('event_id', eventId)
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (regData) {
            mappedEvent.my_registration_status = regData.status;
            setEvent({ ...mappedEvent });
          }
        }
      }

      // Load attendees (sample)
      const { data: regRows } = await supabase
        .from('event_registrations')
        .select('user_id, profiles:user_id(display_name, avatar_url)')
        .eq('event_id', eventId)
        .eq('status', 'registered')
        .limit(8);

      if (regRows) {
        setAttendees(
          regRows.map((r: any) => ({
            id: r.user_id,
            display_name: r.profiles?.display_name ?? null,
            avatar_url: r.profiles?.avatar_url ?? null,
          })),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId, session]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  // Sync rsvpState from loaded event
  useEffect(() => {
    if (!event) return;
    if (event.my_registration_status === 'registered') setRsvpState('rsvpd');
    else if (event.my_registration_status === 'waitlisted') setRsvpState('waitlisted');
    else setRsvpState('idle');
  }, [event]);

  // ── RSVP action ───────────────────────────────────────────────────────────

  const handleRSVP = useCallback(async () => {
    if (!event) return;
    const prevState = rsvpState;
    setRsvpState('loading');
    try {
      await invokeFunction('sponsors-event-rsvp', {
        method: 'POST',
        body: { eventId: event.id, action: 'register' },
      });
      const newStatus = deriveEventStatus(event) === 'full' ? 'waitlisted' : 'rsvpd';
      setRsvpState(newStatus);
      setEvent((prev) =>
        prev ? { ...prev, registration_count: prev.registration_count + 1 } : prev,
      );
    } catch (err) {
      setRsvpState(prevState);
      Alert.alert('RSVP failed', err instanceof Error ? err.message : 'Please try again.');
    }
  }, [event, rsvpState]);

  const handleCancelRSVP = useCallback(async () => {
    if (!event) return;
    Alert.alert('Cancel RSVP', 'Are you sure you want to cancel your RSVP?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel RSVP',
        style: 'destructive',
        onPress: async () => {
          try {
            await invokeFunction('sponsors-event-rsvp', {
              method: 'POST',
              body: { eventId: event.id, action: 'cancel' },
            });
            setRsvpState('idle');
            setEvent((prev) =>
              prev ? { ...prev, registration_count: Math.max(0, prev.registration_count - 1) } : prev,
            );
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not cancel RSVP.');
          }
        },
      },
    ]);
  }, [event]);

  const handleInviteLocals = useCallback(async () => {
    if (!event) return;
    try {
      const result = await invokeFunction<{ invited: number }>('sponsors-event-invite-locals', {
        method: 'POST',
        body: { eventId: event.id },
      });
      Alert.alert('Invites sent!', `${result.invited} local players were invited.`);
    } catch (err) {
      Alert.alert('Invite failed', err instanceof Error ? err.message : 'Please try again.');
    }
  }, [event]);

  const handleShare = useCallback(() => {
    // Share via system share sheet (no-op placeholder — integrate expo-sharing if desired)
    Alert.alert('Share', `Share "${event?.title}" with friends!`);
  }, [event]);

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderRSVPButton() {
    if (!event) return null;
    const status = deriveEventStatus(event);

    if (status === 'past') {
      return (
        <Button label="Event Ended" variant="ghost" size="lg" disabled style={styles.rsvpBtn} />
      );
    }
    if (rsvpState === 'loading') {
      return <Button label="Saving…" variant="primary" size="lg" loading style={styles.rsvpBtn} />;
    }
    if (rsvpState === 'rsvpd') {
      return (
        <Button
          label="You're going ✓"
          variant="primary"
          size="lg"
          style={[styles.rsvpBtn, { backgroundColor: palette.green500 }]}
          disabled
        />
      );
    }
    if (rsvpState === 'waitlisted') {
      return (
        <Button
          label="On Waitlist ✓"
          variant="primary"
          size="lg"
          style={[styles.rsvpBtn, { backgroundColor: palette.amber500 }]}
          disabled
        />
      );
    }
    if (status === 'full') {
      return (
        <Button
          label="Join Waitlist"
          variant="primary"
          size="lg"
          onPress={handleRSVP}
          style={[styles.rsvpBtn, { backgroundColor: palette.amber500 }]}
        />
      );
    }
    return (
      <Button label="RSVP" variant="primary" size="lg" onPress={handleRSVP} style={styles.rsvpBtn} />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView>
          <EventDetailSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !event) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={40} color={palette.amber500} />
          <Text style={styles.errorText}>{error ?? 'Event not found'}</Text>
          <Button label="Go back" variant="ghost" size="md" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const eventStatus = deriveEventStatus(event);
  const descLines = event.description.split('\n');
  const isLongDesc = event.description.length > 200;
  const displayDesc = descExpanded || !isLongDesc ? event.description : event.description.slice(0, 200) + '…';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          {/* Background color (fallback when no image) */}
          <View style={styles.heroBg} />
          {/* Gradient overlay on bottom half */}
          <View style={styles.heroGradient} />

          {/* Back button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={palette.ink900} />
          </TouchableOpacity>

          {/* Top-right actions */}
          <View style={styles.heroTopRight}>
            {/* Sport badge */}
            <View style={[styles.heroBadge, { backgroundColor: getSportColor(event.sport) }]}>
              <Text style={styles.heroBadgeText}>{event.sport}</Text>
            </View>
            {/* Share */}
            <TouchableOpacity
              onPress={handleShare}
              style={styles.shareBtn}
              accessibilityRole="button"
              accessibilityLabel="Share event"
            >
              <Ionicons name="share-outline" size={18} color={palette.white} />
            </TouchableOpacity>
          </View>

          {/* Title at bottom */}
          <View style={styles.heroTitleArea}>
            <Text style={styles.heroTitle} numberOfLines={3}>{event.title}</Text>
          </View>
        </View>

        {/* Details row */}
        <View style={styles.detailsRow}>
          <View style={styles.infoChip}>
            <Ionicons name="calendar-outline" size={14} color={palette.navy600} />
            <Text style={styles.infoChipText}>{formatEventDate(event.start_time)}</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="location-outline" size={14} color={palette.navy600} />
            <Text style={styles.infoChipText}>{event.venue_name ?? event.city}</Text>
          </View>
          <View style={[styles.infoChip, { backgroundColor: palette.mint50 }]}>
            <Ionicons name="people-outline" size={14} color={palette.mint500} />
            <Text style={[styles.infoChipText, { color: palette.mint500 }]}>
              {event.registration_count} going
            </Text>
          </View>
          {event.is_free && (
            <View style={[styles.infoChip, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
              <Text style={[styles.infoChipText, { color: palette.green500, fontWeight: '700' }]}>Free</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.bodyText}>{displayDesc}</Text>
          {isLongDesc && (
            <TouchableOpacity
              onPress={() => setDescExpanded((x) => !x)}
              accessibilityRole="button"
              accessibilityLabel={descExpanded ? 'Show less' : 'Read more'}
            >
              <Text style={styles.readMore}>{descExpanded ? 'Show less' : 'Read more'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Organizer */}
        {event.organizer_name && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ORGANIZER</Text>
            <OrganizerCard name={event.organizer_name} />
          </View>
        )}

        {/* Attendees */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ATTENDEES</Text>
          <AttendeeStack attendees={attendees} totalCount={event.registration_count} />
        </View>

        {/* Map */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <MapPlaceholder
            venueName={event.venue_name}
            city={event.city}
            lat={event.venue_lat}
            lng={event.venue_lng}
          />
        </View>

        {/* Cancel RSVP (if already RSVPd) */}
        {rsvpState === 'rsvpd' && (
          <View style={[styles.section, { paddingBottom: 100 }]}>
            <Button
              label="Cancel RSVP"
              variant="ghost"
              size="md"
              onPress={handleCancelRSVP}
            />
          </View>
        )}

        {/* Bottom padding for sticky bar */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={styles.stickyBar}>
        {renderRSVPButton()}
        <Button
          label="Invite Locals"
          variant="secondary"
          size="lg"
          onPress={handleInviteLocals}
          style={styles.inviteBtn}
          disabled={eventStatus === 'past'}
        />
      </View>
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 15,
    color: palette.ink700,
    textAlign: 'center',
    fontFamily: undefined,
  },

  // Hero
  hero: {
    height: 220,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.navy600,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    backgroundColor: 'rgba(9,19,36,0.75)',
  },
  backBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  heroTopRight: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  heroBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.white,
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.white,
    lineHeight: 30,
  },

  // Details row
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.navy600,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: palette.ink500,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: palette.ink700,
  },
  readMore: {
    marginTop: spacing.xs,
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy600,
  },

  // Organizer
  organizerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.gray100,
  },
  organizerInfo: {
    gap: 2,
  },
  organizerLabel: {
    fontSize: 11,
    color: palette.ink500,
    fontWeight: '500',
  },
  organizerName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
  },

  // Attendees
  attendeeStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  attendeeStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeAvatar: {
    borderWidth: 2,
    borderColor: palette.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
  attendeeOverflow: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink700,
  },
  attendeeEmpty: {
    fontSize: 13,
    color: palette.ink500,
    fontStyle: 'italic',
  },

  // Map placeholder
  mapPlaceholder: {
    height: 160,
    backgroundColor: palette.sky200,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  mapVenueName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy700,
  },
  mapHint: {
    fontSize: 12,
    color: palette.ink500,
  },

  // Sticky bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: palette.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  rsvpBtn: {
    flex: 1,
  },
  inviteBtn: {
    flex: 0.5,
  },
});
