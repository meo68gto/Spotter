import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { invokeFunction } from '../../lib/api';
import { supabase } from '../../lib/supabase';

type ActivityItem = {
  id: string;
  slug: string;
  name: string;
};

type PlayerCard = {
  id: string;
  name: string;
  sport: string;
  level: string;
  city: string;
  openToInvite: boolean;
  note: string;
  score?: number;
};

const seedPlayers: PlayerCard[] = [
  {
    id: 'u-1',
    name: 'Chris M.',
    sport: 'Golf',
    level: 'Intermediate',
    city: 'Scottsdale',
    openToInvite: true,
    note: 'Prefers 9-hole weekday rounds.'
  },
  {
    id: 'u-2',
    name: 'Jamie R.',
    sport: 'Pickleball',
    level: 'Advanced',
    city: 'Austin',
    openToInvite: true,
    note: 'Great drill partner, evenings only.'
  },
  {
    id: 'u-3',
    name: 'Taylor S.',
    sport: 'Tennis',
    level: 'Intermediate',
    city: 'San Diego',
    openToInvite: false,
    note: 'Booked this week, available next weekend.'
  }
];

export function NetworkingHubScreen() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [players, setPlayers] = useState<PlayerCard[]>(seedPlayers);
  const [eventHints, setEventHints] = useState<Array<{ id: string; title: string; city?: string | null; sponsor?: string | null }>>([]);
  const [sentInvites, setSentInvites] = useState<string[]>([]);

  useEffect(() => {
    const loadActivities = async () => {
      const { data } = await supabase
        .from('activities')
        .select('id, slug, name')
        .in('slug', ['golf', 'pickleball', 'tennis', 'padel', 'soccer'])
        .order('name', { ascending: true });
      if (!data?.length) {
        setLoading(false);
        return;
      }
      setActivities(data as ActivityItem[]);
      const preferred = data.find((item) => item.slug === 'golf') ?? data.find((item) => item.slug === 'pickleball') ?? data[0];
      setActivityId(preferred.id);
      setSportFilter(preferred.name);
    };
    loadActivities();
  }, []);

  useEffect(() => {
    if (!activityId) return;
    const runPlan = async () => {
      setLoading(true);
      try {
        const response = await invokeFunction<{
          run: { id: string };
          pairings: Array<{
            candidateUserId: string | null;
            candidateDisplayName: string;
            score: number;
            distanceKm?: number | null;
            reasons?: unknown;
          }>;
          events: Array<{ eventId: string | null; title: string; city?: string | null; sponsorName?: string | null }>;
        }>('mcp-booking-plan', {
          method: 'POST',
          body: {
            activityId,
            radiusKm: 35,
            limit: 8,
            includeEvents: true,
            objective: 'balanced'
          }
        });

        const mappedPlayers: PlayerCard[] = response.pairings
          .filter((pairing) => pairing.candidateUserId)
          .map((pairing) => ({
            id: pairing.candidateUserId as string,
            name: pairing.candidateDisplayName || 'Local player',
            sport: sportFilter || 'Coachable sport',
            level: 'Matched',
            city: cityFilter || 'Nearby',
            openToInvite: true,
            note: `${pairing.distanceKm?.toFixed(1) ?? '?'} km away`,
            score: pairing.score
          }));

        setPlayers(mappedPlayers.length ? mappedPlayers : seedPlayers);
        setEventHints(
          response.events
            .filter((event) => event.eventId)
            .map((event) => ({
              id: event.eventId as string,
              title: event.title,
              city: event.city,
              sponsor: event.sponsorName ?? null
            }))
        );
      } catch {
        setPlayers(seedPlayers);
      } finally {
        setLoading(false);
      }
    };
    runPlan();
  }, [activityId, cityFilter, sportFilter]);

  const filtered = useMemo(() => {
    return players.filter((player) => {
      const sportOk = sportFilter ? player.sport.toLowerCase().includes(sportFilter.toLowerCase()) : true;
      const cityOk = cityFilter ? player.city.toLowerCase().includes(cityFilter.toLowerCase()) : true;
      return sportOk && cityOk;
    });
  }, [players, sportFilter, cityFilter]);

  const invite = async (id: string) => {
    if (sentInvites.includes(id)) return;
    try {
      if (!activityId) {
        throw new Error('Select an activity first');
      }
      await invokeFunction('networking-invite-send', {
        method: 'POST',
        body: {
          receiverUserId: id,
          activityId,
          purpose: 'tournament',
          message: 'You are invited to connect and join a local sponsored tournament via Spotter.'
        }
      });
      setSentInvites((prev) => [...prev, id]);
    } catch (error) {
      Alert.alert('Invite failed', error instanceof Error ? error.message : 'Unable to send invite');
    }
  };

  const refreshPlan = async () => {
    if (!activityId) return;
    setRefreshing(true);
    try {
      const response = await invokeFunction<{
        pairings: Array<{
          candidateUserId: string | null;
          candidateDisplayName: string;
          score: number;
          distanceKm?: number | null;
        }>;
      }>('mcp-booking-plan', {
        method: 'POST',
        body: {
          activityId,
          radiusKm: 35,
          limit: 8,
          includeEvents: true
        }
      });
      const mappedPlayers: PlayerCard[] = response.pairings
        .filter((pairing) => pairing.candidateUserId)
        .map((pairing) => ({
          id: pairing.candidateUserId as string,
          name: pairing.candidateDisplayName || 'Local player',
          sport: sportFilter || 'Coachable sport',
          level: 'Matched',
          city: cityFilter || 'Nearby',
          openToInvite: true,
          note: `${pairing.distanceKm?.toFixed(1) ?? '?'} km away`,
          score: pairing.score
        }));
      setPlayers(mappedPlayers.length ? mappedPlayers : seedPlayers);
    } catch {
      setPlayers(seedPlayers);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Local Networking</Text>
      <Text style={styles.subtitle}>Find local players for coachable sports and invite them to train or compete.</Text>

      <View style={styles.filters}>
        <TextInput
          value={activityId ? activities.find((activity) => activity.id === activityId)?.name ?? '' : ''}
          onChangeText={(value) => {
            const match = activities.find((activity) => activity.name.toLowerCase() === value.toLowerCase());
            if (match) setActivityId(match.id);
            setSportFilter(value);
          }}
          placeholder="Primary sport (Golf, Pickleball...)"
          style={styles.input}
        />
        <TextInput
          value={sportFilter}
          onChangeText={setSportFilter}
          placeholder="Filter by sport (golf, pickleball...)"
          style={styles.input}
        />
        <TextInput value={cityFilter} onChangeText={setCityFilter} placeholder="Filter by city" style={styles.input} />
      </View>

      <View style={styles.toolsCard}>
        <Text style={styles.toolsTitle}>Networking Tools</Text>
        <Text style={styles.toolsItem}>- Quick local invite to private matches or practice sessions</Text>
        <Text style={styles.toolsItem}>- Skill-aware intros (keeps match quality high)</Text>
        <Text style={styles.toolsItem}>- Sponsor-friendly local outreach lists</Text>
      </View>

      {eventHints.length ? (
        <View style={styles.toolsCard}>
          <Text style={styles.toolsTitle}>Suggested Sponsored Tournaments</Text>
          {eventHints.slice(0, 3).map((event) => (
            <Text key={event.id} style={styles.toolsItem}>
              - {event.title}
              {event.city ? ` (${event.city})` : ''}
              {event.sponsor ? ` • ${event.sponsor}` : ''}
            </Text>
          ))}
        </View>
      ) : null}

      <Button title={refreshing ? 'Refreshing...' : 'Refresh MCP Booking Plan'} onPress={refreshPlan} disabled={refreshing} />

      {loading ? <ActivityIndicator color="#0b3a53" /> : null}

      {filtered.map((player) => {
        const invited = sentInvites.includes(player.id);
        return (
          <View key={player.id} style={styles.card}>
            <Text style={styles.cardName}>{player.name}</Text>
            <Text style={styles.meta}>
              {player.sport} • {player.level} • {player.city}
            </Text>
            <Text style={styles.note}>{player.note}</Text>
            {typeof player.score === 'number' ? <Text style={styles.note}>MCP score: {player.score.toFixed(1)}</Text> : null}
            <Button
              title={invited ? 'Invite Sent' : player.openToInvite ? 'Invite to Session/Tournament' : 'Not Available'}
              onPress={() => invite(player.id)}
              disabled={invited || !player.openToInvite}
            />
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
  filters: {
    gap: 8
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  toolsCard: {
    backgroundColor: '#d9e2ec',
    borderRadius: 12,
    padding: 12
  },
  toolsTitle: {
    fontWeight: '700',
    color: '#102a43',
    marginBottom: 6
  },
  toolsItem: {
    color: '#334e68',
    marginBottom: 4
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    padding: 12,
    gap: 8
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102a43'
  },
  meta: {
    color: '#486581',
    fontWeight: '600'
  },
  note: {
    color: '#334e68'
  }
});
