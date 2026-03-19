import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { invokeFunction } from '../../lib/api';
import { stockPhotos } from '../../lib/stockPhotos';
import { supabase } from '../../lib/supabase';
import { font, isWeb, palette, radius, spacing } from '../../theme/design';

// Golf-only sponsored events (removed pickleball, tennis, padel)

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
  myRegistrationStatus?: string | null;
  registrationCount?: number;
};

const initialEvents: SponsoredEvent[] = [
  {
    id: 'e-1',
    title: 'Sunrise Golf Pairing Cup',
    sport: 'Golf',
    city: 'Scottsdale',
    date: '2026-03-15',
    sponsor: 'Desert Golf Supply',
    format: 'Tournament',
    invitesOpen: true
  }
];

export function SponsoredEventsScreen() {
  const [activityId, setActivityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [events, setEvents] = useState<SponsoredEvent[]>(initialEvents);
  const [title, setTitle] = useState('');
  const [sport, setSport] = useState('Golf');
  const [city, setCity] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [date, setDate] = useState('');
  const [inviteRequests, setInviteRequests] = useState<string[]>([]);

  const canCreate = useMemo(() => title.trim() && sport.trim() && city.trim() && sponsor.trim() && date.trim(), [title, sport, city, sponsor, date]);

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

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await invokeFunction<Array<{
        id: string;
        activity_id: string;
        title: string;
        city: string | null;
        start_time: string;
        sponsor_name?: string;
        registration_count?: number;
        my_registration_status?: string | null;
      }>>('sponsors-event-list', {
        method: 'POST',
        body: {
          activityId: activityId ?? undefined
        }
      });
      const mapped: SponsoredEvent[] = response.map((item) => ({
        id: item.id,
        activityId: item.activity_id,
        title: item.title,
        sport: sport || 'Golf',
        city: item.city ?? 'TBD',
        date: item.start_time.slice(0, 10),
        sponsor: item.sponsor_name ?? 'Sponsor',
        format: 'Tournament',
        invitesOpen: true,
        myRegistrationStatus: item.my_registration_status ?? null,
        registrationCount: item.registration_count ?? 0
      }));
      if (mapped.length) setEvents(mapped);
    } catch {
      setEvents(initialEvents);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [activityId, sport]);

  const createSponsoredEvent = async () => {
    if (!canCreate) return;
    if (!activityId) {
      Alert.alert('Missing activity', 'Please select a supported sport first.');
      return;
    }
    try {
      await invokeFunction('sponsors-event-create', {
        method: 'POST',
        body: {
          sponsorName: sponsor.trim(),
          title: title.trim(),
          activityId,
          city: city.trim(),
          venueName: `${city.trim()} Community Courts`,
          startTime: `${date.trim()}T09:00:00.000Z`,
          endTime: `${date.trim()}T13:00:00.000Z`,
          maxParticipants: 64
        }
      });
      setTitle('');
      setSport('Golf');
      setCity('');
      setSponsor('');
      setDate('');
      await loadEvents();
    } catch (error) {
      Alert.alert('Create failed', error instanceof Error ? error.message : 'Could not create sponsored event');
    }
  };

  const requestInvite = async (eventId: string) => {
    if (inviteRequests.includes(eventId)) return;
    setActioningId(eventId);
    try {
      await invokeFunction('sponsors-event-rsvp', {
        method: 'POST',
        body: {
          eventId,
          action: 'register'
        }
      });
      setInviteRequests((prev) => [...prev, eventId]);
      await loadEvents();
    } catch (error) {
      Alert.alert('RSVP failed', error instanceof Error ? error.message : 'Could not request invite');
    } finally {
      setActioningId(null);
    }
  };

  const inviteLocals = async (eventId: string) => {
    setActioningId(eventId);
    try {
      await invokeFunction('sponsors-event-invite-locals', {
        method: 'POST',
        body: {
          eventId,
          radiusKm: 50,
          limit: 20,
          message: 'Local sponsor invite: tournament registration open on Spotter.'
        }
      });
      Alert.alert('Locals invited', 'Spotter has sent local invites to nearby players.');
    } catch (error) {
      Alert.alert('Invite locals failed', error instanceof Error ? error.message : 'Could not invite locals');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadEvents} />}
    >
      <ImageBackground source={{ uri: stockPhotos.eventsHero }} style={styles.hero} imageStyle={styles.heroImage}>
        <Text style={styles.title}>Sponsored Events</Text>
      </ImageBackground>
      <Text style={styles.subtitle}>Create tournaments, activate sponsors, and invite locals based on activity fit.</Text>

      <View style={styles.layout}>
        <View style={styles.createCard}>
          <Text style={styles.sectionTitle}>Create Tournament</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Event title" style={styles.input} placeholderTextColor={palette.ink500} />
          <TextInput
            value={sport}
            onChangeText={setSport}
            placeholder="Sport (Golf)"
            style={styles.input}
            placeholderTextColor={palette.ink500}
          />
          <TextInput value={city} onChangeText={setCity} placeholder="City" style={styles.input} placeholderTextColor={palette.ink500} />
          <TextInput value={sponsor} onChangeText={setSponsor} placeholder="Sponsor name" style={styles.input} placeholderTextColor={palette.ink500} />
          <TextInput value={date} onChangeText={setDate} placeholder="Date (YYYY-MM-DD)" style={styles.input} placeholderTextColor={palette.ink500} />
          <Button title="Publish Sponsored Tournament" onPress={createSponsoredEvent} disabled={!canCreate} />
          <Button title={loading ? 'Refreshing...' : 'Refresh Sponsored Events'} onPress={loadEvents} disabled={loading} tone="secondary" />
        </View>

        <View style={styles.eventsPane}>
          {loading ? <ActivityIndicator color={palette.navy600} /> : null}
          {events.map((event) => {
            const requested = inviteRequests.includes(event.id);
            return (
              <View key={event.id} style={styles.eventCard}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.meta}>
                  {event.sport} • {event.format} • {event.date}
                </Text>
                <Text style={styles.meta}>
                  {event.city} • Sponsored by {event.sponsor}
                </Text>
                <Text style={styles.meta}>
                  Registered: {event.registrationCount ?? 0}
                  {event.myRegistrationStatus ? ` • Your status: ${event.myRegistrationStatus}` : ''}
                </Text>
                <Button
                  title={requested ? 'Invite Request Sent' : 'Request Local Invite'}
                  onPress={() => requestInvite(event.id)}
                  disabled={requested || !event.invitesOpen || actioningId === event.id}
                />
                <Button title="Invite Locals as Sponsor" onPress={() => inviteLocals(event.id)} disabled={actioningId === event.id} tone="secondary" />
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md
  },
  hero: {
    height: 150,
    justifyContent: 'flex-end',
    padding: spacing.md
  },
  heroImage: {
    borderRadius: radius.md
  },
  layout: {
    ...(isWeb
      ? {
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start'
        }
      : {
          gap: spacing.md
        })
  },
  title: {
    fontSize: 24,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.white
  },
  subtitle: {
    color: palette.ink700
  },
  createCard: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: spacing.md,
    gap: spacing.xs,
    ...(isWeb ? { flex: 1, maxWidth: 420 } : {})
  },
  eventsPane: {
    gap: spacing.md,
    ...(isWeb ? { flex: 1.5 } : {})
  },
  sectionTitle: {
    fontWeight: '700',
    color: palette.ink900
  },
  input: {
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink900
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
  meta: {
    color: palette.ink700
  }
});
