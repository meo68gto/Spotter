import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { supabase } from '../../lib/supabase';
import { shortId } from './ui-utils';

type ExpertRow = {
  id: string;
  coach_id: string;
  headline: string | null;
  bio: string | null;
  is_dnd: boolean;
  discoverable: boolean;
  coaches: {
    user_id: string;
    users: Array<{
      display_name: string | null;
      home_location: string | null;
    }> | null;
  }[] | null;
};

export function ExpertsScreen({ session }: { session: Session }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [experts, setExperts] = useState<ExpertRow[]>([]);

  const load = async () => {
    setLoading(true);
    const base = supabase
      .from('expert_profiles')
      .select('id, coach_id, headline, bio, is_dnd, discoverable, coaches(user_id, users(display_name, home_location))')
      .eq('discoverable', true)
      .eq('is_dnd', false)
      .order('updated_at', { ascending: false })
      .limit(30);

    const { data, error } = query.trim()
      ? await base.ilike('headline', `%${query.trim()}%`)
      : await base;

    setLoading(false);

    if (error) {
      Alert.alert('Expert search failed', error.message);
      return;
    }

    setExperts((data ?? []) as ExpertRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Experts</Text>
      <Text style={styles.subtitle}>Find coaches for text, video, and call engagements.</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by headline"
        style={styles.input}
        autoCapitalize="none"
      />
      <Button title={loading ? 'Searching...' : 'Search'} onPress={load} disabled={loading} />

      {loading ? <ActivityIndicator style={styles.loader} /> : null}

      {experts.map((expert) => (
        <Card key={expert.id}>
          <Text style={styles.name}>{expert.coaches?.[0]?.users?.[0]?.display_name ?? `Coach ${shortId(expert.coach_id)}`}</Text>
          <Text style={styles.meta}>{expert.headline ?? 'No headline yet'}</Text>
          {expert.bio ? <Text style={styles.meta}>{expert.bio}</Text> : null}
          <Text style={styles.meta}>Coach ID: {shortId(expert.coach_id)}</Text>
        </Card>
      ))}

      {!loading && experts.length === 0 ? <Text style={styles.empty}>No experts found.</Text> : null}
      <Text style={styles.me}>Signed in: {session.user.email}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#102a43' },
  subtitle: { color: '#486581', marginTop: 4, marginBottom: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  loader: { marginTop: 16 },
  name: { fontWeight: '700', color: '#102a43', fontSize: 16 },
  meta: { color: '#486581', marginTop: 4 },
  empty: { color: '#627d98', marginTop: 12 },
  me: { color: '#9fb3c8', marginTop: 12, fontSize: 12 }
});
