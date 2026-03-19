import { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NetworkConnection, NetworkStats, RelationshipState } from '@spotter/types';
import { ConnectionCard } from '../components/ConnectionCard';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { palette, radius, spacing } from '../theme/design';
import { supabase } from '../lib/supabase';

type RootStackParamList = {
  Network: undefined;
  SavedMembers: undefined;
  Profile: { userId: string };
};

export function NetworkScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { showToast } = useToast();
  
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
      showToast({
        type: 'error',
        title: 'Failed to load connections',
      });
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

      showToast({ type: 'success', title: 'Connection accepted' });
      handleRefresh();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to accept connection',
      });
    }
  };

  const handleDecline = async (connectionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('connections-request', {
        body: { action: 'respond', connectionId, response: 'decline' },
      });

      if (error) throw error;

      showToast({ type: 'info', title: 'Connection declined' });
      handleRefresh();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to decline connection',
      });
    }
  };

  const handleSave = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('network-save-member', {
        body: { action: 'save', userId },
      });

      if (error) throw error;

      showToast({ type: 'success', title: 'Member saved' });
      handleRefresh();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to save member',
      });
    }
  };

  const handleUnsave = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('network-save-member', {
        query: { userId },
        method: 'DELETE',
      });

      if (error) throw error;

      showToast({ type: 'info', title: 'Member unsaved' });
      handleRefresh();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to unsave member',
      });
    }
  };

  const getOtherUserId = (connection: NetworkConnection) => {
    return connection.userId === user?.id 
      ? connection.connectedUserId 
      : connection.userId;
  };

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
          onPress={() => navigation.navigate('SavedMembers')}
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
          />
          <StatCard 
            label="Regular Partners" 
            value={stats.regularPartners} 
            icon="🏌️"
          />
          <StatCard 
            label="Avg Strength" 
            value={`${stats.avgStrengthScore}%`} 
            icon="💪"
          />
          <StatCard 
            label="Pending Intros" 
            value={stats.pendingIntroductions} 
            icon="🤝"
          />
        </ScrollView>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTab 
          label="All" 
          active={filter === 'all'} 
          onPress={() => setFilter('all')} 
        />
        <FilterTab 
          label="Connections" 
          active={filter === 'accepted'} 
          onPress={() => setFilter('accepted')} 
        />
        <FilterTab 
          label="Pending" 
          active={filter === 'pending'} 
          onPress={() => setFilter('pending')} 
        />
        <FilterTab 
          label="Saved" 
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
            onPress={() => navigation.navigate('Profile', { userId: getOtherUserId(item) })}
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
            <Text style={styles.emptyTitle}>No connections yet</Text>
            <Text style={styles.emptyText}>
              {filter === 'saved' 
                ? 'Save members to organize your network'
                : 'Discover and connect with other golfers in your tier'}
            </Text>
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
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface FilterTabProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function FilterTab({ label, active, onPress }: FilterTabProps) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, active && styles.activeFilterTab]}
      onPress={onPress}
    >
      <Text style={[styles.filterText, active && styles.activeFilterText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
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
    minWidth: 80,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
  },
  statLabel: {
    fontSize: 12,
    color: palette.ink600,
    marginTop: 2,
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
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.ink100,
    alignItems: 'center',
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
  listContent: {
    padding: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink700,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
  },
});