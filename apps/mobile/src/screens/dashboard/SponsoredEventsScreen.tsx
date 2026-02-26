import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { invokeFunction } from '../../lib/api';
import { supabase } from '../../lib/supabase';

type SponsoredEvent = {
  id: string;
  title: string;
  activityId?: string;
  sport: 'Golf' | 'Pickleball' | 'Tennis' | 'Padel' | string;
  city: string;
  date: string;
  sponsor: string;
  format: 'Tournament' | 'Clinic' | 'Local Mixer' | string;
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
  },
  {
    id: 'e-2',
    title: 'Downtown Pickleball Ladder',
    sport: 'Pickleball',
    city: 'Austin',
    date: '2026-03-20',
    sponsor: 'ATX Paddle Co',
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
        .in('slug', ['golf', 'pickleball', 'tennis', 'padel'])
        .order('slug', { ascending: true });
      const preferred = data?.find((item) => item.slug === 'golf') ?? data?.[0];
      if (preferred) setActivityId(preferred.id);
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

  // m-4: Only depend on activityId — sport is used client-side only and should not trigger a refetch
  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]); // sport intentionally excluded — used for display mapping only

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Sponsored Events</Text>
      <Text style={styles.subtitle}>Create tournaments, fund local participation, and invite nearby athletes through Spotter.</Text>

      <View style={styles.createCard}>
        <Text style={styles.sectionTitle}>Create Tournament</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Event title" style={styles.input} />
        <TextInput
          value={sport}
          onChangeText={setSport}
          placeholder="Sport (Golf, Pickleball, Tennis, Padel)"
          style={styles.input}
        />
        <TextInput value={city} onChangeText={setCity} placeholder="City" style={styles.input} />
        <TextInput value={sponsor} onChangeText={setSponsor} placeholder="Sponsor name" style={styles.input} />
        <TextInput value={date} onChangeText={setDate} placeholder="Date (YYYY-MM-DD)" style={styles.input} />
        <Button title="Publish Sponsored Tournament" onPress={createSponsoredEvent} disabled={!canCreate} />
      </View>

      <Button title={loading ? 'Refreshing...' : 'Refresh Sponsored Events'} onPress={loadEvents} disabled={loading} />
      {loading ? <ActivityIndicator color="#0b3a53" /> : null}

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
            <Button title="Invite Locals as Sponsor" onPress={() => inviteLocals(event.id)} disabled={actioningId === event.id} />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#102a43'
  },
  subtitle: {
    color: '#486581'
  },
  createCard: {
    backgroundColor: '#d9e2ec',
    borderRadius: 12,
    padding: 12,
    gap: 8
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#102a43'
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    padding: 12,
    gap: 6
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102a43'
  },
  meta: {
    color: '#486581'
  }
});
