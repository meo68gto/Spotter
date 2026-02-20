import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { env } from '../../types/env';
import { supabase } from '../../lib/supabase';

type Props = {
  session: Session;
  email: string;
  onSignOut: () => void;
};

type FeedbackSummary = {
  userId: string;
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  positiveRatio: number;
  topTags: string[];
};

export function ProfileScreen({ session, email, onSignOut }: Props) {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${env.apiBaseUrl}/functions/v1/profiles-feedback-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userIds: [session.user.id] })
      });
      const payload = await response.json();
      if (response.ok) {
        setFeedback((payload.data?.[0] as FeedbackSummary | undefined) ?? null);
      }
      setLoading(false);
    };
    load();
  }, [session.user.id]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Identity layer for your activity passport.</Text>

      <Card>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{email}</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Privacy promise</Text>
        <Text style={styles.value}>Location encrypted at rest and never sold.</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Buddy rating</Text>
        {loading ? (
          <ActivityIndicator />
        ) : feedback ? (
          <>
            <Text style={styles.value}>
              {feedback.positiveRatio.toFixed(1)}% positive ({feedback.totalFeedback} reviews)
            </Text>
            <Text style={styles.subValue}>
              👍 {feedback.thumbsUpCount} • 👎 {feedback.thumbsDownCount}
            </Text>
            {feedback.topTags.length > 0 ? <Text style={styles.subValue}>Top tags: {feedback.topTags.join(' • ')}</Text> : null}
          </>
        ) : (
          <Text style={styles.value}>No ratings yet.</Text>
        )}
      </Card>

      <Button title="Sign out" onPress={onSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f9fc',
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#102a43'
  },
  subtitle: {
    color: '#627d98',
    marginBottom: 14
  },
  label: {
    fontSize: 12,
    color: '#627d98',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#102a43',
    marginTop: 4
  },
  subValue: {
    marginTop: 6,
    color: '#486581'
  }
});
