import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { SavedMember, SavedMemberTier } from '@spotter/types';
import { SavedMemberCard } from '../../components/SavedMemberCard';
import { LoadingScreen } from '../../components/LoadingScreen';
import { palette, radius, spacing } from '../theme/design';
import { supabase } from '../../lib/supabase';

type SortOption = 'name' | 'dateSaved' | 'tier';
type SortDirection = 'asc' | 'desc';

interface SavedMembersScreenProps {
  onNavigateToProfile?: (userId: string) => void;
  onNavigateToNetwork?: () => void;
  onBack?: () => void;
}

export function SavedMembersScreen({ onNavigateToProfile, onNavigateToNetwork, onBack }: SavedMembersScreenProps) {
  const [savedMembers, setSavedMembers] = useState<SavedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SavedMemberTier | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('dateSaved');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Fallback for removed useAuth hook — screen requires auth context provider
  const user = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showToast = (_payload: any) => {};

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

  // Memoized filtering and sorting
  const processedMembers = useMemo(() => {
    let result = [...savedMembers];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(member => {
        const nameMatch = member.member.displayName.toLowerCase().includes(query);
        const tagMatch = member.tags?.some(tag => tag.toLowerCase().includes(query)) ?? false;
        const notesMatch = member.notes?.toLowerCase().includes(query) ?? false;
        const tierMatch = member.member.tier?.toLowerCase().includes(query) ?? false;
        return nameMatch || tagMatch || notesMatch || tierMatch;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.member.displayName.localeCompare(b.member.displayName);
          break;
        case 'dateSaved':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'tier':
          const tierOrder: Record<SavedMemberTier, number> = { favorite: 0, standard: 1, archived: 2 };
          comparison = tierOrder[a.tier] - tierOrder[b.tier];
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [savedMembers, searchQuery, sortBy, sortDirection]);

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection(option === 'name' ? 'asc' : 'desc');
    }
    setShowSortMenu(false);
  };

  const getSortLabel = (option: SortOption): string => {
    switch (option) {
      case 'name': return 'Name';
      case 'dateSaved': return 'Date Saved';
      case 'tier': return 'Tier';
    }
  };

  const getSortIcon = (): string => {
    return sortDirection === 'asc' ? '↑' : '↓';
  };

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
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, tag, notes, or tier..."
            placeholderTextColor={palette.ink400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Sort Controls */}
        <View style={styles.sortContainer}>
          <TouchableOpacity 
            style={styles.sortButton}
            onPress={() => setShowSortMenu(!showSortMenu)}
          >
            <Text style={styles.sortLabel}>Sort by:</Text>
            <Text style={styles.sortValue}>
              {getSortLabel(sortBy)} {getSortIcon()}
            </Text>
          </TouchableOpacity>
          
          {showSortMenu && (
            <View style={styles.sortMenu}>
              {(['name', 'dateSaved', 'tier'] as SortOption[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.sortOption,
                    sortBy === option && styles.sortOptionActive
                  ]}
                  onPress={() => toggleSort(option)}
                >
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === option && styles.sortOptionTextActive
                  ]}>
                    {getSortLabel(option)}
                    {sortBy === option && ` ${getSortIcon()}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTab 
          label="All" 
          count={savedMembers.length}
          active={filter === 'all'} 
          onPress={() => setFilter('all')} 
        />
        <FilterTab 
          label="Favorites" 
          count={savedMembers.filter(m => m.tier === 'favorite').length}
          active={filter === 'favorite'} 
          onPress={() => setFilter('favorite')} 
        />
        <FilterTab 
          label="Standard" 
          count={savedMembers.filter(m => m.tier === 'standard').length}
          active={filter === 'standard'} 
          onPress={() => setFilter('standard')} 
        />
        <FilterTab 
          label="Archived" 
          count={savedMembers.filter(m => m.tier === 'archived').length}
          active={filter === 'archived'} 
          onPress={() => setFilter('archived')} 
        />
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {searchQuery 
            ? `${processedMembers.length} of ${savedMembers.length} members`
            : `${savedMembers.length} saved members`
          }
        </Text>
      </View>

      {/* Saved Members List */}
      <FlatList
        data={processedMembers}
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
            createdAt={item.createdAt}
            onPress={() => onNavigateToProfile?.(item.savedId)}
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
            {searchQuery ? (
              <>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No matches found</Text>
                <Text style={styles.emptyText}>
                  Try adjusting your search terms or filters
                </Text>
              </>
            ) : filter !== 'all' ? (
              <>
                <Text style={styles.emptyIcon}>📂</Text>
                <Text style={styles.emptyTitle}>No {filter} members</Text>
                <Text style={styles.emptyText}>
                  Save members as {filter} to see them here
                </Text>
              </>
            ) : (
              <>
                <View style={styles.emptyIconContainer}>
                  <Text style={styles.emptyIcon}>⭐</Text>
                </View>
                <Text style={styles.emptyTitle}>Build your private network</Text>
                <Text style={styles.emptyText}>
                  Save members you discover to organize and prioritize your golf connections.{'\n\n'}
                  Members are organized into tiers:{'\n'}
                  • <Text style={styles.emptyHighlight}>Favorites</Text> — VIP connections{'\n'}
                  • <Text style={styles.emptyHighlight}>Standard</Text> — Regular connections{'\n'}
                  • <Text style={styles.emptyHighlight}>Archived</Text> — Dormant connections
                </Text>
                <TouchableOpacity 
                  style={styles.emptyAction}
                  onPress={() => onNavigateToNetwork?.()}
                >
                  <Text style={styles.emptyActionText}>Explore Network →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        }
      />
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
    gap: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.ink300,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    color: palette.ink900,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: palette.ink200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    color: palette.ink600,
    fontWeight: '600',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.navy50,
  },
  sortLabel: {
    fontSize: 13,
    color: palette.ink600,
  },
  sortValue: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.navy700,
  },
  sortMenu: {
    position: 'absolute',
    left: 0,
    top: 30,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.ink200,
    shadowColor: palette.ink900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  sortOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 120,
  },
  sortOptionActive: {
    backgroundColor: palette.navy50,
  },
  sortOptionText: {
    fontSize: 14,
    color: palette.ink700,
  },
  sortOptionTextActive: {
    fontWeight: '600',
    color: palette.navy700,
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
  resultsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: palette.ink50,
  },
  resultsText: {
    fontSize: 13,
    color: palette.ink500,
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
    fontSize: 48,
    marginBottom: spacing.md,
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
  },
  emptyHighlight: {
    fontWeight: '600',
    color: palette.ink700,
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