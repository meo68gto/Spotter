import { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SavedMember, SavedMemberTier } from '@spotter/types';
import { SavedMemberCard } from '../components/SavedMemberCard';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { palette, radius, spacing } from '../theme/design';
import { supabase } from '../lib/supabase';

type RootStackParamList = {
  SavedMembers: undefined;
  Profile: { userId: string };
};

export function SavedMembersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [savedMembers, setSavedMembers] = useState<SavedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SavesMemberTier | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchSavedMembers = useCallback(async (isRefresh = false) => {
    if (!user) return;

    try {
      const currentPage = isRefresh ? 1 : page;
      const params: Record<string, string> = {
        page: currentPage.toString(),
        limit: '20',
      };

      if (filter !== 'all') {
        params.tier = filter;
      }

      const { data, error } = await supabase.functions.invoke(
        'network-save-member',
        { method: 'GET', query: params }
      );

      if (error) throw error;

      if (isRefresh) {
        setSavedMembers(data.data || []);
        setPage(2);
      } else {
        setSavedMembers(prev => [...prev, ...(data.data || [])]);
        setPage(prev => prev + 1);
      }

      setHasMore((data.data || []).length === 20);
    } catch (error) {
      console.error('Failed to fetch saved members:', error);
      showToast({
        type: 'error',
        title: 'Failed to load saved members',
      });
    }
  }, [user, filter, page, showToast]);

  const loadInitialData = async () => {
    setLoading(true);
    await fetchSavedMembers(true);
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, [filter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSavedMembers(true);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchSavedMembers();
    }
  };

  const handleUpdateTier = async (userId: string, tier: SavedMemberTier) => {
    try {
      const { error } = await supabase.functions.invoke('network-save-member', {
        method: 'PATCH',
        body: { action: 'update', userId, tier },
      });

      if (error) throw error;

      showToast({ type: 'success', title: 'Member updated' });
      handleRefresh();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to update member',
      });
    }
  };

  const handleUnsave = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('network-save-member', {
        method: 'DELETE',
        query: { userId },
      });

      if (error) throw error;

      showToast({ type: 'info', title: 'Member removed' });
      handleRefresh();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to remove member',
      });
    }
  };

  const filteredMembers = savedMembers.filter(member => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.member.displayName.toLowerCase().includes(query) ||
      member.tags.some(tag => tag.toLowerCase().includes(query)) ||
      member.notes?.toLowerCase().includes(query)
    );
  });

  if (loading && savedMembers.length === 0) {
    return <LoadingScreen message="Loading saved members..." />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Saved Members</Text>
        <Text style={styles.subtitle}>{savedMembers.length} saved</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, tag, or notes..."
          placeholderTextColor={palette.ink400}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTab 
          label="All" 
          active={filter === 'all'} 
          onPress={() => setFilter('all')} 
        />
        <FilterTab 
          label="Favorites" 
          active={filter === 'favorite'} 
          onPress={() => setFilter('favorite')} 
        />
        <FilterTab 
          label="Standard" 
          active={filter === 'standard'} 
          onPress={() => setFilter('standard')} 
        />
        <FilterTab 
          label="Archived" 
          active={filter === 'archived'} 
          onPress={() => setFilter('archived')} 
        />
      </View>

      {/* Saved Members List */}
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SavedMemberCard
            id={item.id}
            displayName={item.member.displayName}
            avatarUrl={item.member.avatarUrl}
            tier={item.member.tier}
            savedTier={item.tier}
            notes={item.notes}
            tags={item.tags}
            professional={item.member.professional}
            golf={item.member.golf}
            onPress={() => navigation.navigate('Profile', { userId: item.savedId })}
            onEdit={() => handleUpdateTier(item.savedId, 
              item.tier === 'favorite' ? 'standard' : 'favorite'
            )}
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
            <Text style={styles.emptyTitle}>No saved members</Text>
            <Text style={styles.emptyText}>
              Save members from your network to organize and prioritize your connections
            </Text>
          </View>
        }
      />
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
  subtitle: {
    fontSize: 14,
    color: palette.ink500,
  },
  searchContainer: {
    padding: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.ink100,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: palette.ink300,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    color: palette.ink900,
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