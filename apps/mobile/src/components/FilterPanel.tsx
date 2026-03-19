import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { palette, radius, spacing } from '../theme/design';
import {
  HandicapBand,
  NetworkingIntentFilter,
  HANDICAP_BANDS,
  NETWORKING_INTENT_FILTERS,
} from '@spotter/types';

// ============================================================================
// Types
// ============================================================================

export interface FilterState {
  handicap_band?: HandicapBand;
  location?: string;
  intent?: NetworkingIntentFilter;
  maxDistanceKm?: number;
  minCompatibilityScore?: number;
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onApply?: () => void;
  onReset?: () => void;
  compact?: boolean;
  activeCount?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DISTANCE_OPTIONS = [
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
];

const COMPATIBILITY_OPTIONS = [
  { value: 0, label: 'Any' },
  { value: 50, label: '50%+' },
  { value: 60, label: '60%+' },
  { value: 75, label: '75%+' },
];

// ============================================================================
// Component
// ============================================================================

export function FilterPanel({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  compact = false,
  activeCount = 0,
}: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [showFilters, setShowFilters] = useState(!compact);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilter = (key: keyof FilterState) => {
    const newFilters = { ...localFilters };
    delete newFilters[key];
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    setLocalFilters({});
    onFiltersChange({});
    onReset?.();
  };

  const hasActiveFilters = Object.keys(localFilters).length > 0;

  // Compact header view
  if (compact && !showFilters) {
    return (
      <TouchableOpacity
        style={styles.compactHeader}
        onPress={() => setShowFilters(true)}
        activeOpacity={0.8}
      >
        <View style={styles.compactHeaderContent}>
          <Text style={styles.compactTitle}>Filters</Text>
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.compactSubtitle}>Tap to refine your search</Text>
        {hasActiveFilters && (
          <View style={styles.activeFiltersRow}>
            {localFilters.handicap_band && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  {HANDICAP_BANDS.find(b => b.value === localFilters.handicap_band)?.label}
                </Text>
              </View>
            )}
            {localFilters.intent && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  {NETWORKING_INTENT_FILTERS.find(i => i.value === localFilters.intent)?.label}
                </Text>
              </View>
            )}
            {localFilters.location && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText} numberOfLines={1}>
                  {localFilters.location}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Card>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Refine Search</Text>
          <View style={styles.headerActions}>
            {hasActiveFilters && (
              <TouchableOpacity onPress={clearAllFilters} style={styles.clearButton}>
                <Text style={styles.clearText}>Clear all</Text>
              </TouchableOpacity>
            )}
            {compact && (
              <TouchableOpacity onPress={() => setShowFilters(false)} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Handicap Band Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Handicap</Text>
            <Text style={styles.sectionDescription}>Filter by skill level</Text>
            <View style={styles.chipRow}>
              {HANDICAP_BANDS.map((band) => (
                <TouchableOpacity
                  key={band.value}
                  style={[
                    styles.chip,
                    localFilters.handicap_band === band.value && styles.chipActive,
                  ]}
                  onPress={() =>
                    updateFilter(
                      'handicap_band',
                      localFilters.handicap_band === band.value ? undefined : band.value
                    )
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      localFilters.handicap_band === band.value && styles.chipTextActive,
                    ]}
                  >
                    {band.label}
                  </Text>
                  <Text
                    style={[
                      styles.chipSubtext,
                      localFilters.handicap_band === band.value && styles.chipTextActive,
                    ]}
                  >
                    {band.range}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Networking Intent Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Networking Intent</Text>
            <Text style={styles.sectionDescription}>What are they looking for?</Text>
            <View style={styles.chipColumn}>
              {NETWORKING_INTENT_FILTERS.map((intent) => (
                <TouchableOpacity
                  key={intent.value}
                  style={[
                    styles.intentChip,
                    localFilters.intent === intent.value && styles.intentChipActive,
                  ]}
                  onPress={() =>
                    updateFilter(
                      'intent',
                      localFilters.intent === intent.value ? undefined : intent.value
                    )
                  }
                >
                  <View style={styles.intentChipHeader}>
                    <Text
                      style={[
                        styles.intentChipText,
                        localFilters.intent === intent.value && styles.intentChipTextActive,
                      ]}
                    >
                      {intent.label}
                    </Text>
                    {localFilters.intent === intent.value && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.intentChipSubtext,
                      localFilters.intent === intent.value && styles.intentChipTextActive,
                    ]}
                  >
                    {intent.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Location</Text>
            <Text style={styles.sectionDescription}>City or area name</Text>
            <View style={styles.locationInputContainer}>
              <Text style={styles.locationIcon}>📍</Text>
              <TextInput
                style={styles.locationInput}
                placeholder="e.g., Scottsdale, AZ"
                value={localFilters.location || ''}
                onChangeText={(text) => updateFilter('location', text || undefined)}
                autoCapitalize="words"
                placeholderTextColor={palette.ink500}
              />
              {localFilters.location && (
                <TouchableOpacity onPress={() => clearFilter('location')}>
                  <Text style={styles.clearInput}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Max Distance Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Maximum Distance</Text>
            <Text style={styles.sectionDescription}>How far are you willing to travel?</Text>
            <View style={styles.chipRow}>
              {DISTANCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.distanceChip,
                    localFilters.maxDistanceKm === option.value && styles.chipActive,
                  ]}
                  onPress={() =>
                    updateFilter(
                      'maxDistanceKm',
                      localFilters.maxDistanceKm === option.value ? undefined : option.value
                    )
                  }
                >
                  <Text
                    style={[
                      styles.distanceChipText,
                      localFilters.maxDistanceKm === option.value && styles.chipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Minimum Compatibility Score */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Minimum Match Score</Text>
            <Text style={styles.sectionDescription}>Only show matches above this score</Text>
            <View style={styles.chipRow}>
              {COMPATIBILITY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.distanceChip,
                    localFilters.minCompatibilityScore === option.value && styles.chipActive,
                  ]}
                  onPress={() =>
                    updateFilter(
                      'minCompatibilityScore',
                      localFilters.minCompatibilityScore === option.value ? undefined : option.value
                    )
                  }
                >
                  <Text
                    style={[
                      styles.distanceChipText,
                      localFilters.minCompatibilityScore === option.value && styles.chipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Apply Button */}
          {onApply && (
            <View style={styles.applySection}>
              <Button title="Apply Filters" onPress={onApply} tone="primary" />
            </View>
          )}
        </ScrollView>
      </View>
    </Card>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    maxHeight: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink900,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  clearButton: {
    paddingVertical: spacing.xs,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy600,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeText: {
    fontSize: 18,
    color: palette.ink700,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: 12,
    color: palette.ink500,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.sky200,
    minWidth: 90,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900,
  },
  chipTextActive: {
    color: palette.white,
  },
  chipSubtext: {
    fontSize: 11,
    color: palette.ink500,
    marginTop: 2,
  },
  chipColumn: {
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
  intentChipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.white,
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky200,
    paddingHorizontal: spacing.md,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: palette.ink900,
    paddingVertical: spacing.sm,
  },
  clearInput: {
    fontSize: 14,
    color: palette.ink500,
    padding: spacing.xs,
  },
  distanceChip: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  distanceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900,
  },
  applySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },

  // Compact styles
  compactHeader: {
    padding: spacing.md,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  compactHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  badge: {
    backgroundColor: palette.navy600,
    borderRadius: radius.pill,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  compactSubtitle: {
    fontSize: 13,
    color: palette.ink500,
    marginTop: 2,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  activeFilterChip: {
    backgroundColor: palette.navy600 + '20', // 20% opacity
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderWidth: 1,
    borderColor: palette.navy600 + '40',
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.navy600,
    maxWidth: 120,
  },
});
