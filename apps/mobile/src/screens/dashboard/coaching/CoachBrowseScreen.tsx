import { useState } from 'react';
import { ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CoachCatalogItem, useCoachCatalog, FilterOptions, CoachServiceType } from '../../../hooks/useCoachCatalog';
import { stockPhotos } from '../../../lib/stockPhotos';
import { CoachListCard } from '../../../components/coaching/CoachListCard';
import { Button } from '../../../components/Button';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onSelectCoach: (coach: CoachCatalogItem) => void;
};

const PRICE_RANGES = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Under $30', min: 0, max: 3000 },
  { label: '$30-60', min: 3000, max: 6000 },
  { label: '$60+', min: 6000, max: undefined }
];

const SESSION_MODES: Array<{ mode: CoachServiceType; label: string }> = [
  { mode: 'text_qna', label: 'Text Q&A' },
  { mode: 'video_review', label: 'Video Review' },
  { mode: 'live_video_call', label: 'Live Call' }
];

const MIN_RATINGS = [
  { label: 'Any', value: undefined },
  { label: '4+ stars', value: 4 },
  { label: '4.5+ stars', value: 4.5 }
];

export function CoachBrowseScreen({ search, onSearchChange, onSelectCoach }: Props) {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [showFilters, setShowFilters] = useState(false);
  
  const { items, loading, refresh, page, hasNextPage, availableSpecialties, nextPage, prevPage } = useCoachCatalog(search, filters);

  const activeFilterCount = [
    filters.specialty,
    filters.minPrice !== undefined,
    filters.mode,
    filters.minRating
  ].filter(Boolean).length;

  const updateFilter = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <ImageBackground source={{ uri: stockPhotos.coachBrowseHero }} imageStyle={styles.heroImage} style={styles.hero}>
        <Text style={styles.heroTitle}>Coach Directory</Text>
      </ImageBackground>

      <View style={styles.searchSection}>
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search coaches by name, headline, or bio"
          style={styles.input}
        />
        <TouchableOpacity 
          style={[styles.filterToggle, activeFilterCount > 0 && styles.filterToggleActive]} 
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterToggleText}>
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          {/* Specialty Filter */}
          {availableSpecialties.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Specialty</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterChip, !filters.specialty && styles.filterChipActive]}
                  onPress={() => updateFilter('specialty', undefined)}
                >
                  <Text style={[styles.filterChipText, !filters.specialty && styles.filterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {availableSpecialties.map(specialty => (
                  <TouchableOpacity
                    key={specialty}
                    style={[styles.filterChip, filters.specialty === specialty && styles.filterChipActive]}
                    onPress={() => updateFilter('specialty', specialty)}
                  >
                    <Text style={[styles.filterChipText, filters.specialty === specialty && styles.filterChipTextActive]}>
                      {specialty}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Price Range Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Price Range</Text>
            <View style={styles.filterRow}>
              {PRICE_RANGES.map(range => (
                <TouchableOpacity
                  key={range.label}
                  style={[
                    styles.filterChip,
                    filters.minPrice === range.min && filters.maxPrice === range.max && styles.filterChipActive
                  ]}
                  onPress={() => {
                    updateFilter('minPrice', range.min);
                    updateFilter('maxPrice', range.max);
                  }}
                >
                  <Text style={[
                    styles.filterChipText,
                    filters.minPrice === range.min && filters.maxPrice === range.max && styles.filterChipTextActive
                  ]}>
                    {range.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Session Mode Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Session Type</Text>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !filters.mode && styles.filterChipActive]}
                onPress={() => updateFilter('mode', undefined)}
              >
                <Text style={[styles.filterChipText, !filters.mode && styles.filterChipTextActive]}>Any</Text>
              </TouchableOpacity>
              {SESSION_MODES.map(({ mode, label }) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.filterChip, filters.mode === mode && styles.filterChipActive]}
                  onPress={() => updateFilter('mode', mode)}
                >
                  <Text style={[styles.filterChipText, filters.mode === mode && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Rating Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Minimum Rating</Text>
            <View style={styles.filterRow}>
              {MIN_RATINGS.map(({ label, value }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.filterChip, filters.minRating === value && styles.filterChipActive]}
                  onPress={() => updateFilter('minRating', value)}
                >
                  <Text style={[styles.filterChipText, filters.minRating === value && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearFilters} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {items.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No coaches found</Text>
          <Text style={styles.emptyText}>
            {activeFilterCount > 0 
              ? 'Try adjusting your filters to see more results'
              : 'Check back later for new coaches'}
          </Text>
        </View>
      )}

      {items.map((coach) => (
        <CoachListCard
          key={coach.coachId}
          name={coach.displayName}
          headline={coach.headline}
          city={coach.city}
          specialties={coach.specialties}
          ratingAvg={coach.ratingAvg}
          ratingCount={coach.ratingCount}
          minPrice={coach.minPrice}
          maxPrice={coach.maxPrice}
          avgResponseMinutes={coach.avgResponseMinutes}
          hasVideoReview={coach.hasVideoReview}
          serviceCount={coach.services.length}
          onPress={() => onSelectCoach(coach)}
        />
      ))}

      {items.length > 0 && (
        <>
          <Text style={styles.pageMeta}>Page {page}</Text>
          <View style={styles.pagination}>
            <Button title="Previous" onPress={prevPage} disabled={page <= 1 || loading} tone="secondary" />
            <Button title="Next" onPress={nextPage} disabled={!hasNextPage || loading} tone="secondary" />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  hero: { height: 150, justifyContent: 'flex-end', padding: 12, marginBottom: 12 },
  heroImage: { borderRadius: 14 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  searchSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  filterToggle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    justifyContent: 'center'
  },
  filterToggleActive: {
    backgroundColor: '#0b3a53',
    borderColor: '#0b3a53'
  },
  filterToggleText: {
    color: '#334e68',
    fontWeight: '600'
  },
  filtersPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d9e2ec'
  },
  filterSection: {
    marginBottom: 12
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#486581',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f4f8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  filterChipActive: {
    backgroundColor: '#0b3a53',
    borderColor: '#0b3a53'
  },
  filterChipText: {
    fontSize: 13,
    color: '#334e68',
    fontWeight: '500'
  },
  filterChipTextActive: {
    color: '#fff'
  },
  clearFilters: {
    alignSelf: 'flex-start',
    marginTop: 4
  },
  clearFiltersText: {
    color: '#0b3a53',
    fontWeight: '600',
    fontSize: 13
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102a43',
    marginBottom: 8
  },
  emptyText: {
    color: '#627d98',
    textAlign: 'center'
  },
  pageMeta: { 
    color: '#627d98', 
    marginTop: 16, 
    textAlign: 'center',
    marginBottom: 8
  },
  pagination: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center'
  }
});
