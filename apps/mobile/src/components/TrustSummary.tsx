// Epic 6: Trust Summary Component
// Displays reliability score, badges, vouches, and rounds completed

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ReliabilityIndicator } from './ReliabilityIndicator';
import { TrustBadgeDisplay } from './TrustBadgeDisplay';
import { TrustBadge, ReliabilityBreakdown } from '@spotter/types';
import { palette, radius, spacing } from '../theme/design';

// ============================================================================
// Types
// ============================================================================

export interface TrustSummaryData {
  reliabilityScore: number;
  reliabilityLabel: string;
  showRate: number;
  punctualityRate: number;
  roundsCompleted: number;
  roundsScheduled: number;
  vouchesReceived: number;
  badges: TrustBadge[];
}

interface TrustSummaryProps {
  data: TrustSummaryData | null;
  loading?: boolean;
  size?: 'compact' | 'full';
  onPress?: () => void;
  showVouchButton?: boolean;
  onVouchPress?: () => void;
  canVouch?: boolean;
  sharedRoundsCount?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getReliabilityDescription = (label: string): string => {
  const descriptions: Record<string, string> = {
    'Exceptional': 'Top 5% - Highly reliable player',
    'Trusted': 'Consistently reliable and punctual',
    'Reliable': 'Good track record of showing up',
    'Building': 'New player - building reputation',
  };
  return descriptions[label] || 'Building reputation';
};

const getShowRateColor = (rate: number): string => {
  if (rate >= 95) return '#059669';
  if (rate >= 80) return '#0891b2';
  if (rate >= 60) return '#d97706';
  return '#6b7280';
};

const getPunctualityColor = (rate: number): string => {
  if (rate >= 95) return '#059669';
  if (rate >= 80) return '#0891b2';
  if (rate >= 60) return '#d97706';
  return '#6b7280';
};

// ============================================================================
// Sub-Components
// ============================================================================

const StatRow: React.FC<{ label: string; value: string | number; color?: string }> = ({ 
  label, 
  value, 
  color 
}) => (
  <View style={styles.statRow}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, color && { color }]}>{value}</Text>
  </View>
);

const MetricBadge: React.FC<{ 
  label: string; 
  value: number; 
  suffix?: string;
  color: string;
}> = ({ label, value, suffix = '%', color }) => (
  <View style={[styles.metricBadge, { borderColor: color }]}>
    <Text style={[styles.metricValue, { color }]}>
      {Math.round(value)}{suffix}
    </Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

// ============================================================================
// Compact Version
// ============================================================================

const CompactTrustSummary: React.FC<TrustSummaryProps> = ({ 
  data, 
  onPress,
  showVouchButton,
  onVouchPress,
  canVouch,
  sharedRoundsCount,
}) => {
  if (!data) {
    return (
      <TouchableOpacity onPress={onPress} style={styles.compactContainer}>
        <View style={styles.compactEmpty}>
          <Text style={styles.compactEmptyText}>No trust data yet</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} style={styles.compactContainer}>
      <View style={styles.compactRow}>
        <ReliabilityIndicator 
          score={data.reliabilityScore} 
          label={data.reliabilityLabel}
          size="sm"
          showLabel={false}
        />
        <View style={styles.compactStats}>
          <Text style={styles.compactLabel}>{data.reliabilityLabel}</Text>
          <View style={styles.compactMetrics}>
            <Text style={styles.compactMetric}>★ {data.vouchesReceived} vouches</Text>
            <Text style={styles.compactMetric}>⛳ {data.roundsCompleted} rounds</Text>
          </View>
        </View>
        {showVouchButton && (
          <TouchableOpacity 
            style={[
              styles.vouchButton,
              !canVouch && styles.vouchButtonDisabled
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onVouchPress?.();
            }}
            disabled={!canVouch}
          >
            <Text style={styles.vouchButtonText}>
              {canVouch ? 'Vouch' : `${sharedRoundsCount || 0}/3 rounds`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// Full Version
// ============================================================================

const FullTrustSummary: React.FC<TrustSummaryProps> = ({ 
  data, 
  showVouchButton,
  onVouchPress,
  canVouch,
  sharedRoundsCount,
}) => {
  if (!data) {
    return (
      <View style={styles.fullContainer}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyTitle}>Building Trust</Text>
          <Text style={styles.emptyText}>
            Complete rounds and receive vouches to build your reliability score.
          </Text>
        </View>
      </View>
    );
  }

  const showRateColor = getShowRateColor(data.showRate);
  const punctualityColor = getPunctualityColor(data.punctualityRate);

  return (
    <View style={styles.fullContainer}>
      {/* Header with Score */}
      <View style={styles.headerRow}>
        <ReliabilityIndicator 
          score={data.reliabilityScore} 
          label={data.reliabilityLabel}
          size="lg"
        />
        <View style={styles.headerInfo}>
          <Text style={styles.reliabilityTitle}>{data.reliabilityLabel}</Text>
          <Text style={styles.reliabilityDescription}>
            {getReliabilityDescription(data.reliabilityLabel)}
          </Text>
          {showVouchButton && (
            <TouchableOpacity 
              style={[
                styles.vouchButtonLarge,
                !canVouch && styles.vouchButtonDisabled
              ]}
              onPress={onVouchPress}
              disabled={!canVouch}
            >
              <Text style={styles.vouchButtonTextLarge}>
                {canVouch ? '🤝 Give Vouch' : `Play ${3 - (sharedRoundsCount || 0)} more rounds to vouch`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsRow}>
        <MetricBadge 
          label="Show Rate" 
          value={data.showRate} 
          color={showRateColor}
        />
        <MetricBadge 
          label="Punctuality" 
          value={data.punctualityRate} 
          color={punctualityColor}
        />
        <MetricBadge 
          label="Rounds" 
          value={data.roundsCompleted} 
          suffix=""
          color={palette.navy600}
        />
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatRow 
          label="Rounds Completed" 
          value={data.roundsCompleted} 
        />
        <StatRow 
          label="Rounds Scheduled" 
          value={data.roundsScheduled} 
        />
        <StatRow 
          label="Show Rate" 
          value={`${Math.round(data.showRate)}%`}
          color={showRateColor}
        />
        <StatRow 
          label="Punctuality" 
          value={`${Math.round(data.punctualityRate)}%`}
          color={punctualityColor}
        />
        <StatRow 
          label="Vouches Received" 
          value={data.vouchesReceived}
        />
      </View>

      {/* Trust Badges */}
      {data.badges.length > 0 && (
        <View style={styles.badgesSection}>
          <Text style={styles.badgesTitle}>Trust Badges</Text>
          <TrustBadgeDisplay badges={data.badges} size="md" maxDisplay={5} />
        </View>
      )}
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export function TrustSummary(props: TrustSummaryProps) {
  const { size = 'full' } = props;

  if (size === 'compact') {
    return <CompactTrustSummary {...props} />;
  }

  return <FullTrustSummary {...props} />;
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Compact styles
  compactContainer: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  compactStats: {
    flex: 1,
  },
  compactLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
  },
  compactMetrics: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  compactMetric: {
    fontSize: 12,
    color: palette.ink500,
  },
  compactEmpty: {
    padding: spacing.md,
    alignItems: 'center',
  },
  compactEmptyText: {
    fontSize: 14,
    color: palette.ink500,
  },

  // Vouch button
  vouchButton: {
    backgroundColor: palette.navy600,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  vouchButtonDisabled: {
    backgroundColor: palette.sky200,
  },
  vouchButtonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  vouchButtonLarge: {
    backgroundColor: palette.navy600,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  vouchButtonTextLarge: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // Full styles
  fullContainer: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  reliabilityTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink900,
  },
  reliabilityDescription: {
    fontSize: 14,
    color: palette.ink600,
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  metricBadge: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.white,
    borderWidth: 2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: spacing.xs,
  },

  // Stats grid
  statsGrid: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  statLabel: {
    fontSize: 14,
    color: palette.ink600,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
  },

  // Badges section
  badgesSection: {
    marginTop: spacing.sm,
  },
  badgesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink800,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
    lineHeight: 20,
  },
});
