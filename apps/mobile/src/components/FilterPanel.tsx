import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
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
  golfArea?: string;
  industry?: string;
  roleTitle?: string;
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onApply?: () => void;
  onReset?: () => void;
  compact?: boolean;
  activeCount?: number;
  loading?: boolean;
  savedFilters?: FilterState;
  onSaveFilters?: (filters: FilterState) => Promise<void>;
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

const GOLF_AREAS = [
  'North Scottsdale',
  'South Scottsdale',
  'Paradise Valley',
  'Phoenix',
  'Tempe',
  'Mesa',
  'Chandler',
  'Gilbert',
  'Fountain Hills',
  'Carefree',
  'Cave Creek',
];

const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Real Estate',
  'Legal',
  'Marketing',
  'Consulting',
  'Entertainment',
  'Sports',
  'Other',
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
  loading = false,
  savedFilters,
  onSaveFilters,
}: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [showFilters, setShowFilters] = useState(!compact);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Sync local filters when external filters change (for persistence restoration)
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    setIsDirty(true);
    onFiltersChange(newFilters);
  };

  const clearFilter = (key: keyof FilterState) => {
    const newFilters = { ...localFilters };
    delete newFilters[key];
    setLocalFilters(newFilters);
    setIsDirty(true);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    setLocalFilters({});
    setIsDirty(true);
    onFiltersChange({});
    onReset?.();
  };

  const handleApply = () => {
    setIsDirty(false);
    onApply?.();
    if (compact) {
      setShowFilters(false);
    }
  };

  const handleSaveFilters = async () => {
    if (!onSaveFilters) return;
    
    setSaveLoading(true);
    try {
      await onSaveFilters(localFilters);
      setIsDirty(false);
      setShowSaveModal(false);
      Alert.alert('Success', 'Filter preferences saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save filter preferences. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLoadSaved = () => {
    if (savedFilters) {
      setLocalFilters(savedFilters);
      setIsDirty(true);
      onFiltersChange(savedFilters);
    }
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
          {isDirty && (
            <View style={styles.dirtyIndicator}>
              <Text style={styles.dirtyIndicatorText}>•</Text>
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
                <TouchableOpacity
                  onPress={() => clearFilter('handicap_band')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.clearChipText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            {localFilters.intent && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  {NETWORKING_INTENT_FILTERS.find(i => i.value === localFilters.intent)?.label}
                </Text>
                <TouchableOpacity
                  onPress={() => clearFilter('intent')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.clearChipText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            {localFilters.location && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText} numberOfLines={1}>
                  {localFilters.location}
                </Text>
                <TouchableOpacity
                  onPress={() => clearFilter('location')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.clearChipText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            {localFilters.maxDistanceKm && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  Within {localFilters.maxDistanceKm}km
                </Text>
                <TouchableOpacity
                  onPress={() => clearFilter('maxDistanceKm')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.clearChipText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <>
      <Card>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleSection}>
              <Text style={styles.title}>Refine Search</Text>
              {savedFilters && (
                <TouchableOpacity onPress={handleLoadSaved} style={styles.savedFiltersButton}>
                  <Text style={styles.savedFiltersText}>Load Saved</Text>
                </TouchableOpacity>
              )}
            </View>
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
              <Text style={styles.sectionLabel}>⛳ Handicap Band</Text>
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

            {/* Golf Area Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>📍 Golf Area</Text>
              <Text style={styles.sectionDescription}>Preferred area for golf</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                <View style={styles.chipRow}>
                  {GOLF_AREAS.map((area) => (
                    <TouchableOpacity
                      key={area}
                      style={[
                        styles.areaChip,
                        localFilters.golfArea === area && styles.chipActive,
                      ]}
                      onPress={() =>
                        updateFilter(
                          'golfArea',
                          localFilters.golfArea === area ? undefined : area
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          localFilters.golfArea === area && styles.chipTextActive,
                        ]}
                      >
                        {area}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Networking Intent Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>🤝 Networking Intent</Text>
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

            {/* Industry Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>🏢 Industry</Text>
              <Text style={styles.sectionDescription}>Filter by professional industry</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                <View style={styles.chipRow}>
                  {INDUSTRIES.map((industry) => (
                    <TouchableOpacity
                      key={industry}
                      style={[
                        styles.industryChip,
                        localFilters.industry === industry && styles.chipActive,
                      ]}
                      onPress={() =>
                        updateFilter(
                          'industry',
                          localFilters.industry === industry ? undefined : industry
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          localFilters.industry === industry && styles.chipTextActive,
                        ]}
                      >
                        {industry}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Role/Title Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>💼 Role / Title</Text>
              <Text style={styles.sectionDescription}>Search by job title or role</Text>
              <View style={styles.locationInputContainer}>
                <Text style={styles.inputIcon}>💼</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., VP, Director, Manager"
                  value={localFilters.roleTitle || ''}
                  onChangeText={(text) => updateFilter('roleTitle', text || undefined)}
                  autoCapitalize="words"
                  placeholderTextColor={palette.ink500}
                />
                {localFilters.roleTitle && (
                  <TouchableOpacity onPress={() => clearFilter('roleTitle')}>
                    <Text style={styles.clearInput}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Location Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>🌍 Location</Text>
              <Text style={styles.sectionDescription}>City or area name</Text>
              <View style={styles.locationInputContainer}>
                <Text style={styles.inputIcon}>📍</Text>
                <TextInput
                  style={styles.textInput}
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
              <Text style={styles.sectionLabel}>📏 Maximum Distance</Text>
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
              <Text style={styles.sectionLabel}>⭐ Minimum Match Score</Text>
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

            {/* Action Buttons */}
            <View style={styles.applySection}>
              {onSaveFilters && (
                <TouchableOpacity
                  style={styles.saveFiltersButton}
                  onPress={() => setShowSaveModal(true)}
                >
                  <Text style={styles.saveFiltersButtonText}>💾 Save Preferences</Text>
                </TouchableOpacity>
              )}
              {onApply && (
                <Button
                  title={loading ? 'Applying...' : 'Apply Filters'}
                  onPress={handleApply}
                  tone="primary"
                />
              )}
            </View>
          </ScrollView>
        </View>
      </Card>

      {/* Save Filters Confirmation Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Filter Preferences?</Text>
            <Text style={styles.modalText}>
              This will save your current filter settings for next time.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveFilters}
                disabled={saveLoading}
              >
                {saveLoading ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    maxHeight: 600,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink900,
  },
  savedFiltersButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.sky100,
    borderRadius: radius.sm,
  },
  savedFiltersText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.navy600,
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
  horizontalScroll: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  areaChip: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  industryChip: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.sky200,
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
  inputIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  textInput: {
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
    gap: spacing.sm,
  },
  saveFiltersButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  saveFiltersButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy600,
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
  dirtyIndicator: {
    marginLeft: spacing.xs,
  },
  dirtyIndicatorText: {
    fontSize: 20,
    color: palette.navy600,
    fontWeight: '800',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.navy600 + '20', // 20% opacity
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderWidth: 1,
    borderColor: palette.navy600 + '40',
    gap: spacing.xs,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.navy600,
    maxWidth: 100,
  },
  clearChipText: {
    fontSize: 12,
    color: palette.navy600,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  modalText: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: palette.navy600,
  },
  modalButtonSecondary: {
    backgroundColor: palette.sky100,
  },
  modalButtonPrimaryText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '700',
  },
  modalButtonSecondaryText: {
    color: palette.ink900,
    fontSize: 15,
    fontWeight: '600',
  },
});
