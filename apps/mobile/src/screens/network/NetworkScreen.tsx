import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { NetworkConnection, NetworkStats, RelationshipState, getRelationshipStateLabel } from '@spotter/types';
import { ConnectionCard } from '../../components/ConnectionCard';
import { LoadingScreen } from '../../components/LoadingScreen';
import { palette, radius, spacing } from '../../theme/design';
import { supabase } from '../../lib/supabase';

interface NetworkScreenProps {
  session: Session;
  onNavigateToSavedMembers?: () => void;
  onNavigateToProfile?: (userId: string) => void;
  onNavigateToDiscovery?: () => void;
}

export function NetworkScreen({ session, onNavigateToSavedMembers, onNavigateToProfile, onNavigateToDiscovery }: NetworkScreenProps) {
  const user = session.user;

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert(type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info', message);
    }
  }, []);
  
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'accepted' | 'pending' | 'saved'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchConnections = useCallback(async (isRefresh = false) => {
    if (!user) return;

    try {
      const currentPage = isRefresh ? 1 : page;
      const params = new URLSearchParams({
        filter: filter === 'saved' ? 'accepted' : filter,
        saved: filter === 'saved' ? 'true' : 'false',
        page: currentPage.toString(),
        limit: '20',
        stats: 'true',
      });

      const { data, error } = await supabase.functions.invoke(
        'network-connections',
        { method: 'GET', query: Object.fromEntries(params) }
      );

      if (error) throw error;

      if (isRefresh) {
        setConnections(data.data || []);
        setPage(2);
      } else {
        setConnections(prev => [...prev, ...(data.data || [])]);
        setPage(prev => prev + 1);
      }

      setHasMore((data.data || []).length === 20);
      
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
      showToast('Failed to load connections', 'error');
    }
  }, [user, filter, page, showToast]);

  const loadInitialData = async () => {
    setLoading(true);
    await fetchConnections(true);
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, [filter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConnections(true);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchConnections();
    }
  };

  const handleAccept = async (connectionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('connections-request', {
        body: { action: 'respond', connectionId, response: 'accept' },
      });

      if (error) throw error;

      showToast('Connection accepted', 'success');
      handleRefresh();
    } catch (error) {
      showToast('Failed to accept connection', 'error');
    }
  };

  const handleDecline = async (connectionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('connections-request', {
        body: { action: 'respond', connectionId, response: 'decline' },
      });

      if (error) throw error;

      showToast('Connection declined', 'info');
      handleRefresh();
    } catch (error) {
      showToast('Failed to decline connection', 'error');
    }
  };

  const handleSave = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('network-save-member', {
        body: { action: 'save', userId },
      });

      if (error) throw error;

      showToast('Member saved', 'success');
      handleRefresh();
    } catch (error) {
      showToast('Failed to save member', 'error');
    }
  };

  const handleUnsave = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('network-save-member', {
        query: { userId },
        method: 'DELETE',
      });

      if (error) throw error;

      showToast('Member unsaved', 'info');
      handleRefresh();
    } catch (error) {
      showToast('Failed to unsave member', 'error');
    }
  };

  const getOtherUserId = (connection: NetworkConnection) => {
    return connection.userId === user?.id 
      ? connection.connectedUserId 
      : connection.userId;
  };

  // Calculate network breakdown by relationship state
  const networkBreakdown = useMemo(() => {
    const breakdown: Record<RelationshipState, number> = {
      matched: 0,
      invited: 0,
      played_together: 0,
      regular_partner: 0,
    };
    
    connections.forEach(conn => {
      if (conn.status === 'accepted') {
        breakdown[conn.relationshipState]++;
      }
    });
    
    return breakdown;
  }, [connections]);

  if (loading && connections.length === 0) {
    return <LoadingScreen message="Loading your network..." />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Network</Text>
        
        <TouchableOpacity 
          style={styles.savedButton}
          onPress={() => onNavigateToSavedMembers?.()}
        >
          <Text style={styles.savedButtonText}>★ Saved ({stats?.savedConnections || 0})</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      {stats && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.statsContainer}
          contentContainerStyle={styles.statsContent}
        >
          <StatCard 
            label="Connections" 
            value={stats.totalConnections} 
            icon="👥"
            color={palette.navy600}
          />
          <StatCard 
            label="Regular Partners" 
            value={stats.regularPartners} 
            icon="🏌️"
            color={palette.green500}
          />
          <StatCard 
            label="Avg Strength" 
            value={`${stats.avgStrengthScore}%`} 
            icon="💪"
            color={palette.amber500}
          />
          <StatCard 
            label="Pending Intros" 
            value={stats.pendingIntroductions} 
            icon="🤝"
            color={palette.blue500}
          />
        </ScrollView>
      )}

      {/* Network Breakdown */}
      {connections.length > 0 && (
        <View style={styles.breakdownContainer}>
          <Text style={styles.breakdownTitle}>Network Breakdown</Text>
          <View style={styles.breakdownRow}>
            {Object.entries(networkBreakdown).map(([state, count]) => (
              count > 0 && (
                <View key={state} style={styles.breakdownItem}>
                  <View style={[styles.breakdownDot, { backgroundColor: getStateColor(state as RelationshipState) }]} />
                  <Text style={styles.breakdownLabel}>{getRelationshipStateLabel(state as RelationshipState)}</Text>
                  <Text style={styles.breakdownCount}>{count}</Text>
                </View>
              )
            ))}
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTab 
          label="All" 
          count={connections.length}
          active={filter === 'all'} 
          onPress={() => setFilter('all')} 
        />
        <FilterTab 
          label="Connections" 
          count={connections.filter(c => c.status === 'accepted').length}
          active={filter === 'accepted'} 
          onPress={() => setFilter('accepted')} 
        />
        <FilterTab 
          label="Pending" 
          count={connections.filter(c => c.status === 'pending_sent' || c.status === 'pending_received').length}
          active={filter === 'pending'} 
          onPress={() => setFilter('pending')} 
        />
        <FilterTab 
          label="Saved" 
          count={connections.filter(c => c.isSavedByMe).length}
          active={filter === 'saved'} 
          onPress={() => setFilter('saved')} 
        />
      </View>

      {/* Connections List */}
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConnectionCard
            id={item.id}
            displayName={item.member.displayName}
            avatarUrl={item.member.avatarUrl}
            tier={item.member.tier}
            professional={item.member.professional}
            golf={item.member.golf}
            relationshipState={item.relationshipState}
            strengthScore={item.strengthScore}
            roundsCount={item.roundsCount}
            lastInteractionAt={item.lastInteractionAt}
            isSavedByMe={item.isSavedByMe}
            isPending={item.status === 'pending_sent' || item.status === 'pending_received'}
            isIncoming={item.status === 'pending_received'}
            onPress={() => onNavigateToProfile?.(getOtherUserId(item))}
            onAccept={() => handleAccept(item.id)}
            onDecline={() => handleDecline(item.id)}
            onSave={() => handleSave(getOtherUserId(item))}
            onUnsave={() => handleUnsave(getOtherUserId(item))}
          />
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>🌐</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'saved' 
                ? 'No saved members yet'
                : 'Your network is empty'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'saved' 
                ? 'Save members to organize your network and prioritize your connections'
                : 'Discover and connect with other golfers in your tier. Build your private network through warm introductions and shared rounds.'}
            </Text>
            {filter !== 'saved' && (
              <TouchableOpacity 
                style={styles.emptyAction}
                onPress={() => onNavigateToDiscovery?.()}
              >
                <Text style={styles.emptyActionText}>Discover Members →</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}

function StatCard({ label, value, icon, color = palette.navy600 }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface FilterTabProps {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}

function FilterTab({ label, count, active, onPress }: FilterTabProps) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, active && styles.activeFilterTab]}
      onPress={onPress}
    >
      <Text style={[styles.filterText, active && styles.activeFilterText]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.countBadge, active && styles.activeCountBadge]}>
          <Text style={[styles.countText, active && styles.activeCountText]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function getStateColor(state: RelationshipState): string {
  switch (state) {
    case 'regular_partner':
      return '#22c55e'; // green-500
    case 'played_together':
      return '#3b82f6'; // blue-500
    case 'invited':
      return '#f59e0b'; // amber-500
    case 'matched':
      return '#6b7280'; // gray-500
    default:
      return '#6b7280';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.ink50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.ink100,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
  },
  savedButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.navy100,
    borderRadius: radius.lg,
  },
  savedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy700,
  },
  statsContainer: {
    backgroundColor: palette.white,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.ink100,
  },
  statsContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  statCard: {
    backgroundColor: palette.navy50,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    minWidth: 90,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink900,
  },
  statLabel: {
    fontSize: 12,
    color: palette.ink600,
    marginTop: 2,
  },
  breakdownContainer: {
    backgroundColor: palette.white,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.ink100,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
    marginBottom: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.ink50,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  breakdownLabel: {
    fontSize: 12,
    color: palette.ink600,
  },
  breakdownCount: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.ink900,
    marginLeft: spacing.xs,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.ink100,
    gap: spacing.sm,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.ink100,
  },
  activeFilterTab: {
    backgroundColor: palette.navy600,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink600,
  },
  activeFilterText: {
    color: palette.white,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: palette.ink300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeCountBadge: {
    backgroundColor: palette.navy400,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.ink700,
  },
  activeCountText: {
    color: palette.white,
  },
  listContent: {
    padding: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: palette.navy100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink800,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  emptyAction: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: palette.navy600,
    borderRadius: radius.lg,
  },
  emptyActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.white,
  },
});