import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../lib/api';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import { formatSessionStatus } from './ui-utils';

type MatchRecord = {
  id: string;
  requester_user_id: string;
  candidate_user_id: string;
  activity_id: string;
  status: string;
};

type SessionRecord = {
  id: string;
  match_id: string;
  proposer_user_id: string;
  partner_user_id: string;
  activity_id: string;
  proposed_start_time: string;
  confirmed_time: string | null;
  status: string;
};

type MessageRecord = {
  id: string;
  sender_user_id: string;
  message: string;
  created_at: string;
  client_message_id?: string | null;
};

type Props = {
  session: Session;
};

const sortMessages = (messages: MessageRecord[]) =>
  [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

function upsertById<T extends { id: string }>(prev: T[], incoming: T) {
  const exists = prev.some((item) => item.id === incoming.id);
  if (exists) {
    return prev.map((item) => (item.id === incoming.id ? { ...item, ...incoming } : item));
  }
  return [incoming, ...prev];
}

function mergeMessage(prev: MessageRecord[], incoming: MessageRecord) {
  let next = [...prev];

  if (incoming.client_message_id) {
    next = next.filter(
      (item) => !(item.id.startsWith('optimistic-') && item.client_message_id === incoming.client_message_id)
    );
  }

  const idx = next.findIndex((item) => item.id === incoming.id);
  if (idx >= 0) {
    next[idx] = { ...next[idx], ...incoming };
  } else {
    next.push(incoming);
  }

  return sortMessages(next);
}

export function SessionsScreen({ session }: Props) {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [proposedStartTime, setProposedStartTime] = useState<string>(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  );
  const [latitude, setLatitude] = useState('43.4799');
  const [longitude, setLongitude] = useState('-110.7624');
  const [messageText, setMessageText] = useState('');
  const [feedbackTag, setFeedbackTag] = useState('Great teacher');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId),
    [matches, selectedMatchId]
  );

  const selectedSession = useMemo(
    () => sessions.find((item) => item.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  const refresh = async () => {
    const userId = session.user.id;

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('id, requester_user_id, candidate_user_id, activity_id, status')
      .or(`requester_user_id.eq.${userId},candidate_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(15);

    if (matchError) {
      Alert.alert('Unable to load matches', matchError.message);
      return;
    }

    const mappedMatches = ((matchData ?? []) as MatchRecord[]).filter(
      (item) => item.status === 'pending' || item.status === 'accepted'
    );

    setMatches(mappedMatches);

    if (!selectedMatchId && mappedMatches.length) {
      setSelectedMatchId(mappedMatches[0].id);
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('id, match_id, proposer_user_id, partner_user_id, activity_id, proposed_start_time, confirmed_time, status')
      .or(`proposer_user_id.eq.${userId},partner_user_id.eq.${userId}`)
      .order('proposed_start_time', { ascending: false })
      .limit(20);

    if (sessionError) {
      Alert.alert('Unable to load sessions', sessionError.message);
      return;
    }

    const mappedSessions = (sessionData ?? []) as SessionRecord[];
    setSessions(mappedSessions);

    if (!selectedSessionId && mappedSessions.length) {
      setSelectedSessionId(mappedSessions[0].id);
    }
  };

  const loadMessages = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_user_id, message, created_at, client_message_id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      Alert.alert('Unable to load chat', error.message);
      return;
    }

    setMessages(sortMessages((data ?? []) as MessageRecord[]));
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const userId = session.user.id;

    const channel = supabase
      .channel(`session-state-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          const row = (payload.new || payload.old) as MatchRecord;
          if (!row) return;

          const isParticipant = row.requester_user_id === userId || row.candidate_user_id === userId;
          if (!isParticipant) return;

          if (payload.eventType === 'DELETE') {
            setMatches((prev) => prev.filter((item) => item.id !== row.id));
            return;
          }

          setMatches((prev) => upsertById(prev, payload.new as MatchRecord));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        (payload) => {
          const row = (payload.new || payload.old) as SessionRecord;
          if (!row) return;

          const isParticipant = row.proposer_user_id === userId || row.partner_user_id === userId;
          if (!isParticipant) return;

          if (payload.eventType === 'DELETE') {
            setSessions((prev) => prev.filter((item) => item.id !== row.id));
            return;
          }

          setSessions((prev) => upsertById(prev, payload.new as SessionRecord));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.user.id]);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }

    loadMessages(selectedSessionId);

    const channel = supabase
      .channel(`session-chat-${selectedSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${selectedSessionId}`
        },
        (payload) => {
          const incoming = payload.new as MessageRecord;
          setMessages((prev) => mergeMessage(prev, incoming));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSessionId]);

  const proposeSession = async () => {
    if (!selectedMatch) {
      Alert.alert('No match selected', 'Select a match before proposing a session.');
      return;
    }

    const partnerUserId =
      selectedMatch.requester_user_id === session.user.id
        ? selectedMatch.candidate_user_id
        : selectedMatch.requester_user_id;

    setLoading(true);

    const partnerUserId =
      selectedMatch.requester_user_id === session.user.id
        ? selectedMatch.candidate_user_id
        : selectedMatch.requester_user_id;

    let createdSession: SessionRecord;
    try {
      createdSession = await invokeFunction<SessionRecord>('sessions-propose', {
        method: 'POST',
        body: {
          matchId: selectedMatch.id,
          activityId: selectedMatch.activity_id,
          partnerUserId,
          proposedStartTime,
          latitude: Number(latitude),
          longitude: Number(longitude)
        }
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('Proposal failed', err instanceof Error ? err.message : 'Unknown error');
      return;
    }

    setLoading(false);

    setSessions((prev) => upsertById(prev, createdSession));
    setSelectedSessionId(createdSession.id);

    await trackEvent('session_proposed', session.user.id, { session_id: createdSession.id });

    Alert.alert('Session proposed', 'Your partner can now confirm this session.');
  };

  const confirmSession = async () => {
    if (!selectedSession) return;

    const confirmAt = selectedSession.proposed_start_time || proposedStartTime;
    let confirmed: SessionRecord;
    try {
      confirmed = await invokeFunction<SessionRecord>('sessions-confirm', {
        method: 'POST',
        body: {
          sessionId: selectedSession.id,
          confirmedTime: confirmAt,
          latitude: Number(latitude),
          longitude: Number(longitude)
        }
      });
    } catch (err) {
      Alert.alert('Confirm failed', err instanceof Error ? err.message : 'Unknown error');
      return;
    }

    setSessions((prev) => upsertById(prev, confirmed));
    await trackEvent('session_confirmed', session.user.id, { session_id: selectedSession.id });
  };

  const cancelSession = async () => {
    if (!selectedSession) return;

    let cancelled: SessionRecord;
    try {
      cancelled = await invokeFunction<SessionRecord>('sessions-cancel', {
        method: 'POST',
        body: { sessionId: selectedSession.id }
      });
    } catch (err) {
      Alert.alert('Cancel failed', err instanceof Error ? err.message : 'Unknown error');
      return;
    }

    setSessions((prev) => upsertById(prev, cancelled));
    await trackEvent('session_cancelled', session.user.id, { session_id: selectedSession.id });
  };

  const submitFeedback = async (thumbsUp: boolean) => {
    if (!selectedSession) return;

    try {
      await invokeFunction<{ success: boolean }>('sessions-feedback', {
        method: 'POST',
        body: {
          sessionId: selectedSession.id,
          thumbsUp,
          tag: feedbackTag.trim() || undefined
        }
      });
    } catch (err) {
      Alert.alert('Feedback failed', err instanceof Error ? err.message : 'Unknown error');
      return;
    }

    await trackEvent('session_feedback_submitted', session.user.id, {
      session_id: selectedSession.id,
      thumbs_up: thumbsUp
    });
    Alert.alert('Feedback submitted', 'Thanks for rating your buddy.');
  };

  const sendMessage = async () => {
    if (!selectedSession || !messageText.trim()) return;

    const currentMessage = messageText.trim();
    const clientMessageId = `${session.user.id}-${Date.now()}`;

    const optimistic: MessageRecord = {
      id: `optimistic-${clientMessageId}`,
      sender_user_id: session.user.id,
      message: currentMessage,
      created_at: new Date().toISOString(),
      client_message_id: clientMessageId
    };

    setMessages((prev) => mergeMessage(prev, optimistic));
    setMessageText('');

    let saved: MessageRecord;
    try {
      saved = await invokeFunction<MessageRecord>('chat-send', {
        method: 'POST',
        body: {
          sessionId: selectedSession.id,
          message: currentMessage,
          clientMessageId
        }
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert('Message failed', err instanceof Error ? err.message : 'Unknown error');
      return;
    }

    setMessages((prev) => mergeMessage(prev, saved));
    await trackEvent('chat_message_sent', session.user.id, { session_id: selectedSession.id });
  };

  const canConfirm = selectedSession?.partner_user_id === session.user.id && selectedSession.status === 'proposed';
  const canCancel =
    selectedSession &&
    (selectedSession.partner_user_id === session.user.id || selectedSession.proposer_user_id === session.user.id) &&
    selectedSession.status !== 'cancelled' &&
    selectedSession.status !== 'completed';

  return (
    <View style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Session Coordination</Text>
            <Text style={styles.subtitle}>Propose meetup sessions and coordinate in-app chat.</Text>

            <Card>
              <Text style={styles.section}>1) Select match</Text>
              {matches.length === 0 ? (
                <Text style={styles.empty}>No open matches yet. Generate matches first.</Text>
              ) : (
                <View style={styles.matchRowWrap}>
                  {matches.map((match) => {
                    const isActive = match.id === selectedMatchId;
                    return (
                      <TouchableOpacity
                        key={match.id}
                        style={[styles.chip, isActive ? styles.chipActive : null]}
                        onPress={() => setSelectedMatchId(match.id)}
                      >
                        <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                          {formatSessionStatus(match.status)} • {match.id.slice(0, 8)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.section}>2) Propose time + location</Text>
              <TextInput
                style={styles.input}
                value={proposedStartTime}
                onChangeText={setProposedStartTime}
                placeholder="ISO time"
                autoCapitalize="none"
              />
              <View style={styles.coordRow}>
                <TextInput
                  style={[styles.input, styles.coordInput]}
                  value={latitude}
                  onChangeText={setLatitude}
                  placeholder="Latitude"
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.input, styles.coordInput]}
                  value={longitude}
                  onChangeText={setLongitude}
                  placeholder="Longitude"
                  keyboardType="decimal-pad"
                />
              </View>
              <Button title={loading ? 'Proposing...' : 'Propose Session'} onPress={proposeSession} disabled={loading} />
            </Card>

            <Card>
              <Text style={styles.section}>3) Active sessions</Text>
              {sessions.length === 0 ? (
                <Text style={styles.empty}>No sessions yet.</Text>
              ) : (
                <View style={styles.matchRowWrap}>
                  {sessions.map((item) => {
                    const isActive = item.id === selectedSessionId;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.chip, isActive ? styles.chipActive : null]}
                        onPress={() => setSelectedSessionId(item.id)}
                      >
                        <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                          {formatSessionStatus(item.status)} • {item.id.slice(0, 8)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.actionRow}>
                <Button title="Refresh" onPress={refresh} />
                {canConfirm ? <Button title="Confirm" onPress={confirmSession} /> : null}
                {canCancel ? <Button title="Cancel" onPress={cancelSession} /> : null}
              </View>
            </Card>

            <Card>
              <Text style={styles.section}>4) Session chat</Text>
              {selectedSession ? (
                <>
                  <Text style={styles.sessionMeta}>Session: {selectedSession.id}</Text>
                  <Text style={styles.sessionMeta}>Status: {formatSessionStatus(selectedSession.status)}</Text>
                  <Text style={styles.sessionMeta}>
                    Proposed: {new Date(selectedSession.proposed_start_time).toLocaleString()}
                  </Text>
                  {selectedSession.confirmed_time ? (
                    <Text style={styles.sessionMeta}>
                      Confirmed: {new Date(selectedSession.confirmed_time).toLocaleString()}
                    </Text>
                  ) : null}
                  <TextInput
                    value={feedbackTag}
                    onChangeText={setFeedbackTag}
                    style={styles.input}
                    placeholder="Optional feedback tag"
                  />
                  <View style={styles.actionRow}>
                    <Button title="Thumbs Up" onPress={() => submitFeedback(true)} />
                    <Button title="Thumbs Down" onPress={() => submitFeedback(false)} />
                  </View>
                </>
              ) : (
                <Text style={styles.empty}>Select a session to open chat.</Text>
              )}
            </Card>
          </>
        }
        data={messages}
        refreshing={refreshing}
        onRefresh={async () => {
          if (refreshing) return;
          setRefreshing(true);
          await refresh();
          setRefreshing(false);
        }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const mine = item.sender_user_id === session.user.id;
          return (
            <View style={[styles.messageBubble, mine ? styles.messageMine : styles.messageTheirs]}>
              <Text style={[styles.messageText, mine ? styles.messageTextMine : null]}>{item.message}</Text>
              <Text style={[styles.messageTime, mine ? styles.messageTimeMine : null]}>
                {new Date(item.created_at).toLocaleTimeString()}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.chatComposer}>
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              style={styles.composerInput}
              placeholder="Write a message"
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
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
  input: {
    borderColor: '#d9e2ec',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff'
  },
  coordRow: {
    flexDirection: 'row',
    gap: 8
  },
  coordInput: {
    flex: 1
  },
  matchRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff'
  },
  chipActive: {
    backgroundColor: '#0b3a53',
    borderColor: '#0b3a53'
  },
  chipText: {
    color: '#334e68',
    fontWeight: '700',
    fontSize: 12
  },
  chipTextActive: {
    color: '#fff'
  },
  empty: {
    color: '#829ab1'
  },
  sessionMeta: {
    color: '#486581',
    marginBottom: 3
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#0b3a53'
  },
  messageTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec'
  },
  messageText: {
    color: '#243b53'
  },
  messageTextMine: {
    color: '#fff'
  },
  messageTime: {
    marginTop: 4,
    fontSize: 11,
    color: '#627d98'
  },
  messageTimeMine: {
    color: '#d9e2ec'
  },
  chatComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff'
  },
  sendButton: {
    marginLeft: 8,
    borderRadius: 10,
    backgroundColor: '#0b3a53',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  sendText: {
    color: '#fff',
    fontWeight: '700'
  }
});
