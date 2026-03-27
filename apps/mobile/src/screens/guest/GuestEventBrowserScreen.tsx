import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../lib/api';
import { stockPhotos } from '../../lib/stockPhotos';
import { font, palette, radius, spacing } from '../theme/design';

type EventStatus = 'draft' | 'published' | 'registration_open' | 'full' | 'in_progress' | 'completed' | 'cancelled';

type GuestEvent = {
  id: string;
  title: string;
  description?: string;
  sport: 'Golf';
  city: string;
  venueName?: string;
  date: string;
  startTime: string;
  endTime: string;
  sponsor: string;
  format: 'Tournament' | 'Clinic' | 'Local Mixer';
  registrationCount: number;
  maxParticipants?: number;
  price: number;
  status: EventStatus;
  registrationDeadline?: string;
  targetTiers: string[];
};

type Props = {
  onEventPress: (eventId: string, price: number) => void;
  onSignInPress: () => void;
};

export function GuestEventBrowserScreen({ onEventPress, onSignInPress }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<GuestEvent[]>([]);

  const loadEvents = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      // Use sponsors-event-list which doesn't require authentication
      const response = await invokeFunction<Array<{
        id: string;
        activity_id: string;
        title: string;
        description?: string;
        city: string | null;
        venue_name?: string;
        start_time: string;
        end_time: string;
        sponsor_name?: string;
        registration_count?: number;
        max_participants?: number;
        price?: number;
        status?: string;
        registration_deadline?: string;
        target_tiers?: string[];
      }>>('sponsors-event-list', {
        method: 'POST',
        body: {}
      });

      // Filter to only show published and registration_open events to guests
      const visibleEvents = (response || []).filter((item) => {
        const status = item.status as EventStatus;
        return status === 'published' || status === 'registration_open';
      });

      const mapped: GuestEvent[] = visibleEvents.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        sport: 'Golf',
        city: item.city ?? 'TBD',
        venueName: item.venue_name,
        date: item.start_time.slice(0, 10),
        startTime: new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        endTime: new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sponsor: item.sponsor_name ?? 'Sponsor',
        format: 'Tournament',
        registrationCount: item.registration_count ?? 0,
        maxParticipants: item.max_participants,
        price: item.price ?? 0,
        status: (item.status as EventStatus) ?? 'published',
        registrationDeadline: item.registration_deadline,
        targetTiers: item.target_tiers || ['free', 'select', 'summit'],
      }));

      setEvents(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load events';
      setError(message);
      if (isRefresh) {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents(true);
  }, [loadEvents]);

  const handleEventPress = (event: GuestEvent) => {
    if (event.status === 'full') {
      Alert.alert('Event Full', 'This event has reached maximum capacity.');
      return;
    }
    if (event.registrationDeadline && new Date(event.registrationDeadline) < new Date()) {
      Alert.alert('Registration Closed', 'The registration deadline has passed.');
      return;
    }
    onEventPress(event.id, event.price);
  };

  const renderEventCard = (event: GuestEvent) => {
    const isFull = event.maxParticipants && event.registrationCount >= event.maxParticipants;
    const isFree = event.price === 0;

    return (
      <TouchableOpacity
        key={event.id}
        style={styles.eventCard}
        onPress={() => handleEventPress(event)}
        activeOpacity={0.8}
      >
        <Text style={styles.eventTitle}>{event.title}</Text>
        {event.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {event.sport} • {event.format} • {event.date}
        </Text>
        <Text style={styles.meta}>
          {event.city} {event.venueName ? `• ${event.venueName}` : ''}
        </Text>
        <Text style={styles.meta}>Sponsored by {event.sponsor}</Text>
        <View style={styles.registrationRow}>
          <Text style={styles.registrationCount}>
            {event.registrationCount} / {event.maxParticipants ?? '∞'} registered
          </Text>
          {isFull && <Text style={styles.fullBadge}>Event Full</Text>}
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{isFree ? 'Free' : `$${event.price}`}</Text>
          <Button
            title={isFull ? 'Event Full' : 'Register as Guest'}
            onPress={() => handleEventPress(event)}
            disabled={isFull}
            tone="primary"
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing && events.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Guest Banner */}
      <View style={styles.guestBanner}>
        <Text style={styles.guestBannerTitle}>👋 Welcome, Guest!</Text>
        <Text style={styles.guestBannerText}>
          Browse and register for events without signing in. Create an account for full access to
          networking, coaching, and more.
        </Text>
        <Button title="Sign In for Full Access" onPress={onSignInPress} tone="secondary" />
      </View>

      {/* Hero */}
      <ImageBackground source={{ uri: stockPhotos.eventsHero }} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroOverlay}>
          <Text style={styles.title}>Sponsored Events</Text>
          <Text style={styles.subtitle}>Golf tournaments and clinics</Text>
        </View>
      </ImageBackground>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try Again" onPress={() => loadEvents()} tone="secondary" />
        </View>
      ) : null}

      <View style={styles.eventsPane}>
        {events.length === 0 && !loading ? (
          <Card>
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Events Available</Text>
              <Text style={styles.emptyText}>Check back soon for upcoming golf tournaments and clinics.</Text>
            </View>
          </Card>
        ) : (
          events.map(renderEventCard)
        )}
      </View>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Want to unlock all features?</Text>
        <Button title="Create Free Account" onPress={onSignInPress} tone="secondary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: palette.ink700,
    fontSize: 16,
  },
  guestBanner: {
    backgroundColor: '#E0F2FE',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  guestBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  guestBannerText: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  hero: {
    height: 180,
    justifyContent: 'flex-end',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  heroImage: {
    borderRadius: radius.md,
  },
  heroOverlay: {
    backgroundColor: 'rgba(8, 47, 67, 0.6)',
    padding: spacing.md,
  },
  title: {
    fontSize: 28,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.white,
  },
  subtitle: {
    fontSize: 14,
    color: '#CBE4F3',
    marginTop: 4,
  },
  eventsPane: {
    gap: spacing.md,
  },
  eventCard: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: spacing.md,
    gap: 6,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
  },
  description: {
    color: palette.ink700,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: palette.ink700,
    fontSize: 14,
  },
  registrationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  registrationCount: {
    color: palette.ink500,
    fontSize: 13,
  },
  fullBadge: {
    color: palette.red500,
    fontSize: 12,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.navy600,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    color: palette.red500,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: palette.ink700,
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  footerText: {
    fontSize: 16,
    color: palette.ink700,
    fontWeight: '600',
  },
});
