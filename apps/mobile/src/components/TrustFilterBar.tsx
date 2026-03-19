// Epic 6: Trust Filter Bar
// Filter and sort by trust metrics

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { TrustFilterLevel, TrustSortOption } from '../hooks/useTrust';
import { palette, radius, spacing } from '../theme/design';

// ============================================================================
// Types
// ============================================================================

interface TrustFilterBarProps {
  filterLevel: TrustFilterLevel;
  onFilterChange: (level: TrustFilterLevel) => void;
  sortBy: TrustSortOption;
  onSortChange: (option: TrustSortOption) => void;
  showSort?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: { value: TrustFilterLevel; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: palette.ink500 },
  { value: 'exceptional', label: 'Exceptional', color: '#059669' },
  { value: 'trusted', label: 'Trusted', color: '#0891b2' },
  { value: 'reliable', label: 'Reliable', color: '#d97706' },
  { value: 'building', label: 'Building', color: '#6b7280' },
];

const SORT_OPTIONS: { value: TrustSortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'reliability', label: 'Reliability' },
  { value: 'vouches', label: 'Most Vouched' },
  { value: 'rounds', label: 'Most Rounds' },
];

// ============================================================================
// Component
// ============================================================================

export function TrustFilterBar({
  filterLevel,
  onFilterChange,
  sortBy,
  onSortChange,
  showSort = true,
}: TrustFilterBarProps) {
  return (
    <View style={styles.container}>
      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
      >
        {FILTER_OPTIONS.map((option) => {
          const isActive = filterLevel === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterPill,
                isActive && { 
                  backgroundColor: `${option.color}20`,
                  borderColor: option.color,
                },
              ]}
              onPress={() => onFilterChange(option.value)}
            >
              {option.value !== 'all' && (
                <View style={[styles.dot, { backgroundColor: option.color }]} />
              )}
              <Text
                style={[
                  styles.filterText,
                  isActive && { color: option.color, fontWeight: '700' },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sort Dropdown */}
      {showSort && (
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortOptions}
          >
            {SORT_OPTIONS.map((option) => {
              const isActive = sortBy === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sortPill,
                    isActive && styles.sortPillActive,
                  ]}
                  onPress={() => onSortChange(option.value)}
                >
                  <Text
                    style={[
                      styles.sortText,
                      isActive && styles.sortTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.sky100,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink600,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  sortLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink500,
    marginRight: spacing.sm,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sortPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: palette.sky100,
  },
  sortPillActive: {
    backgroundColor: palette.navy600,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '500',
    color: palette.ink600,
  },
  sortTextActive: {
    color: palette.white,
    fontWeight: '600',
  },
});
