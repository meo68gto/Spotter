/**
 * Example: Using PremiumMatchCard and FilterPanel Components
 * 
 * This file demonstrates how to use the new Premium Golf Matching UX components
 * introduced in EPIC 3 - with all premium features enabled.
 */

import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { PremiumMatchCard, PremiumMatchData } from '../../components/PremiumMatchCard';
import { FilterPanel, FilterState } from '../../components/FilterPanel';
import { spacing } from '../theme/design';

// ============================================================================
// Example 1: Basic Premium Match Card (Compact)
// ============================================================================

const exampleMatch: PremiumMatchData = {
  userId: 'user-123',
  displayName: 'John Smith',
  avatarUrl: 'https://example.com/avatar.jpg',
  city: 'Scottsdale, AZ',
  tier: 'summit',
  overallScore: 87,
  matchTier: 'excellent',
  reputationScore: 92,
  reliabilityLabel: 'Highly Reliable',
  trustBadges: [
    { badge_type: 'verified', display_name: 'Verified' },
    { badge_type: 'active', display_name: 'Active Player' },
  ],
  golf: {
    handicap: 12.5,
    homeCourseName: 'TPC Scottsdale',
    yearsPlaying: 8,
    playingFrequency: 'Weekly',
  },
  professional: {
    company: 'Tech Corp',
    title: 'VP of Engineering',
    industry: 'Technology',
    yearsExperience: 15,
  },
  networking: {
    intent: 'business_social',
    preferredGroupSize: '4',
    openToIntros: true,
    preferredGolfArea: 'North Scottsdale',
  },
  factors: [
    {
      factor: 'handicap',
      label: 'Handicap Similarity',
      rawScore: 85,
      description: 'Within 5 strokes of your handicap',
    },
    {
      factor: 'networking_intent',
      label: 'Networking Intent',
      rawScore: 90,
      description: 'Both seeking business + social connections',
    },
    {
      factor: 'location',
      label: 'Location Proximity',
      rawScore: 75,
      description: '15 km away - nearby',
    },
    {
      factor: 'group_size',
      label: 'Group Size Preference',
      rawScore: 80,
      description: 'Both prefer foursomes',
    },
  ],
  reasoning: 'Strong compatibility in handicap and networking intent.',
  mutualConnections: 3,
  sharedCourses: 2,
  distanceKm: 15,
};

const exampleMatchFair: PremiumMatchData = {
  ...exampleMatch,
  userId: 'user-456',
  displayName: 'Sarah Johnson',
  tier: 'select',
  overallScore: 52,
  matchTier: 'fair',
  reputationScore: 65,
  golf: {
    handicap: 28,
    homeCourseName: 'Grayhawk Golf Club',
    yearsPlaying: 3,
    playingFrequency: 'Monthly',
  },
  professional: {
    company: 'Phoenix Realty',
    title: 'Senior Agent',
    industry: 'Real Estate',
  },
  factors: [
    {
      factor: 'location',
      label: 'Location Proximity',
      rawScore: 60,
      description: '32 km away',
    },
    {
      factor: 'networking_intent',
      label: 'Networking Intent',
      rawScore: 55,
      description: 'Open to business connections',
    },
  ],
  mutualConnections: 1,
  sharedCourses: 0,
  distanceKm: 32,
};

export function PremiumMatchExample() {
  const [savedMatches, setSavedMatches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const handleConnect = async (userId: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    Alert.alert('Success', `Connection request sent to ${userId}`);
  };

  const handleSave = async (userId: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setSavedMatches(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        Alert.alert('Removed', 'Match removed from saved list');
      } else {
        next.add(userId);
        Alert.alert('Saved', 'Match saved for later');
      }
      return next;
    });
  };

  const handleRequestIntro = (match: PremiumMatchData) => {
    Alert.alert(
      'Request Introduction',
      `Request an introduction to ${match.displayName} through a mutual connection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: () => {
            Alert.alert('Sent', 'Introduction request sent!');
          },
        },
      ]
    );
  };

  const handleInviteToRound = (match: PremiumMatchData) => {
    Alert.alert(
      'Invite to Round',
      `Invite ${match.displayName} to join your next round?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Invite',
          onPress: () => {
            Alert.alert('Sent', 'Round invitation sent!');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Excellent Match (Compact)</Text>
        <PremiumMatchCard
          match={exampleMatch}
          compact={true}
          onPress={() => console.log('View profile')}
          onConnect={() => handleConnect(exampleMatch.userId)}
          onSave={() => handleSave(exampleMatch.userId)}
          onRequestIntro={() => handleRequestIntro(exampleMatch)}
          onInviteToRound={() => handleInviteToRound(exampleMatch)}
          saved={savedMatches.has(exampleMatch.userId)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fair Match (Compact)</Text>
        <PremiumMatchCard
          match={exampleMatchFair}
          compact={true}
          onPress={() => console.log('View profile')}
          onConnect={() => handleConnect(exampleMatchFair.userId)}
          onSave={() => handleSave(exampleMatchFair.userId)}
          saved={savedMatches.has(exampleMatchFair.userId)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Excellent Match (Full Detail)</Text>
        <PremiumMatchCard
          match={exampleMatch}
          compact={false}
          onConnect={() => handleConnect(exampleMatch.userId)}
          onSave={() => handleSave(exampleMatch.userId)}
          onRequestIntro={() => handleRequestIntro(exampleMatch)}
          onInviteToRound={() => handleInviteToRound(exampleMatch)}
          saved={savedMatches.has(exampleMatch.userId)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Loading State</Text>
        <PremiumMatchCard
          match={exampleMatch}
          compact={true}
          loading={true}
        />
      </View>
    </ScrollView>
  );
}

// ============================================================================
// Example 2: Filter Panel Usage with Persistence
// ============================================================================

export function DiscoveryWithFiltersExample() {
  const [filters, setFilters] = useState<FilterState>({});
  const [savedFilters, setSavedFilters] = useState<FilterState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const handleApplyFilters = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      console.log('Applying filters:', filters);
      Alert.alert('Filters Applied', 'Discovery search updated with new filters');
    }, 1000);
  };

  const handleResetFilters = () => {
    setFilters({});
    Alert.alert('Reset', 'All filters have been cleared');
  };

  const handleSaveFilters = async (filtersToSave: FilterState) => {
    // Simulate API call to save filters
    await new Promise(resolve => setTimeout(resolve, 500));
    setSavedFilters(filtersToSave);
    console.log('Saved filters:', filtersToSave);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        compact={true}
        activeCount={activeFilterCount}
        loading={isLoading}
        savedFilters={savedFilters}
        onSaveFilters={handleSaveFilters}
      />
      
      {/* Golfers list would go here */}
      <View style={styles.placeholderList}>
        <Text style={styles.placeholderText}>Discovery results would appear here</Text>
        <Text style={styles.placeholderSubtext}>Active filters: {activeFilterCount}</Text>
      </View>
    </View>
  );
}

// ============================================================================
// Example 3: Full Discovery Screen with Premium Components
// ============================================================================

export function FullDiscoveryExample() {
  const [filters, setFilters] = useState<FilterState>({});
  const [matches, setMatches] = useState<PremiumMatchData>[]([]);
  const [loading, setLoading] = useState(false);
  const [savedFilters, setSavedFilters] = useState<FilterState | undefined>(undefined);
  const [savedMatches, setSavedMatches] = useState<Set<string>>(new Set());

  const fetchMatches = async () => {
    setLoading(true);
    try {
      // Simulate API response
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMatches([exampleMatch, exampleMatchFair]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFilters = async (filtersToSave: FilterState) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    setSavedFilters(filtersToSave);
  };

  const handleSaveMatch = async (userId: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setSavedMatches(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        onApply={fetchMatches}
        onReset={() => setFilters({})}
        compact={true}
        activeCount={activeFilterCount}
        savedFilters={savedFilters}
        onSaveFilters={handleSaveFilters}
      />

      <ScrollView>
        {loading ? (
          <>
            <PremiumMatchCard match={exampleMatch} compact={true} loading={true} />
            <PremiumMatchCard match={exampleMatch} compact={true} loading={true} />
          </>
        ) : (
          matches.map((match) => (
            <PremiumMatchCard
              key={match.userId}
              match={match}
              compact={true}
              onPress={() => {
                // Navigate to detail view
                console.log('View profile:', match.userId);
              }}
              onConnect={async () => {
                await new Promise(r => setTimeout(r, 500));
                Alert.alert('Connected', `Connected with ${match.displayName}`);
              }}
              onSave={() => handleSaveMatch(match.userId)}
              saved={savedMatches.has(match.userId)}
            />
          ))
        )}
        
        {!loading && matches.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No matches found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Example 4: Transforming API Response to PremiumMatchData
// ============================================================================

import { DiscoverableGolfer, MatchSuggestion } from '@spotter/types';

function transformDiscoverableGolferToPremiumMatch(
  golfer: DiscoverableGolfer
): PremiumMatchData {
  return {
    userId: golfer.user_id,
    displayName: golfer.display_name,
    avatarUrl: golfer.avatar_url,
    city: golfer.city,
    tier: golfer.tier_slug as 'free' | 'select' | 'summit',
    overallScore: golfer.compatibility_score,
    matchTier: golfer.compatibility_score >= 80 ? 'excellent' 
      : golfer.compatibility_score >= 60 ? 'good'
      : golfer.compatibility_score >= 40 ? 'fair'
      : 'poor',
    reputationScore: golfer.reputation_score,
    golf: golfer.golf ? {
      handicap: golfer.golf.handicap,
      homeCourseName: golfer.golf.home_course_name,
      yearsPlaying: golfer.golf.years_playing,
      playingFrequency: golfer.golf.playing_frequency,
    } : undefined,
    professional: golfer.professional ? {
      company: golfer.professional.company,
      title: golfer.professional.title,
      industry: golfer.professional.industry,
      yearsExperience: golfer.professional.years_experience,
    } : undefined,
    networking: golfer.networking_preferences ? {
      intent: golfer.networking_preferences.networking_intent || 'business_social',
      preferredGroupSize: golfer.networking_preferences.preferred_group_size || 'any',
      openToIntros: golfer.networking_preferences.open_to_intros ?? true,
      preferredGolfArea: golfer.networking_preferences.preferred_golf_area,
    } : undefined,
    factors: [], // Would come from match calculation API
    reasoning: `Compatibility score: ${Math.round(golfer.compatibility_score)}%`,
    mutualConnections: 0, // Would come from connections API
    sharedCourses: 0, // Would come from rounds API
    distanceKm: undefined, // Would come from location API
  };
}

function transformMatchSuggestionToPremiumMatch(
  suggestion: MatchSuggestion
): PremiumMatchData {
  return {
    userId: suggestion.user.id,
    displayName: suggestion.user.displayName,
    avatarUrl: suggestion.user.avatarUrl,
    city: suggestion.user.city,
    tier: suggestion.user.tier || 'free',
    overallScore: suggestion.matchScore.overallScore,
    matchTier: suggestion.matchScore.tier,
    reputationScore: suggestion.reputationScore || 50,
    golf: suggestion.golf ? {
      handicap: suggestion.golf.handicap,
      homeCourseName: suggestion.golf.homeCourseName,
      yearsPlaying: suggestion.golf.yearsPlaying,
    } : undefined,
    professional: suggestion.professional ? {
      company: suggestion.professional.company,
      title: suggestion.professional.title,
      industry: suggestion.professional.industry,
    } : undefined,
    networking: suggestion.networking ? {
      intent: suggestion.networking.intent,
      preferredGroupSize: suggestion.networking.preferredGroupSize,
      openToIntros: suggestion.networking.openToIntros,
      preferredGolfArea: suggestion.networking.preferredGolfArea,
    } : undefined,
    factors: suggestion.matchScore.factors.map(f => ({
      factor: f.factor,
      label: f.label,
      rawScore: f.rawScore,
      description: f.description,
    })),
    reasoning: suggestion.matchScore.reasoning,
    mutualConnections: suggestion.mutualConnections,
    sharedCourses: suggestion.sharedCourses,
    distanceKm: suggestion.distanceKm,
  };
}

// ============================================================================
// Styles
// ============================================================================

import { Text } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B3A53',
    marginBottom: spacing.sm,
  },
  placeholderList: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  placeholderText: {
    fontSize: 14,
    color: '#5E6C75',
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#8B9599',
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5E6C75',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8B9599',
    marginTop: spacing.xs,
  },
});

// ============================================================================
// Export for use in other files
// ============================================================================

export {
  transformDiscoverableGolferToPremiumMatch,
  transformMatchSuggestionToPremiumMatch,
};
