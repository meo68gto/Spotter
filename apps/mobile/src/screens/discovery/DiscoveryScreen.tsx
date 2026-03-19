import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TierBadge } from '../../components/TierBadge';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';
import {
  DiscoverableGolfer,
  HANDICAP_BANDS,
  NETWORKING_INTENT_FILTERS,
  HandicapBand,
  NetworkingIntentFilter,
} from '@spotter/types';

type FilterState = {
  handicap_band?: HandicapBand;
  location?: string;
  intent?: NetworkingIntentFilter;
};

interface DiscoveryResponse {
  golfers: DiscoverableGolfer[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
  caller_tier: {
    tier_id: string;
    slug: string;
  };
}

export function DiscoveryScreen({ session }: { session: Session }) {
  const [golfers, setGolfers] = useState<DiscoverableGolfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, hasMore: true });
  const [callerTier, setCallerTier] = useState<string>('free');

  const fetchGolfers = useCallback(
    async (isRefresh = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const offset = isRefresh ? 0 : pagination.offset;
        const response = await invokeFunction<DiscoveryResponse>('discovery-search', {
          method: 'POST',
          body: {
            ...filters,
            limit: 20,
            offset,
          },
        });
        setGolfers((prev) => (isRefresh ? response.golfers : [...prev, ...response.golfers]));
        setPagination({
          offset: offset + response.golfers.length,
          hasMore: response.pagination.has_more,
        });
        setCallerTier(response.caller_tier.slug);
      } catch (error) {
        Alert.alert('Discovery failed', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters, pagination.offset, loading]
  );

  useEffect(() => {
    fetchGolfers(true);
  }, [filters]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGolfers(true);
  };

  const onLoadMore = () => {
    if (pagination.hasMore && !loading) {
      fetchGolfers(false);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setShowFilters(false);
  };

  const renderFilterSection = () => (
    <Card>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Filters</Text>
        <TouchableOpacity onPress={clearFilters}>
          <Text style={styles.clearText}>Clear all</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.filterLabel}>Handicap</Text>
      <View style={styles.filterRow}>
        {HANDICAP_BANDS.map((band) => (
          <TouchableOpacity
            key={band.value}
            style={[
              styles.filterChip,
              filters.handicap_band === band.value && styles.filterChipActive,
            ]}
            onPress={() =>
              setFilters((prev) => ({
                ...prev,
                handicap_band: prev.handicap_band === band.value ? undefined : band.value,
              }))
            }
          >
            <Text
              style={[
                styles.filterChipText,
                filters.handicap_band === band.value && styles.filterChipTextActive,
              ]}
            >
              {band.label}
            </Text>
            <Text
              style={[
                styles.filterChipSubtext,
                filters.handicap_band === band.value && styles.filterChipTextActive,
              ]}
            >
              {band.range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.filterLabel}>Intent</Text>
      <View style={styles.filterColumn}>
        {NETWORKING_INTENT_FILTERS.map((intent) => (
          <TouchableOpacity
            key={intent.value}
            style={[
              styles.intentChip,
              filters.intent === intent.value && styles.intentChipActive,
            ]}
            onPress={() =>
              setFilters((prev) => ({
                ...prev,
                intent: prev.intent === intent.value ? undefined : intent.value,
              }))
            }
          >
            <Text
              style={[
                styles.intentChipText,
                filters.intent === intent.value && styles.intentChipTextActive,
              ]}
            >
              {intent.label}
            </Text>
            <Text
              style={[
                styles.intentChipSubtext,
                filters.intent === intent.value && styles.intentChipTextActive,
              ]}
            >
              {intent.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.filterLabel}>Location</Text>
      <TextInput
        style={styles.locationInput}
        placeholder="Enter city or area..."
        value={filters.location || ''}
        onChangeText={(text) =>
          setFilters((prev) => ({ ...prev, location: text || undefined }))
        }
        autoCapitalize="words"
      />
    </Card>
  );

  const renderGolferCard = ({ item }: { item: DiscoverableGolfer }) => (
    <Card>
      <View style={styles.golferCard}>
        <View style={styles.golferHeader}>
          <View style={styles.avatarContainer}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{item.display_name.charAt(0)}</Text>
              </View>
            )}
          </View>
          <View style={styles.golferInfo}>
            <Text style={styles.golferName}>{item.display_name}</Text>
            {item.city && <Text style={styles.golferLocation}>{item.city}</Text>}
            <View style={styles.badgeRow}>
              <TierBadge tier={item.tier_slug as 'free' | 'select' | 'summit'} size="sm" />
            </View>
          </View>
          <View style={styles.scoreContainer}>
            <Text style={styles.compatibilityScore}>{Math.round(item.compatibility_score)}%</Text>
            <Text style={styles.compatibilityLabel}>Match</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          {item.golf?.handicap !== undefined && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Handicap</Text>
              <Text style={styles.detailValue}>{item.golf.handicap}</Text>
            </View>
          )}
          {item.professional?.company && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Company</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {item.professional.company}
              </Text>
            </View>
          )}
          {item.professional?.title && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Title</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {item.professional.title}
              </Text>
            </View>
          )}
        </View>

        {item.networking_preferences?.networking_intent && (
          <View style={styles.intentTag}>
            <Text style={styles.intentTagText}>
              {
                NETWORKING_INTENT_FILTERS.find(
                  (i) => i.value === item.networking_preferences?.networking_intent
                )?.label
              }
            </Text>
          </View>
        )}

        <Button
          title="Connect"
          onPress={() => {
            // TODO: Navigate to matching screen or send connection request
            Alert.alert('Connect', `Request to connect with ${item.display_name}`);
          }}
          tone="primary"
        />
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover Golfers</Text>
        <Text style={styles.subtitle}>Find golfers in your tier</Text>
      </View>

      <TouchableOpacity
        style={styles.filterToggle}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Text style={styles.filterToggleText}>
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Text>
        {Object.values(filters).filter(Boolean).length > 0 && (
          <View style={styles.activeFilterBadge}>
            <Text style={styles.activeFilterCount}>
              {Object.values(filters).filter(Boolean).length}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <FlatList
        data={golfers}
        renderItem={renderGolferCard}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={showFilters ? renderFilterSection : null}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No golfers found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingFooter}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 4,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy600,
  },
  activeFilterBadge: {
    backgroundColor: palette.navy600,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  activeFilterCount: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  clearText: {
    fontSize: 13,
    color: palette.navy600,
    fontWeight: '600',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink700,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.sky200,
    minWidth: 100,
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900,
  },
  filterChipTextActive: {
    color: palette.white,
  },
  filterChipSubtext: {
    fontSize: 11,
    color: palette.ink500,
    marginTop: 2,
  },
  filterColumn: {
    gap: spacing.sm,
  },
  intentChip: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  intentChipActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  intentChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  intentChipTextActive: {
    color: palette.white,
  },
  intentChipSubtext: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 2,
  },
  locationInput: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: palette.ink900,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  golferCard: {
    gap: spacing.sm,
  },
  golferHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarContainer: {
    width: 56,
    height: 56,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '700',
  },
  golferInfo: {
    flex: 1,
  },
  golferName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  golferLocation: {
    fontSize: 13,
    color: palette.ink700,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: spacing.xs,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  compatibilityScore: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.navy600,
  },
  compatibilityLabel: {
    fontSize: 11,
    color: palette.ink500,
    textTransform: 'uppercase',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: palette.ink500,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
    marginTop: 2,
  },
  intentTag: {
    backgroundColor: palette.sky100,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  intentTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.ink700,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink700,
  },
  emptySubtext: {
    fontSize: 14,
    color: palette.ink500,
    marginTop: spacing.xs,
  },
  loadingFooter: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  loadingText: {
    color: palette.ink500,
  },
});
