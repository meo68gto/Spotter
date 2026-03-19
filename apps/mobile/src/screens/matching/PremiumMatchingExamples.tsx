/**
 * Example: Using PremiumMatchCard and FilterPanel Components
 * 
 * This file demonstrates how to use the new Premium Golf Matching UX components
 * introduced in EPIC 3.
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { PremiumMatchCard, PremiumMatchData } from '../../components/PremiumMatchCard';
import { FilterPanel, FilterState } from '../../components/FilterPanel';
import { spacing } from '../../theme/design';

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

export function PremiumMatchExample() {
  return (
    <ScrollView style={styles.container}>
      {/* Compact Card (for lists) */}
      <PremiumMatchCard
        match={exampleMatch}
        compact={true}
        onPress={() => console.log('View profile')}
        onConnect={() => console.log('Request intro')}
      />

      {/* Full Card (for detail views) */}
      <PremiumMatchCard
        match={exampleMatch}
        compact={false}
        onConnect={() => console.log('Request intro')}
      />
    </ScrollView>
  );
}

// ============================================================================
// Example 2: Filter Panel Usage
// ============================================================================

export function DiscoveryWithFiltersExample() {
  const [filters, setFilters] = useState<FilterState>({});

  const handleApplyFilters = () => {
    // Call discovery API with filters
    console.log('Applying filters:', filters);
  };

  const handleResetFilters = () => {
    setFilters({});
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
      />
      
      {/* Golfers list would go here */}
    </View>
  );
}

// ============================================================================
// Example 3: Full Discovery Screen with Premium Components
// ============================================================================

export function FullDiscoveryExample() {
  const [filters, setFilters] = useState<FilterState>({});
  const [matches, setMatches] = useState<PremiumMatchData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      // Call your API
      // const response = await invokeFunction('discovery-search', {
      //   method: 'POST',
      //   body: filters,
      // });
      // Transform response to PremiumMatchData[]
      // setMatches(transformedMatches);
    } finally {
      setLoading(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        onApply={fetchMatches}
        compact={true}
        activeCount={activeFilterCount}
      />

      <ScrollView>
        {matches.map((match) => (
          <PremiumMatchCard
            key={match.userId}
            match={match}
            compact={true}
            onPress={() => {
              // Navigate to detail view
            }}
            onConnect={() => {
              // Send connection request
            }}
          />
        ))}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
});

// ============================================================================
// Export for use in other files
// ============================================================================

export {
  transformDiscoverableGolferToPremiumMatch,
  transformMatchSuggestionToPremiumMatch,
};
