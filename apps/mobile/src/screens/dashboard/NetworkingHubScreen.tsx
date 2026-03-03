import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { invokeFunction } from '../../lib/api';
import { stockPhotos } from '../../lib/stockPhotos';
import { supabase } from '../../lib/supabase';
import { font, isWeb, palette, radius, spacing } from '../../theme/design';

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
          pairings: Array<{
            candidateUserId: string | null;
            candidateDisplayName: string;
            score: number;
            distanceKm?: number | null;
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
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshPlan} />}
    >
      <ImageBackground source={{ uri: stockPhotos.networkHero }} style={styles.hero} imageStyle={styles.heroImage}>
        <Text style={styles.title}>Local Networking</Text>
      </ImageBackground>
      <Text style={styles.subtitle}>Find serious local partners and route them into sponsor-backed events.</Text>

      <View style={styles.layout}>
        <View style={styles.leftPane}>
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
              placeholderTextColor={palette.ink500}
            />
            <TextInput value={sportFilter} onChangeText={setSportFilter} placeholder="Filter by sport" style={styles.input} placeholderTextColor={palette.ink500} />
            <TextInput value={cityFilter} onChangeText={setCityFilter} placeholder="Filter by city" style={styles.input} placeholderTextColor={palette.ink500} />
          </View>

          <View style={styles.toolsCard}>
            <Text style={styles.toolsTitle}>Networking Toolkit</Text>
            <Text style={styles.toolsItem}>- Partner discovery by skill, distance, and readiness</Text>
            <Text style={styles.toolsItem}>- One-tap invite to practice or tournament lane</Text>
            <Text style={styles.toolsItem}>- Sponsor activation for local event turnout</Text>
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

          <Button title={refreshing ? 'Refreshing...' : 'Refresh MCP Booking Plan'} onPress={refreshPlan} disabled={refreshing} tone="secondary" />
          {loading ? <ActivityIndicator color={palette.navy600} /> : null}
        </View>

        <View style={styles.rightPane}>
          {filtered.map((player) => {
            const invited = sentInvites.includes(player.id);
            return (
              <View key={player.id} style={styles.card}>
                <Text style={styles.cardName}>{player.name}</Text>
                <Text style={styles.meta}>
                  {player.sport} • {player.level} • {player.city}
                </Text>
                <Text style={styles.note}>{player.note}</Text>
                {typeof player.score === 'number' ? <Text style={styles.score}>MCP score: {player.score.toFixed(1)}</Text> : null}
                <Button
                  title={invited ? 'Invite Sent' : player.openToInvite ? 'Invite to Session/Tournament' : 'Not Available'}
                  onPress={() => invite(player.id)}
                  disabled={invited || !player.openToInvite}
                />
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
  title: {
    fontSize: 26,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.white
  },
  subtitle: {
    color: palette.ink700
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
  leftPane: {
    ...(isWeb ? { flex: 1, maxWidth: 420 } : { gap: spacing.md })
  },
  rightPane: {
    gap: spacing.md,
    ...(isWeb ? { flex: 1.6 } : {})
  },
  filters: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: spacing.md
  },
  input: {
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    color: palette.ink900
  },
  toolsCard: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: spacing.md
  },
  toolsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: 6
  },
  toolsItem: {
    color: palette.ink700,
    marginBottom: 4
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: spacing.md,
    gap: 8
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900
  },
  meta: {
    color: palette.ink700,
    fontWeight: '600'
  },
  note: {
    color: palette.ink700
  },
  score: {
    color: palette.green500,
    fontWeight: '700'
  }
});
