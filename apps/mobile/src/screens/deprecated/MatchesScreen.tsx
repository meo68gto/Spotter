import { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { trackEvent } from '../../lib/analytics';
import { flags } from '../../lib/flags';
import { supabase } from '../../lib/supabase';
import { env } from '../../types/env';

type Candidate = {
  candidate_user_id: string;
  activity_id: string;
  skill_band: string;
  distance_km: number;
  skill_delta: number;
  availability_overlap_minutes: number;
  reasons: string[];
  match_score?: number;
};

type FeedbackSummary = {
  userId: string;
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  positiveRatio: number;
  topTags: string[];
};

type MatchRecord = {
  id: string;
  requester_user_id: string;
  candidate_user_id: string;
  activity_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string | null;
};

export function MatchesScreen({ session }: { session: Session }) {
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [requestingId, setRequestingId] = useState<string>('');
  const [actingMatchId, setActingMatchId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [feedbackByUserId, setFeedbackByUserId] = useState<Record<string, FeedbackSummary>>({});

  const incomingPending = useMemo(
    () => matches.filter((match) => match.status === 'pending' && match.candidate_user_id === session.user.id),
    [matches, session.user.id]
  );

  const outgoingPending = useMemo(
    () => matches.filter((match) => match.status === 'pending' && match.requester_user_id === session.user.id),
    [matches, session.user.id]
  );

  const acceptedMatches = useMemo(() => matches.filter((match) => match.status === 'accepted'), [matches]);

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token;

  const loadMatches = async () => {
    setLoadingMatches(true);
    const { data, error } = await supabase
      .from('matches')
      .select('id, requester_user_id, candidate_user_id, activity_id, status, expires_at')
      .or(`requester_user_id.eq.${session.user.id},candidate_user_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false })
      .limit(30);

    setLoadingMatches(false);

    if (error) {
      Alert.alert('Unable to load matches', error.message);
      return;
    }

    setMatches((data ?? []) as MatchRecord[]);
  };

  const loadCandidates = async () => {
    setLoadingCandidates(true);
    const { data: profile, error: profileError } = await supabase
      .from('skill_profiles')
      .select('activity_id, skill_band')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profileError || !profile) {
      setLoadingCandidates(false);
      setCandidates([]);
      return;
    }

    const token = await getToken();
    if (!token) {
      setLoadingCandidates(false);
      return;
    }

    const response = await fetch(`${env.apiBaseUrl}/functions/v1/matching-candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        activityId: profile.activity_id,
        radiusKm: flags.matchingV2 ? 35 : 25,
        skillBand: profile.skill_band,
        limit: 5
      })
    });

    const payload = await response.json();
    setLoadingCandidates(false);

    if (!response.ok) {
      Alert.alert('Unable to fetch matches', payload.error ?? 'Unknown error');
      return;
    }

    const nextCandidates = (payload.data ?? []) as Candidate[];
    setCandidates(nextCandidates);
    await loadCandidateFeedback(nextCandidates);
  };

  const loadCandidateFeedback = async (targetCandidates: Candidate[]) => {
    const token = await getToken();
    if (!token || targetCandidates.length === 0) {
      setFeedbackByUserId({});
      return;
    }

    const userIds = Array.from(new Set(targetCandidates.map((candidate) => candidate.candidate_user_id)));

    const response = await fetch(`${env.apiBaseUrl}/functions/v1/profiles-feedback-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ userIds })
    });
    const payload = await response.json();
    if (!response.ok) return;

    const mapped: Record<string, FeedbackSummary> = {};
    for (const item of payload.data ?? []) {
      mapped[item.userId] = item as FeedbackSummary;
    }
    setFeedbackByUserId(mapped);
  };

  const refreshAll = async () => {
    await Promise.all([loadMatches(), loadCandidates()]);
  };

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const requestMatch = async (candidate: Candidate) => {
    const token = await getToken();
    if (!token) {
      Alert.alert('Session missing', 'Please sign in again.');
      return;
    }

    setRequestingId(candidate.candidate_user_id);
    const response = await fetch(`${env.apiBaseUrl}/functions/v1/matching-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        candidateUserId: candidate.candidate_user_id,
        activityId: candidate.activity_id
      })
    });
    const payload = await response.json();
    setRequestingId('');

    if (!response.ok) {
      Alert.alert('Match request failed', payload.error ?? 'Unknown error');
      return;
    }

    await trackEvent('match_request_created', session.user.id, {
      candidate_user_id: candidate.candidate_user_id,
      activity_id: candidate.activity_id
    });

    Alert.alert('Request sent', 'Your match request was created.');
    await loadMatches();
  };

  const runMatchAction = async (endpoint: 'matching-accept' | 'matching-reject', matchId: string) => {
    const token = await getToken();
    if (!token) {
      Alert.alert('Session missing', 'Please sign in again.');
      return;
    }

    setActingMatchId(matchId);
    const response = await fetch(`${env.apiBaseUrl}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ matchId })
    });

    const payload = await response.json();
    setActingMatchId('');

    if (!response.ok) {
      Alert.alert('Match action failed', payload.error ?? 'Unknown error');
      return;
    }

    await trackEvent('match_action', session.user.id, { match_id: matchId, action: endpoint });
    await loadMatches();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Matches</Text>
      <Text style={styles.subtitle}>Quality-first suggestions and pending match lifecycle.</Text>

      <Button title="Refresh" onPress={refreshAll} disabled={loadingCandidates || loadingMatches} />

      <Card>
        <Text style={styles.section}>Incoming requests</Text>
        {loadingMatches ? <ActivityIndicator /> : null}
        {!loadingMatches && incomingPending.length === 0 ? <Text style={styles.empty}>No incoming requests.</Text> : null}
        {incomingPending.map((match) => (
          <View key={match.id} style={styles.rowBlock}>
            <Text style={styles.name}>Request {match.id.slice(0, 8)}</Text>
            <Text style={styles.meta}>From user {match.requester_user_id.slice(0, 8)}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                disabled={actingMatchId === match.id}
                onPress={() => runMatchAction('matching-accept', match.id)}
              >
                <Text style={styles.primaryText}>{actingMatchId === match.id ? '...' : 'Accept'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                disabled={actingMatchId === match.id}
                onPress={() => runMatchAction('matching-reject', match.id)}
              >
                <Text style={styles.secondaryText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.section}>Outgoing requests</Text>
        {!loadingMatches && outgoingPending.length === 0 ? <Text style={styles.empty}>No outgoing pending requests.</Text> : null}
        {outgoingPending.map((match) => (
          <View key={match.id} style={styles.rowBlock}>
            <Text style={styles.name}>Request {match.id.slice(0, 8)}</Text>
            <Text style={styles.meta}>To user {match.candidate_user_id.slice(0, 8)}</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              disabled={actingMatchId === match.id}
              onPress={() => runMatchAction('matching-reject', match.id)}
            >
              <Text style={styles.secondaryText}>{actingMatchId === match.id ? '...' : 'Withdraw'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.section}>Accepted</Text>
        {!loadingMatches && acceptedMatches.length === 0 ? <Text style={styles.empty}>No accepted matches yet.</Text> : null}
        {acceptedMatches.map((match) => (
          <View key={match.id} style={styles.rowBlock}>
            <Text style={styles.name}>Match {match.id.slice(0, 8)}</Text>
            <Text style={styles.meta}>Activity {match.activity_id.slice(0, 8)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.section}>Top candidates</Text>
        {loadingCandidates ? <ActivityIndicator /> : null}
        {!loadingCandidates && candidates.length === 0 ? <Text style={styles.empty}>No candidates yet.</Text> : null}

        {candidates.map((candidate) => (
          <View key={candidate.candidate_user_id} style={styles.rowBlock}>
            <Text style={styles.name}>User {candidate.candidate_user_id.slice(0, 8)}</Text>
            <Text style={styles.meta}>
              {candidate.skill_band} • {candidate.distance_km.toFixed(1)} km • overlap {candidate.availability_overlap_minutes}m
            </Text>
            {candidate.match_score !== undefined ? (
              <Text style={styles.score}>Score: {candidate.match_score.toFixed(2)}</Text>
            ) : null}
            {feedbackByUserId[candidate.candidate_user_id] ? (
              <>
                <Text style={styles.feedbackLine}>
                  Buddy rating: {feedbackByUserId[candidate.candidate_user_id].positiveRatio.toFixed(1)}% positive (
                  {feedbackByUserId[candidate.candidate_user_id].totalFeedback} reviews)
                </Text>
                {feedbackByUserId[candidate.candidate_user_id].topTags.length > 0 ? (
                  <Text style={styles.feedbackTags}>
                    Top tags: {feedbackByUserId[candidate.candidate_user_id].topTags.join(' • ')}
                  </Text>
                ) : null}
              </>
            ) : null}
            <Text style={styles.reasonText}>{(candidate.reasons ?? []).join(' • ')}</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => requestMatch(candidate)}
              disabled={requestingId === candidate.candidate_user_id}
            >
              <Text style={styles.primaryText}>
                {requestingId === candidate.candidate_user_id ? 'Requesting...' : 'Request Match'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f9fc'
  },
  content: {
    padding: 16,
    paddingBottom: 28
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
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334e68',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  empty: {
    color: '#829ab1'
  },
  rowBlock: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e7eb',
    paddingBottom: 10
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102a43'
  },
  meta: {
    color: '#486581',
    marginTop: 4,
    marginBottom: 8
  },
  score: {
    color: '#1f5f8b',
    fontWeight: '700',
    marginBottom: 6
  },
  reasonText: {
    color: '#627d98',
    marginBottom: 10
  },
  feedbackLine: {
    color: '#1f5f8b',
    fontWeight: '700',
    marginBottom: 4
  },
  feedbackTags: {
    color: '#486581',
    marginBottom: 6
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#0b3a53',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700'
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#e4e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  secondaryText: {
    color: '#243b53',
    fontWeight: '700'
  }
});
