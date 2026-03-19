import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from './Card';
import { TierBadge, TierSlug } from './TierBadge';
import { Button } from './Button';
import { palette, radius, spacing } from '../theme/design';

// ============================================================================
// Types
// ============================================================================

export interface GolfIdentity {
  handicap?: number;
  homeCourseName?: string;
  yearsPlaying?: number;
  playingFrequency?: string;
}

export interface ProfessionalIdentity {
  company?: string;
  title?: string;
  industry?: string;
  yearsExperience?: number;
}

export interface NetworkingPreferences {
  intent: string;
  preferredGroupSize: string;
  openToIntros: boolean;
  preferredGolfArea?: string;
}

export interface MatchFactor {
  factor: string;
  label: string;
  rawScore: number;
  description: string;
}

export interface PremiumMatchData {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  city?: string;
  tier: TierSlug;
  overallScore: number;
  matchTier: 'excellent' | 'good' | 'fair' | 'poor';
  golf?: GolfIdentity;
  professional?: ProfessionalIdentity;
  networking?: NetworkingPreferences;
  reputationScore: number;
  // Epic 6: Trust & Reliability
  reliabilityLabel?: string;
  trustBadges?: { badge_type: string; display_name: string }[];
  factors: MatchFactor[];
  reasoning: string;
  mutualConnections: number;
  sharedCourses: number;
  distanceKm?: number;
}

interface PremiumMatchCardProps {
  match: PremiumMatchData;
  onPress?: () => void;
  onConnect?: () => void;
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getTierColor = (tier: string): string => {
  switch (tier) {
    case 'excellent':
      return '#059669'; // green
    case 'good':
      return '#0891b2'; // cyan
    case 'fair':
      return '#d97706'; // amber
    default:
      return '#6b7280'; // gray
  }
};

const getTierLabel = (tier: string): string => {
  switch (tier) {
    case 'excellent':
      return 'Excellent Match';
    case 'good':
      return 'Good Match';
    case 'fair':
      return 'Fair Match';
    default:
      return 'Poor Match';
  }
};

const getTopFitReasons = (factors: MatchFactor[]): string[] => {
  // Sort by raw score and take top 3
  const sorted = [...factors].sort((a, b) => b.rawScore - a.rawScore);
  const topFactors = sorted.slice(0, 3).filter(f => f.rawScore >= 60);
  
  return topFactors.map(f => {
    if (f.factor === 'handicap') {
      return `⛳ ${f.label}: ${f.description}`;
    } else if (f.factor === 'networking_intent') {
      return `🤝 ${f.label}: ${f.description}`;
    } else if (f.factor === 'location') {
      return `📍 ${f.label}: ${f.description}`;
    } else if (f.factor === 'group_size') {
      return `👥 ${f.label}: ${f.description}`;
    }
    return `${f.label}: ${f.description}`;
  });
};

// ============================================================================
// Sub-Components
// ============================================================================

const MatchScoreCircle: React.FC<{ score: number; matchTier: string; size?: 'sm' | 'md' | 'lg' }> = ({ 
  score, 
  matchTier,
  size = 'md' 
}) => {
  const tierColor = getTierColor(matchTier);
  const sizeStyles = {
    sm: { width: 44, height: 44, borderWidth: 2, fontSize: 16, percentSize: 9 },
    md: { width: 56, height: 56, borderWidth: 3, fontSize: 20, percentSize: 10 },
    lg: { width: 72, height: 72, borderWidth: 4, fontSize: 28, percentSize: 12 },
  };
  const s = sizeStyles[size];

  return (
    <View style={[styles.scoreCircle, { 
      width: s.width, 
      height: s.height, 
      borderWidth: s.borderWidth,
      borderColor: tierColor 
    }]}>
      <Text style={[styles.scoreValue, { color: tierColor, fontSize: s.fontSize }]}>
        {Math.round(score)}
      </Text>
      <Text style={[styles.scorePercent, { fontSize: s.percentSize }]}>%</Text>
    </View>
  );
};

const ReputationBadge: React.FC<{ score: number }> = ({ score }) => {
  let color = palette.ink500;
  let label = 'New';
  
  if (score >= 90) {
    color = '#059669';
    label = 'Exceptional';
  } else if (score >= 75) {
    color = '#0891b2';
    label = 'Trusted';
  } else if (score >= 50) {
    color = '#d97706';
    label = 'Reliable';
  } else if (score > 0) {
    color = '#6b7280';
    label = 'Building';
  }

  return (
    <View style={[styles.reputationBadge, { borderColor: color }]}>
      <Text style={[styles.reputationText, { color }]}>★ {label}</Text>
    </View>
  );
};

const GolfIdentitySection: React.FC<{ golf?: GolfIdentity }> = ({ golf }) => {
  if (!golf) return null;

  return (
    <View style={styles.identitySection}>
      <Text style={styles.sectionLabel}>⛳ Golf Identity</Text>
      <View style={styles.identityRow}>
        {golf.handicap !== undefined && (
          <View style={styles.identityItem}>
            <Text style={styles.identityValue}>{golf.handicap}</Text>
            <Text style={styles.identityLabel}>Handicap</Text>
          </View>
        )}
        {golf.yearsPlaying !== undefined && (
          <View style={styles.identityItem}>
            <Text style={styles.identityValue}>{golf.yearsPlaying}y</Text>
            <Text style={styles.identityLabel}>Experience</Text>
          </View>
        )}
        {golf.playingFrequency && (
          <View style={styles.identityItem}>
            <Text style={styles.identityValue} numberOfLines={1}>
              {golf.playingFrequency}
            </Text>
            <Text style={styles.identityLabel}>Frequency</Text>
          </View>
        )}
        {golf.homeCourseName && (
          <View style={[styles.identityItem, { flex: 2 }]}>
            <Text style={styles.identityValue} numberOfLines={1}>
              {golf.homeCourseName}
            </Text>
            <Text style={styles.identityLabel}>Home Course</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const ProfessionalSection: React.FC<{ professional?: ProfessionalIdentity }> = ({ professional }) => {
  if (!professional || (!professional.company && !professional.title)) return null;

  return (
    <View style={styles.identitySection}>
      <Text style={styles.sectionLabel}>💼 Professional</Text>
      <View style={styles.professionalContent}>
        {professional.title && (
          <Text style={styles.professionalTitle}>{professional.title}</Text>
        )}
        {professional.company && (
          <Text style={styles.professionalCompany}>{professional.company}</Text>
        )}
        {professional.industry && (
          <Text style={styles.professionalMeta}>{professional.industry}</Text>
        )}
      </View>
    </View>
  );
};

const NetworkingSection: React.FC<{ networking?: NetworkingPreferences }> = ({ networking }) => {
  if (!networking) return null;

  const intentLabels: Record<string, string> = {
    business: 'Business',
    social: 'Social',
    competitive: 'Competitive',
    business_social: 'Business + Social',
  };

  return (
    <View style={styles.identitySection}>
      <Text style={styles.sectionLabel}>🤝 Networking</Text>
      <View style={styles.networkingRow}>
        <View style={styles.networkingItem}>
          <Text style={styles.networkingValue}>{intentLabels[networking.intent] || networking.intent}</Text>
          <Text style={styles.networkingLabel}>Intent</Text>
        </View>
        <View style={styles.networkingItem}>
          <Text style={styles.networkingValue}>{networking.preferredGroupSize === 'any' ? 'Any' : `${networking.preferredGroupSize}-some`}</Text>
          <Text style={styles.networkingLabel}>Group Size</Text>
        </View>
        <View style={styles.networkingItem}>
          <Text style={styles.networkingValue}>{networking.openToIntros ? '✓ Yes' : '✗ No'}</Text>
          <Text style={styles.networkingLabel}>Open to Intros</Text>
        </View>
      </View>
    </View>
  );
};

const FitReasonsSection: React.FC<{ factors: MatchFactor[] }> = ({ factors }) => {
  const reasons = getTopFitReasons(factors);
  
  if (reasons.length === 0) return null;

  return (
    <View style={styles.fitReasonsSection}>
      <Text style={styles.sectionLabel}>✨ Why This Match</Text>
      {reasons.map((reason, index) => (
        <Text key={index} style={styles.fitReason} numberOfLines={2}>
          {reason}
        </Text>
      ))}
    </View>
  );
};

const QuickStats: React.FC<{ 
  mutualConnections: number; 
  sharedCourses: number; 
  distanceKm?: number;
}> = ({ mutualConnections, sharedCourses, distanceKm }) => {
  return (
    <View style={styles.quickStats}>
      {mutualConnections > 0 && (
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{mutualConnections}</Text>
          <Text style={styles.statLabel}>Mutual</Text>
        </View>
      )}
      {sharedCourses > 0 && (
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{sharedCourses}</Text>
          <Text style={styles.statLabel}>Shared Courses</Text>
        </View>
      )}
      {distanceKm !== undefined && (
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{distanceKm < 10 ? '<10' : Math.round(distanceKm)}</Text>
          <Text style={styles.statLabel}>km Away</Text>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export function PremiumMatchCard({ match, onPress, onConnect, compact = false }: PremiumMatchCardProps) {
  const tierColor = getTierColor(match.matchTier);

  if (compact) {
    // Compact version for list views
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <Card>
          <View style={styles.compactContainer}>
            <View style={styles.compactHeader}>
              <View style={styles.avatarContainer}>
                {match.avatarUrl ? (
                  <Image source={{ uri: match.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{match.displayName.charAt(0)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.compactInfo}>
                <Text style={styles.compactName}>{match.displayName}</Text>
                {match.city && <Text style={styles.compactLocation}>{match.city}</Text>}
                <View style={styles.compactBadges}>
                  <TierBadge tier={match.tier} size="sm" />
                  <ReputationBadge score={match.reputationScore} />
                </View>
              </View>
              <MatchScoreCircle score={match.overallScore} matchTier={match.matchTier} size="md" />
            </View>
            
            <QuickStats 
              mutualConnections={match.mutualConnections}
              sharedCourses={match.sharedCourses}
              distanceKm={match.distanceKm}
            />
            
            {match.factors.length > 0 && (
              <Text style={styles.compactReasoning} numberOfLines={2}>
                {match.reasoning}
              </Text>
            )}
            
            {onConnect && (
              <Button title="Connect" onPress={onConnect} tone="primary" />
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  }

  // Full version for detail views
  return (
    <Card>
      <View style={styles.fullContainer}>
        {/* Header with Avatar and Score */}
        <View style={styles.fullHeader}>
          <View style={styles.fullAvatarSection}>
            {match.avatarUrl ? (
              <Image source={{ uri: match.avatarUrl }} style={styles.fullAvatar} />
            ) : (
              <View style={styles.fullAvatarPlaceholder}>
                <Text style={styles.fullAvatarInitial}>{match.displayName.charAt(0)}</Text>
              </View>
            )}
            <View style={styles.headerBadges}>
              <TierBadge tier={match.tier} size="md" />
              <ReputationBadge score={match.reputationScore} />
            </View>
          </View>
          
          <View style={styles.fullInfo}>
            <Text style={styles.fullName}>{match.displayName}</Text>
            {match.city && <Text style={styles.fullLocation}>{match.city}</Text>}
            <View style={styles.matchTierBadge}>
              <Text style={[styles.matchTierText, { color: tierColor }]}>
                {getTierLabel(match.matchTier)}
              </Text>
            </View>
          </View>
          
          <MatchScoreCircle score={match.overallScore} matchTier={match.tier} size="lg" />
        </View>

        {/* Quick Stats */}
        <QuickStats 
          mutualConnections={match.mutualConnections}
          sharedCourses={match.sharedCourses}
          distanceKm={match.distanceKm}
        />

        {/* Identity Sections */}
        <GolfIdentitySection golf={match.golf} />
        <ProfessionalSection professional={match.professional} />
        <NetworkingSection networking={match.networking} />

        {/* Fit Reasons */}
        <FitReasonsSection factors={match.factors} />

        {/* Actions */}
        {onConnect && (
          <View style={styles.actions}>
            <Button title="Request Introduction" onPress={onConnect} tone="primary" />
            {onPress && (
              <Button title="View Full Profile" onPress={onPress} tone="secondary" />
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Compact styles
  compactContainer: {
    gap: spacing.sm,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  compactLocation: {
    fontSize: 13,
    color: palette.ink700,
    marginTop: 2,
  },
  compactBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  compactReasoning: {
    fontSize: 13,
    color: palette.ink700,
    lineHeight: 18,
  },

  // Full styles
  fullContainer: {
    gap: spacing.md,
  },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  fullAvatarSection: {
    alignItems: 'center',
  },
  fullAvatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
  fullAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  fullAvatarInitial: {
    color: palette.white,
    fontSize: 32,
    fontWeight: '700',
  },
  headerBadges: {
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  fullInfo: {
    flex: 1,
  },
  fullName: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink900,
  },
  fullLocation: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 2,
  },
  matchTierBadge: {
    marginTop: spacing.xs,
  },
  matchTierText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Shared
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
  scoreCircle: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontWeight: '800',
  },
  scorePercent: {
    fontWeight: '600',
    color: palette.ink500,
    marginTop: -2,
  },
  reputationBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  reputationText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Quick stats
  quickStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.sky200,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  statLabel: {
    fontSize: 11,
    color: palette.ink500,
    textTransform: 'uppercase',
  },

  // Identity sections
  identitySection: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.ink500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  identityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  identityItem: {
    flex: 1,
  },
  identityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  identityLabel: {
    fontSize: 11,
    color: palette.ink500,
    marginTop: 2,
  },

  // Professional
  professionalContent: {
    gap: 2,
  },
  professionalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink900,
  },
  professionalCompany: {
    fontSize: 14,
    color: palette.ink700,
  },
  professionalMeta: {
    fontSize: 12,
    color: palette.ink500,
  },

  // Networking
  networkingRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  networkingItem: {
    flex: 1,
  },
  networkingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  networkingLabel: {
    fontSize: 11,
    color: palette.ink500,
    marginTop: 2,
  },

  // Fit reasons
  fitReasonsSection: {
    gap: spacing.xs,
  },
  fitReason: {
    fontSize: 13,
    color: palette.ink700,
    lineHeight: 18,
  },

  // Actions
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
