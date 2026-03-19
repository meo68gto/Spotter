import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { TierBadge, TierSlug } from '../components/TierBadge';
import { supabase } from '../lib/supabase';
import { palette, radius, shadows, spacing } from '../theme/design';

interface ProfileScreenProps {
  session: Session;
  onSignOut: () => void;
}

interface UserWithTier {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  tier: {
    slug: TierSlug;
    name: string;
    status: string;
    features: Record<string, boolean>;
    isPaid: boolean;
    expiresAt: string | null;
    autoRenew: boolean;
  };
}

const TIER_DEFINITIONS: Record<TierSlug, { name: string; description: string; features: Record<string, boolean> }> = {
  free: {
    name: 'Free',
    description: 'Get started with basic features',
    features: {
      matchmaking: true,
      unlimitedSessions: false,
      videoAnalysis: false,
      priorityMatching: false,
      advancedAnalytics: false,
      coachMessaging: false,
      eventAccess: false,
      profileBadges: false,
      earlyAccess: false,
      adFree: false,
      boostedVisibility: false,
      groupSessions: false,
    },
  },
  select: {
    name: 'Select',
    description: 'Unlock premium features and priority matching',
    features: {
      matchmaking: true,
      unlimitedSessions: true,
      videoAnalysis: true,
      priorityMatching: true,
      advancedAnalytics: true,
      coachMessaging: true,
      eventAccess: true,
      profileBadges: true,
      earlyAccess: false,
      adFree: true,
      boostedVisibility: true,
      groupSessions: false,
    },
  },
  summit: {
    name: 'Summit',
    description: 'The ultimate experience with all features unlocked',
    features: {
      matchmaking: true,
      unlimitedSessions: true,
      videoAnalysis: true,
      priorityMatching: true,
      advancedAnalytics: true,
      coachMessaging: true,
      eventAccess: true,
      profileBadges: true,
      earlyAccess: true,
      adFree: true,
      boostedVisibility: true,
      groupSessions: true,
    },
  },
};

export function ProfileScreen({ session, onSignOut }: ProfileScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [userWithTier, setUserWithTier] = useState<UserWithTier | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [reputationScore, setReputationScore] = useState(0);
  const [professionalIdentity, setProfessionalIdentity] = useState<any>(null);
  const [golfIdentity, setGolfIdentity] = useState<any>(null);

  const loadProfile = useCallback(async () => {
    try {
      // Load user profile with tier
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, tier:membership_tiers!inner(*)')
        .eq('id', session.user.id)
        .single();

      if (profileError) throw profileError;

      // Load connection count
      const { count } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${session.user.id},connected_user_id.eq.${session.user.id}`)
        .eq('status', 'accepted');

      setConnectionCount(count || 0);

      // Load reputation score (simplified)
      const { data: reputationData } = await supabase
        .from('user_reputation')
        .select('score')
        .eq('user_id', session.user.id)
        .single();

      setReputationScore(reputationData?.score || 0);

      // Load professional identity
      const { data: profData } = await supabase
        .from('professional_identities')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      setProfessionalIdentity(profData);

      // Load golf identity
      const { data: golfData } = await supabase
        .from('golf_identities')
        .select('*, home_course:courses(*)')
        .eq('user_id', session.user.id)
        .single();

      setGolfIdentity(golfData);

      // Format user with tier
      setUserWithTier({
        id: profileData.id,
        email: profileData.email,
        displayName: profileData.display_name || 'Golfer',
        avatarUrl: profileData.avatar_url,
        tier: {
          slug: (profileData.tier_slug || 'free') as TierSlug,
          name: profileData.tier?.name || 'Free',
          status: 'active',
          features: profileData.tier?.features || TIER_DEFINITIONS.free.features,
          isPaid: profileData.tier_slug !== 'free',
          expiresAt: null,
          autoRenew: false,
        },
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [session.user.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Edit profile flow would open here');
  };

  const handleSettings = () => {
    Alert.alert('Settings', 'Settings flow would open here');
  };

  const handleUpgrade = () => {
    Alert.alert('Upgrade', 'Tier upgrade flow would open here');
  };

  const tier = userWithTier?.tier?.slug || 'free';
  const showUpgradeCTA = tier === 'free' || tier === 'select';
  const nextTier: TierSlug | null = tier === 'free' ? 'select' : tier === 'select' ? 'summit' : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarSection}>
          {userWithTier?.avatarUrl ? (
            <Image source={{ uri: userWithTier.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {userWithTier?.displayName?.charAt(0).toUpperCase() || 'G'}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>✎</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.name}>{userWithTier?.displayName || 'Golfer'}</Text>
          <Text style={styles.email}>{userWithTier?.email}</Text>
          <View style={styles.badgeRow}>
            <TierBadge tier={tier} size="md" />
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{connectionCount}</Text>
          <Text style={styles.statLabel}>Connections</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{reputationScore}</Text>
          <Text style={styles.statLabel}>Reputation</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{golfIdentity?.handicap || 'N/A'}</Text>
          <Text style={styles.statLabel}>Handicap</Text>
        </View>
      </View>

      {/* Professional Identity Card */}
      <Card>
        <View style={styles.identityCard}>
          <View style={styles.identityHeader}>
            <Text style={styles.identityIcon}>💼</Text>
            <Text style={styles.identityTitle}>Professional Identity</Text>
          </View>

          {professionalIdentity ? (
            <View style={styles.identityContent}>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Role</Text>
                <Text style={styles.identityValue}>{professionalIdentity.role || 'Not set'}</Text>
              </View>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Company</Text>
                <Text style={styles.identityValue}>{professionalIdentity.company || 'Not set'}</Text>
              </View>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Industry</Text>
                <Text style={styles.identityValue}>{professionalIdentity.industry || 'Not set'}</Text>
              </View>
              {professionalIdentity.linkedin_url && (
                <View style={styles.identityRow}>
                  <Text style={styles.identityLabel}>LinkedIn</Text>
                  <Text style={[styles.identityValue, styles.link]}>View Profile →</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyIdentity}>
              <Text style={styles.emptyText}>Complete your professional profile</Text>
              <Button title="Add Professional Info" onPress={handleEditProfile} />
            </View>
          )}
        </View>
      </Card>

      {/* Golf Identity Card */}
      <Card>
        <View style={styles.identityCard}>
          <View style={styles.identityHeader}>
            <Text style={styles.identityIcon}>⛳</Text>
            <Text style={styles.identityTitle}>Golf Identity</Text>
          </View>

          {golfIdentity ? (
            <View style={styles.identityContent}>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Handicap</Text>
                <Text style={styles.identityValue}>{golfIdentity.handicap || 'Not set'}</Text>
              </View>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Home Course</Text>
                <Text style={styles.identityValue}>
                  {golfIdentity.home_course?.name || 'Not set'}
                </Text>
              </View>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Play Frequency</Text>
                <Text style={styles.identityValue}>
                  {golfIdentity.play_frequency
                    ? golfIdentity.play_frequency.charAt(0).toUpperCase() +
                      golfIdentity.play_frequency.slice(1)
                    : 'Not set'}
                </Text>
              </View>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Years Playing</Text>
                <Text style={styles.identityValue}>{golfIdentity.years_playing || 'Not set'}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyIdentity}>
              <Text style={styles.emptyText}>Complete your golf profile</Text>
              <Button title="Add Golf Info" onPress={handleEditProfile} />
            </View>
          )}
        </View>
      </Card>

      {/* Tier Upgrade CTA */}
      {showUpgradeCTA && nextTier && (
        <Card>
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Upgrade to {TIER_DEFINITIONS[nextTier].name}</Text>
            <Text style={styles.upgradeDescription}>
              {TIER_DEFINITIONS[nextTier].description}
            </Text>
            <View style={styles.featuresList}>
              {Object.entries(TIER_DEFINITIONS[nextTier].features)
                .filter(([_, value]) => value)
                .slice(0, 4)
                .map(([key]) => (
                  <View key={key} style={styles.featureItem}>
                    <Text style={styles.featureCheck}>✓</Text>
                    <Text style={styles.featureText}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                    </Text>
                  </View>
                ))}
            </View>
            <Button title="Upgrade Now" onPress={handleUpgrade} />
          </View>
        </Card>
      )}

      {/* Settings */}
      <Card>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingsRow} onPress={handleSettings}>
            <Text style={styles.settingsIcon}>⚙️</Text>
            <Text style={styles.settingsText}>Settings</Text>
            <Text style={styles.settingsArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.settingsDivider} />

          <TouchableOpacity style={styles.settingsRow} onPress={handleEditProfile}>
            <Text style={styles.settingsIcon}>✏️</Text>
            <Text style={styles.settingsText}>Edit Profile</Text>
            <Text style={styles.settingsArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.settingsDivider} />

          <TouchableOpacity
            style={[styles.settingsRow, styles.signOutRow]}
            onPress={onSignOut}
          >
            <Text style={styles.settingsIcon}>🚪</Text>
            <Text style={[styles.settingsText, styles.signOutText]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarSection: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: palette.white,
    ...shadows.card,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: palette.white,
    ...shadows.card,
  },
  avatarInitial: {
    color: palette.white,
    fontSize: 48,
    fontWeight: '800',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: palette.white,
  },
  editButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  nameSection: {
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: 14,
    color: palette.ink500,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: palette.sky200,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink900,
  },
  statLabel: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: spacing.xs / 2,
  },
  identityCard: {
    gap: spacing.md,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identityIcon: {
    fontSize: 20,
  },
  identityTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink900,
  },
  identityContent: {
    gap: spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  identityLabel: {
    fontSize: 14,
    color: palette.ink500,
  },
  identityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  link: {
    color: palette.navy600,
  },
  emptyIdentity: {
    alignItems: 'center',
    padding: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink500,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  upgradeCard: {
    gap: spacing.md,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink900,
    textAlign: 'center',
  },
  upgradeDescription: {
    fontSize: 14,
    color: palette.ink700,
    textAlign: 'center',
  },
  featuresList: {
    gap: spacing.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureCheck: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
  },
  featureText: {
    fontSize: 14,
    color: palette.ink700,
  },
  settingsCard: {
    gap: spacing.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingsIcon: {
    fontSize: 20,
    marginRight: spacing.md,
    width: 28,
  },
  settingsText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900,
  },
  settingsArrow: {
    fontSize: 18,
    color: palette.ink500,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: palette.sky200,
  },
  signOutRow: {
    marginTop: spacing.xs,
  },
  signOutText: {
    color: palette.red500,
  },
});
