import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { palette, spacing, radius, font, isWeb } from '../../theme/design';
import {
  Button,
  EmptyState,
  FilterChip,
  PlayerCard,
  SkeletonLoader,
} from '../../components';
import { useQuickMatch } from '../hooks';
import { useSession } from '../../contexts/SessionContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Sport = 'Tennis' | 'Pickleball' | 'Golf' | 'Basketball' | 'Soccer' | 'Padel';
type DistanceOption = '1mi' | '5mi' | '10mi' | 'Any';
type SkillLevel = 'Any' | 'Beginner' | 'Intermediate' | 'Advanced';

const SPORTS: { label: Sport; icon: string }[] = [
  { label: 'Tennis', icon: 'tennisball-outline' },
  { label: 'Pickleball', icon: 'sparkles-outline' },
  { label: 'Golf', icon: 'golf-outline' },
  { label: 'Basketball', icon: 'basketball-outline' },
  { label: 'Soccer', icon: 'football-outline' },
  { label: 'Padel', icon: 'grid-outline' },
];

const DISTANCE_OPTIONS: DistanceOption[] = ['1mi', '5mi', '10mi', 'Any'];
const SKILL_LEVELS: SkillLevel[] = ['Any', 'Beginner', 'Intermediate', 'Advanced'];

const DISTANCE_VALUE_MAP: Record<DistanceOption, number | undefined> = {
  '1mi': 1,
  '5mi': 5,
  '10mi': 10,
  Any: undefined,
};

const PLAYER_CARD_WIDTH = SCREEN_WIDTH * 0.58;

export default function QuickMatchSheet() {
  const navigation = useNavigation<any>();
  const { session } = useSession();

  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<DistanceOption>('5mi');
  const [rightNow, setRightNow] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillLevel>('Any');
  const [hasSearched, setHasSearched] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const { players, loading, error, search } = useQuickMatch();

  const handleFindPartners = useCallback(async () => {
    if (!selectedSport) return;
    await search({
      sport: selectedSport,
      radiusMiles: DISTANCE_VALUE_MAP[selectedDistance],
      availableNow: rightNow,
      skillLevel: selectedSkill === 'Any' ? undefined : selectedSkill,
    });
    setHasSearched(true);
    // Scroll down to show results
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }, [selectedSport, selectedDistance, rightNow, selectedSkill, search]);

  const handleViewOnMap = useCallback(() => {
    navigation.navigate('DiscoverMap', {
      sport: selectedSport,
      distance: DISTANCE_VALUE_MAP[selectedDistance],
      availableNow: rightNow,
      skillLevel: selectedSkill === 'Any' ? undefined : selectedSkill,
    });
  }, [navigation, selectedSport, selectedDistance, rightNow, selectedSkill]);

  const handlePlayerPress = useCallback(
    (playerId: string) => {
      navigation.navigate('PlayerProfile', { playerId });
    },
    [navigation]
  );

  const canSearch = selectedSport !== null;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* HANDLE BAR */}
      <View style={styles.handleContainer}>
        <View style={styles.handleBar} />
      </View>

      {/* HEADING */}
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Find a Partner</Text>
        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={20} color={palette.ink500} />
        </Pressable>
      </View>

      {/* SPORT SELECTOR */}
      <Text style={styles.sectionLabel}>Choose a sport</Text>
      <View style={styles.sportGrid}>
        {SPORTS.map(({ label, icon }) => (
          <Pressable
            key={label}
            style={[
              styles.sportChip,
              selectedSport === label && styles.sportChipActive,
            ]}
            onPress={() => setSelectedSport(label)}
          >
            <Ionicons
              name={icon as any}
              size={22}
              color={selectedSport === label ? palette.white : palette.navy600}
            />
            <Text
              style={[
                styles.sportChipLabel,
                selectedSport === label && styles.sportChipLabelActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* DISTANCE */}
      <Text style={styles.sectionLabel}>Distance</Text>
      <View style={styles.pillRow}>
        {DISTANCE_OPTIONS.map((opt) => (
          <Pressable
            key={opt}
            style={[
              styles.distancePill,
              selectedDistance === opt && styles.distancePillActive,
            ]}
            onPress={() => setSelectedDistance(opt)}
          >
            <Text
              style={[
                styles.distancePillLabel,
                selectedDistance === opt && styles.distancePillLabelActive,
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* AVAILABILITY */}
      <Text style={styles.sectionLabel}>Availability</Text>
      <Pressable
        style={[styles.availabilityToggle, rightNow && styles.availabilityToggleActive]}
        onPress={() => setRightNow((v) => !v)}
      >
        <View style={styles.availabilityLeft}>
          <Ionicons
            name={rightNow ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={rightNow ? palette.white : palette.navy600}
          />
          <Text
            style={[
              styles.availabilityLabel,
              rightNow && styles.availabilityLabelActive,
            ]}
          >
            Right now
          </Text>
        </View>
        <View
          style={[
            styles.toggleDot,
            rightNow ? styles.toggleDotOn : styles.toggleDotOff,
          ]}
        />
      </Pressable>

      {/* SKILL LEVEL */}
      <Text style={styles.sectionLabel}>Skill level</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.skillRow}
      >
        {SKILL_LEVELS.map((skill) => (
          <FilterChip
            key={skill}
            label={skill}
            active={selectedSkill === skill}
            onPress={() => setSelectedSkill(skill)}
            style={{ marginRight: spacing.sm }}
          />
        ))}
      </ScrollView>

      {/* FIND BUTTON */}
      <View style={styles.findButtonWrapper}>
        <Button
          label={loading ? 'Searching...' : 'Find Partners'}
          variant="primary"
          size="lg"
          onPress={handleFindPartners}
          disabled={!canSearch || loading}
          fullWidth
          icon={loading ? undefined : 'search-outline'}
        />
        {!canSearch && (
          <Text style={styles.hintText}>Select a sport to search</Text>
        )}
      </View>

      {/* RESULTS */}
      {hasSearched && (
        <View style={styles.resultsSection}>
          {/* Divider */}
          <View style={styles.resultsDivider} />

          {loading ? (
            <>
              <View style={styles.overlineRow}>
                <SkeletonLoader width={120} height={12} borderRadius={radius.sm} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonLoader
                    key={i}
                    width={PLAYER_CARD_WIDTH}
                    height={200}
                    borderRadius={radius.lg}
                    style={{ marginRight: spacing.md }}
                  />
                ))}
              </ScrollView>
            </>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={28} color={palette.red500} />
              <Text style={styles.errorText}>Search failed. Please try again.</Text>
              <Button
                label="Retry"
                variant="secondary"
                size="sm"
                onPress={handleFindPartners}
                style={{ marginTop: spacing.md }}
              />
            </View>
          ) : players.length === 0 ? (
            <EmptyState
              icon="person-outline"
              title="No results"
              subtitle="Try expanding your radius or adjusting your filters"
            />
          ) : (
            <>
              {/* Overline count */}
              <View style={styles.overlineRow}>
                <Text style={styles.overline}>
                  {players.length} PLAYER{players.length !== 1 ? 'S' : ''} FOUND
                </Text>
              </View>

              {/* Horizontal player cards */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {players.slice(0, 4).map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    onPress={() => handlePlayerPress(player.id)}
                    style={{ width: PLAYER_CARD_WIDTH, marginRight: spacing.md }}
                  />
                ))}
              </ScrollView>

              {/* View all on map */}
              <Pressable style={styles.viewOnMapLink} onPress={handleViewOnMap}>
                <Ionicons name="map-outline" size={15} color={palette.navy600} />
                <Text style={styles.viewOnMapText}>View all on map</Text>
                <Ionicons name="arrow-forward" size={14} color={palette.navy600} />
              </Pressable>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
  },
  scrollContent: {
    paddingBottom: spacing.xxl * 2,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: palette.gray200,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heading: {
    fontFamily: font.bold,
    fontSize: 22,
    color: palette.ink900,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: palette.ink500,
    letterSpacing: 0.3,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: palette.gray200,
    backgroundColor: palette.white,
    paddingHorizontal: spacing.md,
  },
  sportChipActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  sportChipLabel: {
    fontFamily: font.medium,
    fontSize: 15,
    color: palette.ink900,
  },
  sportChipLabelActive: {
    color: palette.white,
  },
  pillRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  distancePill: {
    flex: 1,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: palette.gray200,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distancePillActive: {
    backgroundColor: palette.navy50,
    borderColor: palette.navy600,
  },
  distancePillLabel: {
    fontFamily: font.medium,
    fontSize: 13,
    color: palette.ink700,
  },
  distancePillLabelActive: {
    color: palette.navy600,
    fontFamily: font.semibold,
  },
  availabilityToggle: {
    marginHorizontal: spacing.lg,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: palette.gray200,
    backgroundColor: palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  availabilityToggleActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  availabilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  availabilityLabel: {
    fontFamily: font.medium,
    fontSize: 15,
    color: palette.ink900,
  },
  availabilityLabelActive: {
    color: palette.white,
  },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleDotOn: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 2,
    borderColor: palette.white,
  },
  toggleDotOff: {
    backgroundColor: palette.gray200,
  },
  skillRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  findButtonWrapper: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  hintText: {
    fontFamily: font.regular,
    fontSize: 12,
    color: palette.ink400,
    textAlign: 'center',
  },
  resultsSection: {
    marginTop: spacing.xl,
  },
  resultsDivider: {
    height: 1,
    backgroundColor: palette.gray100,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  overlineRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  overline: {
    fontFamily: font.bold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: palette.ink500,
  },
  horizontalScroll: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingBottom: spacing.md,
  },
  viewOnMapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  viewOnMapText: {
    fontFamily: font.medium,
    fontSize: 14,
    color: palette.navy600,
    flex: 1,
  },
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  errorText: {
    fontFamily: font.medium,
    fontSize: 14,
    color: palette.ink700,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
