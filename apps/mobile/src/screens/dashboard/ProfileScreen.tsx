import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TierBadge } from '../../components/TierBadge';
import { invokeFunction } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { hasAccess, TierSlug } from '@spotter/types';

type Props = {
  session: Session;
  email: string;
  onSignOut: () => void;
};

type FeedbackSummary = {
  userId: string;
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  positiveRatio: number;
  topTags: string[];
};

interface UserProfile {
  id: string;
  display_name: string;
  tier_slug: TierSlug;
  profile_visibility?: 'visible' | 'select_only' | 'summit_only';
  hunt_mode_enabled?: boolean;
  search_boosted?: boolean;
}

export function ProfileScreen({ session, email, onSignOut }: Props) {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [feedbackPayload, profileData] = await Promise.all([
          invokeFunction<{ data: FeedbackSummary[] }>('profiles-feedback-summary', {
            method: 'POST',
            body: { userIds: [session.user.id] }
          }),
          loadUserProfile(),
        ]);
        setFeedback(feedbackPayload.data?.[0] ?? null);
        setProfile(profileData);
      } catch {
        // Non-critical — leave loading=false and show defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session.user.id]);

  const loadUserProfile = async (): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, tier_slug, profile_visibility, hunt_mode_enabled, search_boosted')
        .eq('id', session.user.id)
        .single();
      if (error || !data) return null;
      return data as UserProfile;
    } catch {
      return null;
    }
  };

  const updateProfileVisibility = async (visibility: 'visible' | 'select_only' | 'summit_only') => {
    if (!profile) return;
    setUpdatingVisibility(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          profile_visibility: visibility,
          appear_in_lower_tier_search: visibility === 'visible',
        })
        .eq('id', session.user.id);
      if (error) throw error;
      setProfile((prev) => prev ? { ...prev, profile_visibility: visibility } : prev);
    } catch (err) {
      console.error('Failed to update visibility:', err);
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const userTier = profile?.tier_slug ?? 'free';
  const isSummit = userTier === 'summit';
  const isSelect = userTier === 'select';
  const canHideFromLowerTiers = hasAccess(userTier, 'hideFromLowerTiers');
  const canUseHuntMode = hasAccess(userTier, 'huntMode');
  const canSearchBoost = hasAccess(userTier, 'searchBoost');

  // EPIC 7: Exclusive feature badges
  const exclusiveBadges: { label: string; icon: string; description: string }[] = [];
  if (hasAccess(userTier, 'unlimitedSearch')) {
    exclusiveBadges.push({ label: 'Unlimited Search', icon: '🔍', description: 'No result limits' });
  }
  if (hasAccess(userTier, 'unlimitedConnections')) {
    exclusiveBadges.push({ label: 'Unlimited Connections', icon: '🤝', description: 'No connection cap' });
  }
  if (hasAccess(userTier, 'unlimitedRounds')) {
    exclusiveBadges.push({ label: 'Unlimited Rounds', icon: '⛳', description: 'No round limits' });
  }
  if (hasAccess(userTier, 'createExclusiveEvents')) {
    exclusiveBadges.push({ label: 'Exclusive Events', icon: '🏆', description: 'Create SUMMIT-only events' });
  }
  if (hasAccess(userTier, 'customProfileUrl')) {
    exclusiveBadges.push({ label: 'Custom URL', icon: '🔗', description: 'spotter.golf/you' });
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Identity layer for your activity passport.</Text>

      {/* EPIC 7: Tier Badge + Exclusive Feature Badges */}
      <Card>
        <View style={styles.tierHeader}>
          <View>
            <Text style={styles.label}>Membership Tier</Text>
            <TierBadge tier={userTier} size="lg" />
          </View>
        </View>

        {/* EPIC 7: Exclusive feature badges for SELECT/SUMMIT */}
        {exclusiveBadges.length > 0 && (
          <View style={styles.badgesSection}>
            <Text style={[styles.label, { marginBottom: spacing.sm }]}>Your Benefits</Text>
            <View style={styles.badgeGrid}>
              {exclusiveBadges.map((badge) => (
                <View key={badge.label} style={styles.exclusiveBadge}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <View style={styles.badgeText}>
                    <Text style={styles.badgeLabel}>{badge.label}</Text>
                    <Text style={styles.badgeDescription}>{badge.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </Card>

      {/* EPIC 7: Profile Visibility Settings (SUMMIT only) */}
      {canHideFromLowerTiers && (
        <Card>
          <Text style={styles.label}>Profile Visibility</Text>
          <Text style={styles.visibilityDescription}>
            Control who can discover your profile in searches.
          </Text>

          <View style={styles.visibilityOptions}>
            <VisibilityOption
              label="Everyone"
              description="Visible to all members"
              selected={profile?.profile_visibility === 'visible' || !profile?.profile_visibility}
              onSelect={() => updateProfileVisibility('visible')}
              disabled={updatingVisibility}
            />
            <VisibilityOption
              label="Select & Above"
              description="Hidden from FREE members"
              selected={profile?.profile_visibility === 'select_only'}
              onSelect={() => updateProfileVisibility('select_only')}
              disabled={updatingVisibility}
            />
            <VisibilityOption
              label="Summit Only"
              description="Hidden from FREE and SELECT"
              selected={profile?.profile_visibility === 'summit_only'}
              onSelect={() => updateProfileVisibility('summit_only')}
              disabled={updatingVisibility}
            />
          </View>
        </Card>
      )}

      {/* EPIC 7: Hunt Mode (SELECT only) */}
      {canUseHuntMode && (
        <Card>
          <View style={styles.visibilityRow}>
            <View style={styles.visibilityInfo}>
              <Text style={styles.label}>Hunt Mode</Text>
              <Text style={styles.visibilityDescription}>
                See FREE-tier members in discovery to find students for lessons.
              </Text>
            </View>
            <Switch
              value={profile?.hunt_mode_enabled ?? false}
              onValueChange={async (enabled) => {
                if (!profile) return;
                setUpdatingVisibility(true);
                try {
                  await supabase
                    .from('users')
                    .update({ hunt_mode_enabled: enabled })
                    .eq('id', session.user.id);
                  setProfile((prev) => prev ? { ...prev, hunt_mode_enabled: enabled } : prev);
                } finally {
                  setUpdatingVisibility(false);
                }
              }}
              trackColor={{ false: palette.sky300, true: palette.navy600 }}
              thumbColor={palette.white}
              disabled={updatingVisibility}
            />
          </View>
          {profile?.hunt_mode_enabled && (
            <Text style={styles.huntModeActive}>👁️ Hunt Mode active</Text>
          )}
        </Card>
      )}

      {/* EPIC 7: Search Boost indicator (SUMMIT) */}
      {canSearchBoost && (
        <Card>
          <View style={styles.visibilityRow}>
            <View style={styles.visibilityInfo}>
              <Text style={styles.label}>Search Boost</Text>
              <Text style={styles.visibilityDescription}>
                Your profile appears at the top of discovery results.
              </Text>
            </View>
            <Text style={styles.boostIndicator}>⬆️ Boosted</Text>
          </View>
        </Card>
      )}

      <Card>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{email}</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Privacy promise</Text>
        <Text style={styles.value}>Location encrypted at rest and never sold.</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Buddy rating</Text>
        {loading ? (
          <ActivityIndicator />
        ) : feedback ? (
          <>
            <Text style={styles.value}>
              {feedback.positiveRatio.toFixed(1)}% positive ({feedback.totalFeedback} reviews)
            </Text>
            <Text style={styles.subValue}>
              👍 {feedback.thumbsUpCount} • 👎 {feedback.thumbsDownCount}
            </Text>
            {feedback.topTags.length > 0 ? <Text style={styles.subValue}>Top tags: {feedback.topTags.join(' • ')}</Text> : null}
          </>
        ) : (
          <Text style={styles.value}>No ratings yet.</Text>
        )}
      </Card>

      <Button title="Sign out" onPress={onSignOut} />
    </ScrollView>
  );
}

// EPIC 7: Visibility option row component
function VisibilityOption({
  label,
  description,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <View
      style={[
        styles.visibilityOption,
        selected && styles.visibilityOptionSelected,
      ]}
    >
      <View style={styles.visibilityOptionContent}>
        <Text style={[styles.visibilityOptionLabel, selected && styles.visibilityOptionLabelSelected]}>
          {label}
        </Text>
        <Text style={styles.visibilityOptionDescription}>{description}</Text>
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </View>
  );
}

const palette = {
  sky100: '#f0f4f8',
  sky200: '#d9e2ec',
  sky300: '#bcccdc',
  white: '#ffffff',
  navy600: '#2563eb',
  amber500: '#f59e0b',
  ink900: '#102a43',
  ink700: '#334e68',
  ink500: '#627d98',
};

const spacing = { xs: 6, sm: 10, md: 14, lg: 18 };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: 4,
  },
  subtitle: {
    color: palette.ink500,
    marginBottom: 14,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgesSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  badgeGrid: {
    gap: spacing.sm,
  },
  exclusiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.sky100,
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  badgeIcon: {
    fontSize: 18,
  },
  badgeText: {
    flex: 1,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900,
  },
  badgeDescription: {
    fontSize: 11,
    color: palette.ink500,
    marginTop: 1,
  },
  visibilityDescription: {
    fontSize: 13,
    color: palette.ink500,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  visibilityOptions: {
    gap: spacing.sm,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.sky100,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  visibilityOptionSelected: {
    borderColor: palette.navy600,
    backgroundColor: '#eff6ff',
  },
  visibilityOptionContent: {
    flex: 1,
  },
  visibilityOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  visibilityOptionLabelSelected: {
    color: palette.navy600,
  },
  visibilityOptionDescription: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.sky300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: palette.navy600,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.navy600,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visibilityInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  huntModeActive: {
    fontSize: 12,
    color: palette.navy600,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  boostIndicator: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.amber500,
  },
  label: {
    fontSize: 12,
    color: palette.ink500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900,
    marginTop: 4,
  },
  subValue: {
    marginTop: 6,
    color: palette.ink700,
  },
});
