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
import { ReliabilityIndicator } from '../components/ReliabilityIndicator';
import { TrustBadgeDisplay } from '../components/TrustBadgeDisplay';
import { TrustBadge, ReliabilityBreakdown } from '@spotter/types';
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

// Helper functions for reliability buckets
const getShowRateBucket = (rate: number): 'excellent' | 'good' | 'fair' | 'building' => {
  if (rate >= 95) return 'excellent';
  if (rate >= 80) return 'good';
  if (rate >= 60) return 'fair';
  return 'building';
};

const getPunctualityBucket = (rate: number): 'excellent' | 'good' | 'fair' | 'building' => {
  if (rate >= 95) return 'excellent';
  if (rate >= 80) return 'good';
  if (rate >= 60) return 'fair';
  return 'building';
};

const getBoostDescription = (boost: number): string => {
  if (boost >= 1.5) return '+50% visibility boost';
  if (boost >= 1.3) return '+30% visibility boost';
  if (boost >= 1.15) return '+15% visibility boost';
  if (boost >= 1.05) return '+5% visibility boost';
  return 'Standard visibility';
};

// Epic 1: Helper functions for formatting
const formatHandicapBand = (band: string | null): string => {
  const bands: Record<string, string> = {
    beginner: 'Beginner (25+)',
    intermediate: 'Intermediate (10-24)',
    advanced: 'Advanced (0-9)',
    expert: 'Expert (Pro/Scratch)',
  };
  return bands[band || ''] || 'Not set';
};

const getHandicapBandColor = (band: string | null): string => {
  const colors: Record<string, string> = {
    beginner: '#22c55e',      // green-500
    intermediate: '#3b82f6', // blue-500
    advanced: '#f59e0b',     // amber-500
    expert: '#8b5cf6',       // violet-500
  };
  return colors[band || ''] || '#9ca3af';
};

const formatPlayFrequency = (freq: string | null): string => {
  const freqs: Record<string, string> = {
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    monthly: 'Monthly',
    occasionally: 'Occasionally',
  };
  return freqs[freq || ''] || freq || 'Not set';
};

const formatNetworkingIntent = (intent: string | null): string => {
  const intents: Record<string, string> = {
    business: 'Business',
    social: 'Social',
    competitive: 'Competitive',
    business_social: 'Business + Social',
  };
  return intents[intent || ''] || intent || 'Not set';
};

const formatRoundFrequency = (freq: string | null): string => {
  const freqs: Record<string, string> = {
    multiple_per_week: 'Multiple per week',
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    monthly: 'Monthly',
    occasionally: 'Occasionally',
    rarely: 'Rarely',
  };
  return freqs[freq || ''] || freq || 'Not set';
};

const formatGroupSize = (size: string | null): string => {
  const sizes: Record<string, string> = {
    '2': 'Twosome',
    '3': 'Threesome',
    '4': 'Foursome',
    any: 'Any size',
  };
  return sizes[size || ''] || size || 'Not set';
};

const formatMobilityPreference = (pref: string | null): string => {
  const prefs: Record<string, string> = {
    walking: 'Walking Only',
    walking_preferred: 'Walking Preferred',
    cart: 'Cart Only',
    cart_preferred: 'Cart Preferred',
    either: 'No Preference',
  };
  return prefs[pref || ''] || pref || 'No Preference';
};

const formatTeeTimePreference = (pref: string | null): string => {
  const prefs: Record<string, string> = {
    early_bird: 'Early Bird (before 9am)',
    mid_morning: 'Mid-Morning (9am-12pm)',
    afternoon: 'Afternoon (12pm-4pm)',
    twilight: 'Twilight (after 4pm)',
    weekends_only: 'Weekends Only',
    flexible: 'Flexible',
  };
  return prefs[pref || ''] || pref || 'Not set';
};

export function ProfileScreen({ session, onSignOut }: ProfileScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [userWithTier, setUserWithTier] = useState<UserWithTier | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [reputationScore, setReputationScore] = useState(0);
  const [professionalIdentity, setProfessionalIdentity] = useState<any>(null);
  const [golfIdentity, setGolfIdentity] = useState<any>(null);
  const [networkingPreferences, setNetworkingPreferences] = useState<any>(null);
  const [reliability, setReliability] = useState<ReliabilityBreakdown | null>(null);
  const [trustBadges, setTrustBadges] = useState<TrustBadge[]>([]);
  const [discoveryBoost, setDiscoveryBoost] = useState<number>(1.0);

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

      // Load reputation score
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

      // Load networking preferences
      const { data: networkingData } = await supabase
        .from('user_networking_preferences')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      setNetworkingPreferences(networkingData);

      // Load reliability data
      const { data: reliabilityData } = await supabase
        .from('user_reputation')
        .select('reliability_score, reliability_label, show_rate, punctuality_rate, rounds_completed, rounds_scheduled, minutes_early_avg, last_reliability_calc_at')
        .eq('user_id', session.user.id)
        .single();

      if (reliabilityData) {
        setReliability({
          reliabilityScore: reliabilityData.reliability_score,
          reliabilityLabel: reliabilityData.reliability_label,
          showRate: reliabilityData.show_rate,
          punctualityRate: reliabilityData.punctuality_rate,
          roundsCompleted: reliabilityData.rounds_completed,
          roundsScheduled: reliabilityData.rounds_scheduled,
          minutesEarlyAvg: reliabilityData.minutes_early_avg,
          lastCalculatedAt: reliabilityData.last_reliability_calc_at,
          showRateBucket: getShowRateBucket(reliabilityData.show_rate),
          punctualityBucket: getPunctualityBucket(reliabilityData.punctuality_rate),
        });
      }

      // Load trust badges
      const { data: badgesData } = await supabase
        .from('trust_badges')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_visible', true)
        .order('awarded_at', { ascending: false });

      setTrustBadges(badgesData || []);

      // Load discovery boost
      const { data: boostData } = await supabase
        .rpc('calculate_discovery_boost', { p_user_id: session.user.id });
      
      if (boostData) {
        setDiscoveryBoost(boostData);
      }

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

      {/* Reliability & Trust Card - EPIC 6 */}
      <Card>
        <View style={styles.identityCard}>
          <View style={styles.identityHeader}>
            <Text style={styles.identityIcon}>🛡️</Text>
            <Text style={styles.identityTitle}>Trust & Reliability</Text>
          </View>

          {reliability ? (
            <View style={styles.reliabilityContent}>
              <View style={styles.reliabilityTopRow}>
                <ReliabilityIndicator 
                  score={reliability.reliabilityScore}
                  label={reliability.reliabilityLabel}
                  size="md"
                />
                
                <View style={styles.reliabilityDetails}>
                  <View style={styles.reliabilityRow}>
                    <Text style={styles.reliabilityLabel}>Rounds Completed</Text>
                    <Text style={styles.reliabilityValue}>{reliability.roundsCompleted}</Text>
                  </View>
                  
                  <View style={styles.reliabilityRow}>
                    <Text style={styles.reliabilityLabel}>Show Rate</Text>
                    <View style={styles.bucketBadge}>
                      <Text style={[
                        styles.bucketText, 
                        { 
                          color: reliability.showRateBucket === 'excellent' ? '#059669' :
                                 reliability.showRateBucket === 'good' ? '#0891b2' :
                                 reliability.showRateBucket === 'fair' ? '#d97706' : '#6b7280'
                        }
                      ]}>
                        {reliability.showRateBucket.charAt(0).toUpperCase() + reliability.showRateBucket.slice(1)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.reliabilityRow}>
                    <Text style={styles.reliabilityLabel}>Punctuality</Text>
                    <View style={styles.bucketBadge}>
                      <Text style={[
                        styles.bucketText, 
                        { 
                          color: reliability.punctualityBucket === 'excellent' ? '#059669' :
                                 reliability.punctualityBucket === 'good' ? '#0891b2' :
                                 reliability.punctualityBucket === 'fair' ? '#d97706' : '#6b7280'
                        }
                      ]}>
                        {reliability.punctualityBucket.charAt(0).toUpperCase() + reliability.punctualityBucket.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Trust Badges */}
              <View style={styles.badgesSection}>
                <Text style={styles.badgesTitle}>Trust Badges</Text>
                <TrustBadgeDisplay badges={trustBadges} size="sm" />
              </View>

              {/* Discovery Boost */}
              <View style={styles.boostSection}>
                <View style={styles.boostHeader}>
                  <Text style={styles.boostTitle}>Discovery Score</Text>
                  <Text style={styles.boostBadge}>{getBoostDescription(discoveryBoost)}</Text>
                </View>
                <Text style={styles.boostDescription}>
                  Higher reliability scores and trust badges boost your visibility to other golfers.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyIdentity}>
              <Text style={styles.emptyText}>Complete rounds to build your reliability</Text>
            </View>
          )}
        </View>
      </Card>

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

            {/* Epic 1: Golf Identity Card with Handicap Band */}
      <Card>
        <View style={styles.identityCard}>
          <View style={styles.identityHeader}>
            <Text style={styles.identityIcon}>⛳</Text>
            <Text style={styles.identityTitle}>Golf Identity</Text>
          </View>

          {golfIdentity ? (
            <View style={styles.identityContent}>
              {/* Epic 1: Handicap Band - prominently displayed */}
              <View style={styles.epic1Row}>
                <Text style={styles.epic1Label}>Skill Level</Text>
                <View style={[
                  styles.handicapBandBadge,
                  { backgroundColor: getHandicapBandColor(golfIdentity.handicap_band) }
                ]}>
                  <Text style={styles.handicapBandText}>
                    {formatHandicapBand(golfIdentity.handicap_band) || 'Not set'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Handicap</Text>
                <Text style={styles.identityValue}>{golfIdentity.handicap || 'N/A'}</Text>
              </View>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Home Course</Text>
                <Text style={styles.identityValue}>
                  {golfIdentity.home_course?.name || golfIdentity.home_course_area || 'Not set'}
                </Text>
              </View>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Play Frequency</Text>
                <Text style={styles.identityValue}>
                  {formatPlayFrequency(golfIdentity.play_frequency) || 'Not set'}
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

      {/* Epic 1: Networking Preferences Card */}
      <Card>
        <View style={styles.identityCard}>
          <View style={styles.identityHeader}>
            <Text style={styles.identityIcon}>🤝</Text>
            <Text style={styles.identityTitle}>Networking Preferences</Text>
          </View>

          {networkingPreferences ? (
            <View style={styles.identityContent}>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Intent</Text>
                <Text style={styles.identityValue}>
                  {formatNetworkingIntent(networkingPreferences.networking_intent)}
                </Text>
              </View>
              
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Round Frequency</Text>
                <Text style={styles.identityValue}>
                  {formatRoundFrequency(networkingPreferences.round_frequency)}
                </Text>
              </View>
              
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Preferred Group Size</Text>
                <Text style={styles.identityValue}>
                  {formatGroupSize(networkingPreferences.preferred_group_size)}
                </Text>
              </View>
              
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Mobility</Text>
                <Text style={styles.identityValue}>
                  {formatMobilityPreference(networkingPreferences.mobility_preference)}
                </Text>
              </View>
              
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Preferred Tee Time</Text>
                <Text style={styles.identityValue}>
                  {formatTeeTimePreference(networkingPreferences.preferred_tee_time_window)}
                </Text>
              </View>
              
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Recurring Rounds</Text>
                <Text style={styles.identityValue}>
                  {networkingPreferences.open_to_recurring_rounds ? 'Yes' : 'No'}
                </Text>
              </View>
              
              {networkingPreferences.preferred_golf_area && (
                <View style={styles.identityRow}>
                  <Text style={styles.identityLabel}>Preferred Area</Text>
                  <Text style={styles.identityValue}>
                    {networkingPreferences.preferred_golf_area}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyIdentity}>
              <Text style={styles.emptyText}>Set your networking preferences</Text>
              <Button title="Configure Networking" onPress={handleEditProfile} />
            </View>
          )}
        </View>
      </Card>
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
  // Reliability Section Styles - Epic 6
  reliabilityContent: {
    gap: spacing.md,
  },
  reliabilityTopRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  reliabilityDetails: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  reliabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reliabilityLabel: {
    fontSize: 13,
    color: palette.ink600,
  },
  reliabilityValue: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
  },
  bucketBadge: {
    backgroundColor: palette.sky100,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  bucketText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgesSection: {
    marginTop: spacing.sm,
  },
  badgesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.ink800,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  boostSection: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  boostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  boostTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
  },
  boostBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.navy600,
    backgroundColor: `${palette.navy600}15`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  boostDescription: {
    fontSize: 12,
    color: palette.ink600,
    lineHeight: 18,
  },
  // Epic 1: Handicap Band Styles
  epic1Row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  epic1Label: {
    fontSize: 14,
    color: palette.ink500,
    fontWeight: '600',
  },
  handicapBandBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  handicapBandText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
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
