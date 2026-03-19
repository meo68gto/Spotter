import { useEffect, useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { invokeFunction } from '../../lib/api';
import { stockPhotos } from '../../lib/stockPhotos';
import { supabase } from '../../lib/supabase';
import { font, isWeb, palette, radius, spacing } from '../../theme/design';

// Golf-only sponsored events (removed pickleball, tennis, padel)

type RegistrationStatus = 'pending_approval' | 'confirmed' | 'cancelled' | 'checked_in' | null;

type SponsoredEvent = {
  id: string;
  title: string;
  activityId?: string;
  sport: 'Golf';
  city: string;
  date: string;
  sponsor: string;
  format: 'Tournament' | 'Clinic' | 'Local Mixer';
  invitesOpen: boolean;
  myRegistrationStatus?: RegistrationStatus;
  registrationCount?: number;
  maxParticipants?: number;
  description?: string;
  venueName?: string;
  price?: number;
  requiresApproval?: boolean;
};

type Props = {
  session: Session;
  onEventPress?: (eventId: string) => void;
};

export function SponsoredEventsScreen({ session, onEventPress }: Props) {
  const [activityId, setActivityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [events, setEvents] = useState<SponsoredEvent[]>([]);
  const [userTier, setUserTier] = useState<string>('free');

  // Load user's tier for visibility checks
  useEffect(() => {
    const loadUserTier = async () => {
      const { data: user } = await supabase
        .from('users')
        .select('tier_id, membership_tiers (slug)')
        .eq('id', session.user.id)
        .single();
      
      if (user?.membership_tiers) {
        setUserTier((user.membership_tiers as { slug: string }).slug);
      }
    };
    loadUserTier();
  }, [session.user.id]);

  // Load golf activity ID
  useEffect(() => {
    const loadActivity = async () => {
      const { data } = await supabase
        .from('activities')
        .select('id, slug')
        .eq('slug', 'golf')
        .single();
      if (data) setActivityId(data.id);
    };
    loadActivity();
  }, []);

  const loadEvents = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    
    try {
      const response = await invokeFunction<Array<{
        id: string;
        activity_id: string;
        title: string;
        description?: string;
        city: string | null;
        venue_name?: string;
        start_time: string;
        sponsor_name?: string;
        registration_count?: number;
        max_participants?: number;
        my_registration_status?: string | null;
        price?: number;
        requires_approval?: boolean;
        target_tiers?: string[];
      }>>('sponsors-event-list', {
        method: 'POST',
        body: {
          activityId: activityId ?? undefined
        }
      });

      // Filter events by user's tier visibility
      const visibleEvents = (response || []).filter((item) => {
        const targetTiers = item.target_tiers || ['free', 'select', 'summit'];
        return targetTiers.includes(userTier);
      });

      const mapped: SponsoredEvent[] = visibleEvents.map((item) => ({
        id: item.id,
        activityId: item.activity_id,
        title: item.title,
        description: item.description,
        sport: 'Golf',
        city: item.city ?? 'TBD',
        date: item.start_time.slice(0, 10),
        sponsor: item.sponsor_name ?? 'Sponsor',
        format: 'Tournament',
        invitesOpen: true,
        myRegistrationStatus: (item.my_registration_status as RegistrationStatus) ?? null,
        registrationCount: item.registration_count ?? 0,
        maxParticipants: item.max_participants,
        venueName: item.venue_name,
        price: item.price ?? 0,
        requiresApproval: item.requires_approval ?? false
      }));
      
      setEvents(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load events';
      setError(message);
      // Don't show alert on initial load, just display error state
      if (isRefresh) {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activityId, userTier]);

  useEffect(() => {
    if (activityId) {
      loadEvents();
    }
  }, [activityId, loadEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents(true);
  }, [loadEvents]);

  const handleEventPress = (eventId: string) => {
    if (onEventPress) {
      onEventPress(eventId);
    }
  };

  const getRegistrationButtonProps = (event: SponsoredEvent) => {
    const status = event.myRegistrationStatus;
    
    if (status === 'confirmed') {
      return { title: 'Registered ✓', disabled: true, tone: 'secondary' as const };
    }
    if (status === 'pending_approval') {
      return { title: 'Pending Approval', disabled: true, tone: 'secondary' as const };
    }
    if (status === 'checked_in') {
      return { title: 'Checked In ✓', disabled: true, tone: 'secondary' as const };
    }
    if (status === 'cancelled') {
      return { title: 'Register Again', disabled: false, tone: 'primary' as const };
    }
    if (event.price && event.price > 0) {
      return { title: `Register ($${event.price})`, disabled: false, tone: 'primary' as const };
    }
    return { title: 'Register', disabled: false, tone: 'primary' as const };
  };

  const renderEventCard = (event: SponsoredEvent) => {
    const buttonProps = getRegistrationButtonProps(event);
    const isFull = event.maxParticipants && event.registrationCount && event.registrationCount >= event.maxParticipants;
    
    return (
      <TouchableOpacity 
        key={event.id} 
        style={styles.eventCard}
        onPress={() => handleEventPress(event.id)}
        activeOpacity={0.8}
      >
        <Text style={styles.eventTitle}>{event.title}</Text>
        {event.description ? (
          <Text style={styles.description} numberOfLines={2}>{event.description}</Text>
        ) : null}
        <Text style={styles.meta}>
          {event.sport} • {event.format} • {event.date}
        </Text>
        <Text style={styles.meta}>
          {event.city} {event.venueName ? `• ${event.venueName}` : ''}
        </Text>
        <Text style={styles.meta}>
          Sponsored by {event.sponsor}
        </Text>
        <View style={styles.registrationRow}>
          <Text style={styles.registrationCount}>
            {event.registrationCount ?? 0} / {event.maxParticipants ?? '∞'} registered
          </Text>
          {isFull && !event.myRegistrationStatus && (
            <Text style={styles.fullBadge}>Event Full</Text>
          )}
        </View>
        {event.myRegistrationStatus && (
          <Text style={styles.myStatus}>
            Your status: <Text style={styles.statusValue}>{event.myRegistrationStatus.replace('_', ' ')}</Text>
          </Text>
        )}
        <Button
          title={isFull && !event.myRegistrationStatus ? 'Event Full' : buttonProps.title}
          onPress={() => handleEventPress(event.id)}
          disabled={buttonProps.disabled || isFull}
          tone={buttonProps.tone}
        />
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
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Events Available</Text>
            <Text style={styles.emptyText}>Check back soon for upcoming golf tournaments and clinics.</Text>
          </View>
        ) : (
          events.map(renderEventCard)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  loadingText: {
    marginTop: spacing.md,
    color: palette.ink700,
    fontSize: 16
  },
  hero: {
    height: 180,
    justifyContent: 'flex-end',
    borderRadius: radius.md,
    overflow: 'hidden'
  },
  heroImage: {
    borderRadius: radius.md
  },
  heroOverlay: {
    backgroundColor: 'rgba(8, 47, 67, 0.6)',
    padding: spacing.md
  },
  title: {
    fontSize: 28,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.white
  },
  subtitle: {
    fontSize: 14,
    color: '#CBE4F3',
    marginTop: 4
  },
  eventsPane: {
    gap: spacing.md
  },
  eventCard: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: spacing.md,
    gap: 6
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900
  },
  description: {
    color: palette.ink700,
    fontSize: 14,
    lineHeight: 20
  },
  meta: {
    color: palette.ink700,
    fontSize: 14
  },
  registrationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs
  },
  registrationCount: {
    color: palette.ink500,
    fontSize: 13
  },
  fullBadge: {
    color: palette.red500,
    fontSize: 12,
    fontWeight: '600'
  },
  myStatus: {
    color: palette.ink700,
    fontSize: 14,
    marginTop: spacing.xs
  },
  statusValue: {
    fontWeight: '600',
    color: palette.navy600
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm
  },
  errorText: {
    color: palette.red500,
    textAlign: 'center'
  },
  emptyState: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: spacing.xl,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs
  },
  emptyText: {
    color: palette.ink700,
    textAlign: 'center'
  }
});
