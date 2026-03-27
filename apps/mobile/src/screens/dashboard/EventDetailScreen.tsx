import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { invokeFunction } from '../lib/api';
import { stockPhotos } from '../../lib/stockPhotos';
import { supabase } from '../../lib/supabase';
import { font, palette, radius, spacing } from '../theme/design';

type RegistrationStatus = 'pending_approval' | 'confirmed' | 'cancelled' | 'checked_in' | null;

type EventDetail = {
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
  myRegistrationStatus?: RegistrationStatus;
  registrationCount: number;
  maxParticipants?: number;
  price: number;
  requiresApproval: boolean;
  registrationDeadline?: string;
  targetTiers: string[];
  status: 'published' | 'draft' | 'cancelled' | 'completed';
};

type Props = {
  session: Session;
  eventId: string;
  onRegister: (eventId: string, price: number) => void;
  onBack: () => void;
};

export function EventDetailScreen({ session, eventId, onRegister, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('free');
  const [isEligible, setIsEligible] = useState(true);

  // Load user's tier
  useEffect(() => {
    const loadUserTier = async () => {
      const { data: user } = await supabase
        .from('users')
        .select('tier_id, membership_tiers (slug)')
        .eq('id', session.user.id)
        .single();
      
      if (user?.membership_tiers) {
        const tier = (user.membership_tiers as { slug: string }).slug;
        setUserTier(tier);
      }
    };
    loadUserTier();
  }, [session.user.id]);

  const loadEventDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get event details from sponsors-event-list and find the specific event
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
        my_registration_status?: string | null;
        price?: number;
        requires_approval?: boolean;
        registration_deadline?: string;
        target_tiers?: string[];
        status?: string;
      }>>('sponsors-event-list', {
        method: 'POST',
        body: {}
      });

      const eventData = response.find(e => e.id === eventId);
      
      if (!eventData) {
        throw new Error('Event not found');
      }

      // Check tier eligibility
      const targetTiers = eventData.target_tiers || ['free', 'select', 'summit'];
      const eligible = targetTiers.includes(userTier);
      setIsEligible(eligible);

      const mapped: EventDetail = {
        id: eventData.id,
        title: eventData.title,
        description: eventData.description,
        sport: 'Golf',
        city: eventData.city ?? 'TBD',
        venueName: eventData.venue_name,
        date: eventData.start_time.slice(0, 10),
        startTime: new Date(eventData.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        endTime: new Date(eventData.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sponsor: eventData.sponsor_name ?? 'Sponsor',
        format: 'Tournament',
        myRegistrationStatus: (eventData.my_registration_status as RegistrationStatus) ?? null,
        registrationCount: eventData.registration_count ?? 0,
        maxParticipants: eventData.max_participants,
        price: eventData.price ?? 0,
        requiresApproval: eventData.requires_approval ?? false,
        registrationDeadline: eventData.registration_deadline,
        targetTiers: targetTiers,
        status: (eventData.status as EventDetail['status']) ?? 'published'
      };
      
      setEvent(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load event details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [eventId, userTier]);

  useEffect(() => {
    loadEventDetail();
  }, [loadEventDetail]);

  const handleRegister = () => {
    if (!event) return;
    
    if (!isEligible) {
      Alert.alert(
        'Not Eligible',
        `This event is only available to ${event.targetTiers.join(', ')} tier members.`
      );
      return;
    }

    if (event.status !== 'published') {
      Alert.alert('Registration Closed', 'This event is no longer accepting registrations.');
      return;
    }

    if (event.registrationDeadline && new Date(event.registrationDeadline) < new Date()) {
      Alert.alert('Registration Closed', 'The registration deadline has passed.');
      return;
    }

    if (event.maxParticipants && event.registrationCount >= event.maxParticipants) {
      Alert.alert('Event Full', 'This event has reached maximum capacity.');
      return;
    }

    onRegister(event.id, event.price);
  };

  const getRegistrationButtonProps = () => {
    if (!event) return { title: 'Register', disabled: true };
    
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
      return { 
        title: event.price > 0 ? `Register Again ($${event.price})` : 'Register Again', 
        disabled: false, 
        tone: 'primary' as const 
      };
    }
    if (event.price > 0) {
      return { title: `Register ($${event.price})`, disabled: false, tone: 'primary' as const };
    }
    return { title: 'Register', disabled: false, tone: 'primary' as const };
  };

  const isFull = event?.maxParticipants && event?.registrationCount >= event?.maxParticipants;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error Loading Event</Text>
          <Text style={styles.errorText}>{error || 'Event not found'}</Text>
          <Button title="Go Back" onPress={onBack} />
          <Button title="Try Again" onPress={loadEventDetail} tone="secondary" />
        </View>
      </ScrollView>
    );
  }

  const buttonProps = getRegistrationButtonProps();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ImageBackground 
        source={{ uri: stockPhotos.eventsHero }} 
        style={styles.hero} 
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroOverlay}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.sponsor}>Sponsored by {event.sponsor}</Text>
        </View>
      </ImageBackground>

      <View style={styles.content}>
        {!isEligible && (
          <View style={styles.eligibilityBanner}>
            <Text style={styles.eligibilityText}>
              This event is only available to {event.targetTiers.join(', ')} tier members
            </Text>
          </View>
        )}

        {event.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sport</Text>
            <Text style={styles.detailValue}>{event.sport}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Format</Text>
            <Text style={styles.detailValue}>{event.format}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{event.date}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{event.startTime} - {event.endTime}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue}>{event.city}{event.venueName ? ` • ${event.venueName}` : ''}</Text>
          </View>

          {event.registrationDeadline && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Registration Deadline</Text>
              <Text style={styles.detailValue}>{new Date(event.registrationDeadline).toLocaleDateString()}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registration</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Price</Text>
            <Text style={styles.detailValue}>{event.price > 0 ? `$${event.price}` : 'Free'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Spots Available</Text>
            <Text style={styles.detailValue}>
              {event.maxParticipants 
                ? `${event.maxParticipants - event.registrationCount} of ${event.maxParticipants}`
                : 'Unlimited'}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Registered</Text>
            <Text style={styles.detailValue}>{event.registrationCount}</Text>
          </View>

          {event.requiresApproval && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Approval Required</Text>
              <Text style={styles.detailValue}>Yes</Text>
            </View>
          )}

          {event.myRegistrationStatus && (
            <View style={styles.myStatusContainer}>
              <Text style={styles.myStatusLabel}>Your Registration Status:</Text>
              <Text style={styles.myStatusValue}>{event.myRegistrationStatus.replace('_', ' ')}</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title={isFull && !event.myRegistrationStatus ? 'Event Full' : buttonProps.title}
            onPress={handleRegister}
            disabled={buttonProps.disabled || isFull || !isEligible}
            tone={buttonProps.tone}
          />
          <Button title="Back to Events" onPress={onBack} tone="secondary" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1
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
    height: 200,
    justifyContent: 'flex-end'
  },
  heroImage: {
    borderRadius: 0
  },
  heroOverlay: {
    backgroundColor: 'rgba(8, 47, 67, 0.7)',
    padding: spacing.lg
  },
  title: {
    fontSize: 28,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.white
  },
  sponsor: {
    fontSize: 16,
    color: '#CBE4F3',
    marginTop: 4
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg
  },
  eligibilityBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#F59E0B'
  },
  eligibilityText: {
    color: '#92400E',
    fontSize: 14,
    textAlign: 'center'
  },
  section: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: spacing.md,
    gap: spacing.sm
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs
  },
  description: {
    color: palette.ink700,
    fontSize: 15,
    lineHeight: 22
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200
  },
  detailLabel: {
    color: palette.ink500,
    fontSize: 14
  },
  detailValue: {
    color: palette.ink900,
    fontSize: 14,
    fontWeight: '500'
  },
  myStatusContainer: {
    backgroundColor: '#E0F2FE',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm
  },
  myStatusLabel: {
    color: palette.ink700,
    fontSize: 13,
    marginBottom: 4
  },
  myStatusValue: {
    color: palette.navy600,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize'
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.red500
  },
  errorText: {
    color: palette.ink700,
    textAlign: 'center',
    marginBottom: spacing.md
  }
});
