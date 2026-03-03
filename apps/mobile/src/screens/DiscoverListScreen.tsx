import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette, spacing, radius, font, isWeb } from '../../theme/design';
import { Button, EmptyState, FilterChip, Input, PlayerCard, SkeletonLoader } from '../../components';
import { useDiscoverPlayers } from '../hooks';
import { useSession } from '../../contexts/SessionContext';
import { Coords, parseCachedCoords, buildDeniedPermissionMessage, buildOfflineFallbackMessage } from '../../lib/location-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOCATION_CACHE_KEY = 'spotter_last_known_coords';
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2;
const PAGE_SIZE = 12;

type SortOption = 'closest' | 'rating' | 'newest';
type DistanceOption = '1mi' | '5mi' | '10mi' | '25mi';
type SkillOption = 'Any' | 'Beginner' | 'Intermediate' | 'Advanced';

const SPORT_FILTERS = ['All', 'Tennis', 'Pickleball', 'Basketball', 'Soccer', 'Golf', 'Padel'];
const DISTANCE_OPTIONS: DistanceOption[] = ['1mi', '5mi', '10mi', '25mi'];
const SKILL_OPTIONS: SkillOption[] = ['Any', 'Beginner', 'Intermediate', 'Advanced'];
const DISTANCE_MAP: Record<DistanceOption, number> = { '1mi': 1, '5mi': 5, '10mi': 10, '25mi': 25 };
const SORT_LABELS: Record<SortOption, string> = { closest: 'Closest', rating: 'Top Rated', newest: 'Newest' };

export default function DiscoverListScreen() {
  const navigation = useNavigation<any>();
  const { session } = useSession();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSport, setActiveSport] = useState('All');
  const [activeDistance, setActiveDistance] = useState<DistanceOption>('5mi');
  const [activeSkill, setActiveSkill] = useState<SkillOption>('Any');
  const [availableNow, setAvailableNow] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('closest');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { players, loading, error, refetch } = useDiscoverPlayers({
    sport: activeSport === 'All' ? undefined : activeSport,
    coords,
    radiusMiles: DISTANCE_MAP[activeDistance],
    skillLevel: activeSkill === 'Any' ? undefined : activeSkill,
    availableNow,
  });

  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
        if (cached) { const parsed = parseCachedCoords(cached); if (parsed) setCoords(parsed); }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const fresh: Coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCoords(fresh);
        await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(fresh));
      } catch {}
    })();
  }, []);

  const filtered = players.filter((p) => {
    if (searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase();
    return (p.display_name?.toLowerCase().includes(q) || p.location?.toLowerCase().includes(q) || p.sports?.some((s: string) => s.toLowerCase().includes(q)));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'closest') return (a.distance_miles ?? 999) - (b.distance_miles ?? 999);
    if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });

  const visible = sorted.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < sorted.length;
  const handleShowMore = () => setPage((p) => p + 1);
  const handlePlayerPress = (playerId: string) => { navigation.navigate('PlayerProfile', { playerId }); };
  const handleBackToMap = () => { navigation.navigate('DiscoverMap'); };

  const renderSkeleton = () => (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, i) => (<SkeletonLoader key={i} width={CARD_WIDTH} height={200} borderRadius={radius.lg} />))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBackToMap}>
          <Ionicons name="map-outline" size={22} color={palette.navy600} />
        </Pressable>
        <Text style={styles.headerTitle}>Nearby Players</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.searchWrapper}>
        <Input variant="search" placeholder="Search players, sports, locations..." value={searchQuery} onChangeText={setSearchQuery} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>
        {SPORT_FILTERS.map((sport) => (<FilterChip key={sport} label={sport} active={activeSport === sport} onPress={() => { setActiveSport(sport); setPage(1); }} style={{ marginRight: spacing.xs }} />))}
        <View style={styles.filterDivider} />
        {DISTANCE_OPTIONS.map((d) => (<FilterChip key={d} label={d} active={activeDistance === d} onPress={() => { setActiveDistance(d); setPage(1); }} style={{ marginRight: spacing.xs }} />))}
        <View style={styles.filterDivider} />
        {SKILL_OPTIONS.map((skill) => (<FilterChip key={skill} label={skill} active={activeSkill === skill} onPress={() => { setActiveSkill(skill); setPage(1); }} style={{ marginRight: spacing.xs }} />))}
        <View style={styles.filterDivider} />
        <FilterChip label="Available Now" active={availableNow} onPress={() => { setAvailableNow((v) => !v); setPage(1); }} icon={availableNow ? 'checkmark-circle' : 'time-outline'} />
      </ScrollView>
      <View style={styles.sortRow}>
        <Text style={styles.resultCount}>{loading ? '—' : `${sorted.length} player${sorted.length !== 1 ? 's' : ''}`}</Text>
        <Pressable style={styles.sortButton} onPress={() => setSortMenuOpen((v) => !v)}>
          <Text style={styles.sortLabel}>{SORT_LABELS[sortBy]}</Text>
          <Ionicons name={sortMenuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={palette.navy600} />
        </Pressable>
        {sortMenuOpen && (
          <View style={styles.sortMenu}>
            {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
              <Pressable key={opt} style={[styles.sortMenuItem, sortBy === opt && styles.sortMenuItemActive]} onPress={() => { setSortBy(opt); setSortMenuOpen(false); }}>
                <Text style={[styles.sortMenuItemText, sortBy === opt && { color: palette.navy600, fontFamily: font.semibold }]}>{SORT_LABELS[opt]}</Text>
                {sortBy === opt && (<Ionicons name="checkmark" size={14} color={palette.navy600} />)}
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {loading ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>{renderSkeleton()}</ScrollView>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={32} color={palette.red500} />
          <Text style={styles.errorText}>Could not load players</Text>
          <Button label="Retry" variant="secondary" size="sm" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState icon="person-outline" title="No players match your filters" subtitle="Try adjusting the sport, distance, or skill level filters" />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (<PlayerCard player={item} onPress={() => handlePlayerPress(item.id)} style={{ width: CARD_WIDTH }} />)}
          ListFooterComponent={
            hasMore ? (<View style={styles.showMoreWrapper}><Button label={`Show more (${sorted.length - visible.length} remaining)`} variant="secondary" size="md" onPress={handleShowMore} /></View>)
            : sorted.length > 0 ? (<Text style={styles.endText}>You've seen all nearby players</Text>) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: isWeb ? spacing.lg : 52, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: palette.white, borderBottomWidth: 1, borderBottomColor: palette.gray100 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.gray50, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: font.bold, fontSize: 20, color: palette.ink900 },
  searchWrapper: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  filterStrip: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs, alignItems: 'center' },
  filterDivider: { width: 1, height: 20, backgroundColor: palette.gray200, marginHorizontal: spacing.xs },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.gray100 },
  resultCount: { fontFamily: font.regular, fontSize: 13, color: palette.ink500 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: palette.gray50, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.md, borderWidth: 1, borderColor: palette.gray200 },
  sortLabel: { fontFamily: font.medium, fontSize: 13, color: palette.navy600 },
  sortMenu: { position: 'absolute', top: 44, right: spacing.lg, backgroundColor: palette.white, borderRadius: radius.md, borderWidth: 1, borderColor: palette.gray200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6, zIndex: 100, minWidth: 150 },
  sortMenuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  sortMenuItemActive: { backgroundColor: palette.navy50 },
  sortMenuItemText: { fontFamily: font.regular, fontSize: 14, color: palette.ink700 },
  scrollContent: { paddingBottom: spacing.xxl },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, padding: spacing.lg },
  gridRow: { gap: spacing.md },
  gridContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  errorText: { fontFamily: font.medium, fontSize: 15, color: palette.ink700, marginTop: spacing.md },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  showMoreWrapper: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  endText: { fontFamily: font.regular, fontSize: 13, color: palette.ink400, textAlign: 'center', paddingVertical: spacing.lg },
});
