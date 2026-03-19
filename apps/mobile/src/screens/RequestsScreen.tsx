import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConnectionCard } from '../components/ConnectionCard';
import { supabase } from '../lib/supabase';
import { palette, radius, shadows, spacing } from '../theme/design';

type RequestType = 'connection' | 'introduction';
type RequestStatus = 'pending' | 'accepted' | 'declined';

type ConnectionRequest = {
  id: string;
  type: 'connection';
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderCompany?: string;
  senderRole?: string;
  mutualConnections: number;
  status: RequestStatus;
  createdAt: string;
};

type IntroductionRequest = {
  id: string;
  type: 'introduction';
  connectorId: string;
  connectorName: string;
  connectorAvatar?: string;
  targetId: string;
  targetName: string;
  targetAvatar?: string;
  targetCompany?: string;
  status: RequestStatus;
  createdAt: string;
};

type RequestItem = ConnectionRequest | IntroductionRequest;

interface RequestsScreenProps {
  session: Session;
}

export function RequestsScreen({ session }: RequestsScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'history'>('received');
  const [receivedRequests, setReceivedRequests] = useState<RequestItem[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [requestHistory, setRequestHistory] = useState<any[]>([]);
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      // Load received connection requests
      const { data: receivedConnections } = await supabase
        .from('connections')
        .select('*, sender:profiles!connections_user_id_fkey(id, display_name, avatar_url, company, role)')
        .eq('connected_user_id', session.user.id)
        .eq('status', 'pending');

      // Load sent connection requests
      const { data: sentConnections } = await supabase
        .from('connections')
        .select('*, recipient:profiles!connections_connected_user_id_fkey(id, display_name, avatar_url, company, role)')
        .eq('user_id', session.user.id)
        .eq('status', 'pending');

      // Load connection history
      const { data: historyConnections } = await supabase
        .from('connections')
        .select('*, sender:profiles!connections_user_id_fkey(id, display_name, avatar_url, company, role)')
        .or(`user_id.eq.${session.user.id},connected_user_id.eq.${session.user.id}`)
        .in('status', ['accepted', 'declined'])
        .order('updated_at', { ascending: false })
        .limit(20);

      // Load introduction requests (simplified - would need proper table)
      const { data: introsData } = await supabase
        .from('connection_intros')
        .select('*, connector:profiles!connection_intros_connector_id_fkey(display_name, avatar_url)')
        .or(`target_user_id.eq.${session.user.id},introduced_user_id.eq.${session.user.id}`)
        .eq('status', 'pending');

      // Format received requests
      const formattedReceived: RequestItem[] = [
        ...(receivedConnections || []).map((c: any) => ({
          id: c.id,
          type: 'connection' as const,
          senderId: c.sender?.id,
          senderName: c.sender?.display_name || 'Unknown',
          senderAvatar: c.sender?.avatar_url,
          senderCompany: c.sender?.company,
          senderRole: c.sender?.role,
          mutualConnections: 0, // Would calculate from mutual connections
          status: c.status,
          createdAt: c.created_at,
        })),
        ...(introsData || []).map((i: any) => ({
          id: i.id,
          type: 'introduction' as const,
          connectorId: i.connector_id,
          connectorName: i.connector?.display_name || 'Unknown',
          connectorAvatar: i.connector?.avatar_url,
          targetId: i.target_user_id,
          targetName: i.target_name || 'Unknown',
          targetAvatar: i.target_avatar,
          targetCompany: i.target_company,
          status: i.status,
          createdAt: i.created_at,
        })),
      ];

      setReceivedRequests(formattedReceived);
      setSentRequests(sentConnections || []);
      setRequestHistory(historyConnections || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  }, [session.user.id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleAccept = async (requestId: string) => {
    setActingOnId(requestId);
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      await loadRequests();
      Alert.alert('Success', 'Connection request accepted!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept request');
    } finally {
      setActingOnId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setActingOnId(requestId);
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      await loadRequests();
    } catch (error) {
      Alert.alert('Error', 'Failed to decline request');
    } finally {
      setActingOnId(null);
    }
  };

  const renderConnectionCard = (request: ConnectionRequest) => (
    <ConnectionCard
      key={request.id}
      id={request.id}
      name={request.senderName}
      avatarUrl={request.senderAvatar}
      company={request.senderCompany}
      role={request.senderRole}
      mutualConnections={request.mutualConnections}
      onAccept={() => handleAccept(request.id)}
      onDecline={() => handleDecline(request.id)}
      loading={actingOnId === request.id}
    />
  );

  const renderIntroductionCard = (request: IntroductionRequest) => (
    <Card key={request.id}>
      <View style={styles.introCard}>
        <Text style={styles.introTitle}>Introduction Request</Text>
        <Text style={styles.introText}>
          {request.connectorName} wants to introduce you to {request.targetName}
          {request.targetCompany ? ` from ${request.targetCompany}` : ''}
        </Text>

        <View style={styles.introPeople}>
          <View style={styles.person}>
            {request.connectorAvatar ? (
              <Image source={{ uri: request.connectorAvatar }} style={styles.personAvatar} />
            ) : (
              <View style={styles.personAvatarPlaceholder}>
                <Text style={styles.personInitial}>{request.connectorName.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.personName}>{request.connectorName}</Text>
            <Text style={styles.personRole}>Connector</Text>
          </View>

          <Text style={styles.arrow}>→</Text>

          <View style={styles.person}>
            {request.targetAvatar ? (
              <Image source={{ uri: request.targetAvatar }} style={styles.personAvatar} />
            ) : (
              <View style={styles.personAvatarPlaceholder}>
                <Text style={styles.personInitial}>{request.targetName.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.personName}>{request.targetName}</Text>
            <Text style={styles.personRole}>{request.targetCompany || 'Connection'}</Text>
          </View>
        </View>

        <View style={styles.introActions}>
          <Button
            title="Accept Intro"
            onPress={() => handleAccept(request.id)}
            disabled={actingOnId === request.id}
          />
          <Button
            title="Decline"
            onPress={() => handleDecline(request.id)}
            disabled={actingOnId === request.id}
            tone="secondary"
          />
        </View>
      </View>
    </Card>
  );

  const renderReceived = () => (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Connection Requests</Text>
      <Text style={styles.subtitle}>People who want to connect with you</Text>

      {receivedRequests.length > 0 ? (
        receivedRequests.map((request) =>
          request.type === 'connection'
            ? renderConnectionCard(request as ConnectionRequest)
            : renderIntroductionCard(request as IntroductionRequest)
        )
      ) : (
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>No pending requests</Text>
            <Text style={styles.emptyText}>
              When someone sends you a connection request, it will appear here
            </Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );

  const renderSent = () => (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Sent Requests</Text>
      <Text style={styles.subtitle}>Connections you've requested</Text>

      {sentRequests.length > 0 ? (
        sentRequests.map((request: any) => (
          <Card key={request.id}>
            <View style={styles.sentCard}>
              <View style={styles.sentHeader}>
                {request.recipient?.avatar_url ? (
                  <Image source={{ uri: request.recipient.avatar_url }} style={styles.sentAvatar} />
                ) : (
                  <View style={styles.sentAvatarPlaceholder}>
                    <Text style={styles.sentInitial}>{request.recipient?.display_name?.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.sentInfo}>
                  <Text style={styles.sentName}>{request.recipient?.display_name || 'Unknown'}</Text>
                  <Text style={styles.sentCompany}>{request.recipient?.company || 'No company listed'}</Text>
                </View>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>Pending</Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📤</Text>
            <Text style={styles.emptyTitle}>No sent requests</Text>
            <Text style={styles.emptyText}>
              Browse the Discover section to find people to connect with
            </Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );

  const renderHistory = () => (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Request History</Text>
      <Text style={styles.subtitle}>Past connection activity</Text>

      {requestHistory.length > 0 ? (
        requestHistory.map((request: any) => (
          <Card key={request.id}>
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                {request.sender?.avatar_url ? (
                  <Image source={{ uri: request.sender.avatar_url }} style={styles.historyAvatar} />
                ) : (
                  <View style={styles.historyAvatarPlaceholder}>
                    <Text style={styles.historyInitial}>{request.sender?.display_name?.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName}>{request.sender?.display_name || 'Unknown'}</Text>
                  <Text style={styles.historyCompany}>{request.sender?.company || 'No company listed'}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.historyStatus,
                  {
                    backgroundColor:
                      request.status === 'accepted' ? '#D1FAE5' : '#FEE2E2',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.historyStatusText,
                    {
                      color: request.status === 'accepted' ? '#065F46' : '#991B1B',
                    },
                  ]}
                >
                  {request.status === 'accepted' ? '✓ Connected' : '✕ Declined'}
                </Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📜</Text>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptyText}>Your connection history will appear here</Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'received', label: 'Received', count: receivedRequests.length },
          { key: 'sent', label: 'Sent', count: sentRequests.length },
          { key: 'history', label: 'History', count: null },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tab.count}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'received' && renderReceived()}
      {activeTab === 'sent' && renderSent()}
      {activeTab === 'history' && renderHistory()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: palette.navy600,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink500,
  },
  activeTabText: {
    color: palette.navy600,
  },
  badge: {
    backgroundColor: palette.red500,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink500,
    marginBottom: spacing.lg,
  },
  introCard: {
    gap: spacing.md,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink900,
  },
  introText: {
    fontSize: 14,
    color: palette.ink700,
  },
  introPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  person: {
    alignItems: 'center',
  },
  personAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
  personAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  personInitial: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '800',
  },
  personName: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
  },
  personRole: {
    fontSize: 12,
    color: palette.ink500,
  },
  arrow: {
    fontSize: 24,
    color: palette.ink500,
  },
  introActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  sentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  sentAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
  },
  sentAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentInitial: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '800',
  },
  sentInfo: {
    flex: 1,
  },
  sentName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  sentCompany: {
    fontSize: 13,
    color: palette.ink500,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  historyAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
  },
  historyAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInitial: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '800',
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  historyCompany: {
    fontSize: 13,
    color: palette.ink500,
    marginTop: 2,
  },
  historyStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
  },
});
