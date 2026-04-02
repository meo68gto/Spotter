import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TierBadge } from '../../components/TierBadge';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';
import { MapScreen } from '../MapScreen';
import {
  DiscoverableGolfer,
  getVisibleTiers,
  HANDICAP_BANDS,
  NETWORKING_INTENT_FILTERS,
  HandicapBand,
  NetworkingIntentFilter,
  SavedMemberData,
  TierSlug,
} from '@spotter/types';
import { Platform } from 'react-native';

type FilterState = {
  handicap_band?: HandicapBand;
  location?: string;
  intent?: NetworkingIntentFilter;
  /** EPIC 7: Filter by tier slug */
  tier?: TierSlug;
  /** EPIC 7: Hunt Mode for SELECT (view FREE members) */
  huntMode?: boolean;
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
  /** EPIC 7: Visibility metadata from backend */
  visibility?: {
    visible_tiers: TierSlug[];
    hunt_mode_active: boolean;
    summit_privacy_respected: boolean;
  };
}

interface SavedMembersResponse {
  data: SavedMemberData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function DiscoveryScreen({
  session,
  onOpenGolfer,
  onOpenPlay,
}: {
  session: Session;
  onOpenGolfer?: (golfer: DiscoverableGolfer) => void;
  onOpenPlay?: () => void;
}) {
  const [golfers, setGolfers] = useState<DiscoverableGolfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, hasMore: true });
  const [callerTier, setCallerTier] = useState<TierSlug>('free');
  const [savedMemberIds, setSavedMemberIds] = useState<Set<string>>(new Set());
  const [savingMemberIds, setSavingMemberIds] = useState<Set<string>>(new Set());
  const [presentation, setPresentation] = useState<'list' | 'map'>('list');
  // EPIC 7: Hunt Mode state for SELECT members
  const [huntModeActive, setHuntModeActive] = useState(false);
  // EPIC 7: Computed visible tiers based on caller tier + hunt mode
  const visibleTiers = getVisibleTiers(callerTier as TierSlug, huntModeActive);

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
            // EPIC 7: Pass hunt mode to backend
            huntMode: huntModeActive,
          },
        });
        setGolfers((prev) => (isRefresh ? response.golfers : [...prev, ...response.golfers]));
        setPagination({
          offset: offset + response.golfers.length,
          hasMore: response.pagination.has_more,
        });
        setCallerTier(response.caller_tier.slug as TierSlug);
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
    fetchSavedMembers();
  }, [filters, huntModeActive]);

  const fetchSavedMembers = async () => {
    try {
      const response = await invokeFunction<SavedMembersResponse>('network-save-member', {
        method: 'GET',
      });
      const savedIds = new Set(response.data.map((m) => m.id));
      setSavedMemberIds(savedIds);
    } catch (error) {
      // Silently fail - saved state is not critical
      console.log('Failed to fetch saved members:', error);
    }
  };

  const handleSaveMember = async (item: DiscoverableGolfer) => {
    if (savingMemberIds.has(item.user_id)) return;

    setSavingMemberIds((prev) => new Set(prev).add(item.user_id));

    try {
      await invokeFunction<SavedMemberData>('network-save-member', {
        method: 'POST',
        body: {
          userId: item.user_id,
          tier: 'standard',
        },
      });

      setSavedMemberIds((prev) => new Set(prev).add(item.user_id));

      if (Platform.OS === 'android') {
        ToastAndroid.show('Member saved to your network', ToastAndroid.SHORT);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save member';
      Alert.alert('Error', message);
    } finally {
      setSavingMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(item.user_id);
        return next;
      });
    }
  };

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

  // EPIC 7: Determine if Hunt Mode toggle should be shown (SELECT only)
  const showHuntMode = callerTier === 'select';

  // EPIC 7: Tier display labels
  const tierLabels: Record<TierSlug, string> = {
    free: 'Free',
    select: 'Select',
    summit: 'Summit',
  };

  // EPIC 7: Tier colors for filter chips
  const tierColors: Record<TierSlug, string> = {
    free: palette.ink500,
    select: palette.navy600,
    summit: palette.amber500,
  };

  const renderFilterSection = () => (
    <Card>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Filters</Text>
        <TouchableOpacity onPress={clearFilters}>
          <Text style={styles.clearText}>Clear all</Text>
        </TouchableOpacity>
      </View>

      {/*
        EPIC 7: Tier Filter Chips — only show if multiple tiers are visible
        FREE: sees only free (no chip shown)
        SELECT: sees select + summit (show both chips)
        SUMMIT: sees summit only (no chip needed)
      */}
      {visibleTiers.length > 1 && (
        <>
          <Text style={styles.filterLabel}>Member Tier</Text>
          <View style={styles.filterRow}>
            {visibleTiers.map((tier) => (
              <TouchableOpacity
                key={tier}
                style={[
                  styles.tierChip,
                  filters.tier === tier && { backgroundColor: tierColors[tier] },
                ]}
                onPress={() =>
                  setFilters((prev) => ({
                    ...prev,
                    tier: prev.tier === tier ? undefined : tier,
                  }))
                }
              >
                <Text
                  style={[
                    styles.tierChipText,
                    filters.tier === tier && styles.tierChipTextActive,
                  ]}
                >
                  {tierLabels[tier]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/*
        EPIC 7: Hunt Mode Toggle — SELECT members only
        Allows SELECT members to view FREE-tier members for coaching/lessons
      */}
      {showHuntMode && (
        <>
          <View style={styles.huntModeRow}>
            <View style={styles.huntModeInfo}>
              <Text style={styles.huntModeLabel}>Hunt Mode</Text>
              <Text style={styles.huntModeDescription}>
                Include FREE members to find students for lessons
              </Text>
            </View>
            <Switch
              value={huntModeActive}
              onValueChange={setHuntModeActive}
              trackColor={{ false: palette.sky300, true: palette.navy600 }}
              thumbColor={palette.white}
            />
          </View>
          {huntModeActive && (
            <Text style={styles.huntModeActiveIndicator}>👁️ Including FREE members</Text>
          )}
        </>
      )}

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

        <View style={styles.actionsRow}>
          <View style={styles.actionButton}>
            <Button title="View profile" onPress={() => onOpenGolfer?.(item)} tone="secondary" />
          </View>
          <View style={styles.actionButton}>
            <Button
              title={savedMemberIds.has(item.user_id) ? 'Saved' : 'Save'}
              onPress={() => handleSaveMember(item)}
              tone="primary"
              disabled={savedMemberIds.has(item.user_id) || savingMemberIds.has(item.user_id)}
              loading={savingMemberIds.has(item.user_id)}
            />
          </View>
        </View>
        {onOpenPlay ? <Button title="Invite to play" onPress={onOpenPlay} tone="ghost" /> : null}
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover Golfers</Text>
        <Text style={styles.subtitle}>Find compatible golfers, open rounds, and local golf energy</Text>
      </View>

      <View style={styles.modeSwitch}>
        <TouchableOpacity style={[styles.modeChip, presentation === 'list' && styles.modeChipActive]} onPress={() => setPresentation('list')}>
          <Text style={[styles.modeChipText, presentation === 'list' && styles.modeChipTextActive]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeChip, presentation === 'map' && styles.modeChipActive]} onPress={() => setPresentation('map')}>
          <Text style={[styles.modeChipText, presentation === 'map' && styles.modeChipTextActive]}>Map</Text>
        </TouchableOpacity>
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

      {presentation === 'map' ? (
        <ScrollView
          style={styles.mapContainer}
          contentContainerStyle={styles.mapContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {showFilters ? renderFilterSection() : null}
          <MapScreen />
          <Card>
            <Text style={styles.sectionTitle}>Open rounds near you</Text>
            <Text style={styles.emptySubtext}>Map view helps you orient to local activity. Switch back to list view to compare golfers and send invites.</Text>
            {onOpenPlay ? <Button title="Create an open round" onPress={onOpenPlay} /> : null}
          </Card>
        </ScrollView>
      ) : (
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
      )}
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
  modeSwitch: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: palette.white,
  },
  modeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.sky300,
    backgroundColor: palette.sky100,
  },
  modeChipActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.ink700,
  },
  modeChipTextActive: {
    color: palette.white,
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
  // EPIC 7: Tier filter chips
  tierChip: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.sky200,
    minWidth: 80,
    alignItems: 'center',
  },
  tierChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900,
  },
  tierChipTextActive: {
    color: palette.white,
  },
  // EPIC 7: Hunt Mode styles
  huntModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
    marginTop: spacing.sm,
  },
  huntModeInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  huntModeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  huntModeDescription: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 2,
  },
  huntModeActiveIndicator: {
    fontSize: 12,
    color: palette.navy600,
    fontWeight: '600',
    marginBottom: spacing.sm,
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
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
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
  mapContainer: {
    flex: 1,
  },
  mapContent: {
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.sm,
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
