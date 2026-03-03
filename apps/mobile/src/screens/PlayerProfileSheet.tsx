import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { palette, spacing, radius, font, isWeb } from '../../theme/design';
import {
  Avatar,
  Badge,
  Button,
  FilterChip,
  Rating,
  SkeletonLoader,
  StatCard,
} from '../../components';
import { supabase } from '../../lib/supabase';
import { invokeFunction } from '../../lib/api';
import { useSession } from '../../contexts/SessionContext';

type RouteParams = {
  PlayerProfile: { playerId: string };
};

interface PlayerProfile {
  id: string;
  display_name: string;
  avatar_url?: string;
  cover_url?: string;
  location?: string;
  bio?: string;
  sports: string[];
  skill_level?: string;
  rating?: number;
  rating_count?: number;
  session_count?: number;
  match_count?: number;
  created_at?: string;
}

type RequestStatus = 'idle' | 'submitting' | 'pending' | 'error';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_HEIGHT = 180;
const AVATAR_SIZE = 80;
const AVATAR_OFFSET = AVATAR_SIZE / 2;

export default function PlayerProfileSheet() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PlayerProfile'>>();
  const { session } = useSession();

  const playerId = route.params?.playerId ?? '';
  const currentUserId = session?.user?.id ?? '';
  const isOwnProfile = currentUserId === playerId;

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('idle');
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, display_name, avatar_url, cover_url, location, bio, sports, skill_level, rating, rating_count, session_count, match_count, created_at'
        )
        .eq('id', playerId)
        .single();
      if (!error && data) setProfile(data as PlayerProfile);
      setLoading(false);
    })();
  }, [playerId]);

  // Check if a match request already exists
  useEffect(() => {
    if (!currentUserId || !playerId || isOwnProfile) return;
    (async () => {
      const { data } = await supabase
        .from('match_requests')
        .select('id, status')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .or(`sender_id.eq.${playerId},receiver_id.eq.${playerId}`)
        .in('status', ['pending', 'accepted'])
        .maybeSingle();
      if (data) setRequestStatus('pending');
    })();
  }, [currentUserId, playerId, isOwnProfile]);

  const handleRequestMatch = useCallback(async () => {
    if (!session || requestStatus !== 'idle') return;
    setRequestStatus('submitting');
    setRequestError(null);
    try {
      await invokeFunction('matching-request', {
        receiver_id: playerId,
      });
      setRequestStatus('pending');
    } catch (err: any) {
      setRequestStatus('error');
      setRequestError(err?.message ?? 'Something went wrong. Please try again.');
    }
  }, [session, playerId, requestStatus]);

  const handleSendInvite = useCallback(async () => {
    navigation.navigate('SendInvite', { playerId });
  }, [navigation, playerId]);

  const handleEditProfile = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  const handleBlock = useCallback(async () => {
    if (!currentUserId || !playerId) return;
    await supabase.from('blocked_users').insert({ blocker_id: currentUserId, blocked_id: playerId });
    navigation.goBack();
  }, [currentUserId, playerId, navigation]);

  const handleReport = useCallback(async () => {
    navigation.navigate('ReportUser', { reportedId: playerId });
  }, [navigation, playerId]);

  const formatJoinDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {/* Cover skeleton */}
        <SkeletonLoader width={SCREEN_WIDTH} height={COVER_HEIGHT} borderRadius={0} />
        {/* Avatar skeleton */}
        <View style={styles.avatarArea}>
          <View style={styles.avatarWrapper}>
            <SkeletonLoader width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} />
          </View>
        </View>
        <View style={styles.bodyPadding}>
          <SkeletonLoader width={180} height={24} borderRadius={radius.sm} />
          <View style={{ height: spacing.sm }} />
          <SkeletonLoader width={120} height={14} borderRadius={radius.sm} />
          <View style={{ height: spacing.lg }} />
          <View style={styles.statRow}>
            {[0, 1, 2].map((i) => (
              <SkeletonLoader key={i} width={88} height={72} borderRadius={radius.md} />
            ))}
          </View>
          <View style={{ height: spacing.xl }} />
          <SkeletonLoader width="100%" height={52} borderRadius={radius.lg} />
          <View style={{ height: spacing.sm }} />
          <SkeletonLoader width="100%" height={52} borderRadius={radius.lg} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="person-outline" size={48} color={palette.ink400} />
        <Text style={styles.notFoundText}>Player not found</Text>
        <Button
          label="Go Back"
          variant="secondary"
          size="md"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* CLOSE / BACK */}
      <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-down" size={22} color={palette.white} />
      </Pressable>

      {/* COVER PHOTO */}
      <View
        style={[
          styles.cover,
          { backgroundColor: profile.cover_url ? palette.sky200 : palette.navy600 },
        ]}
      >
        {/* Cover image would render here if cover_url present */}
        {!profile.cover_url && (
          <View style={styles.coverGradient} />
        )}
      </View>

      {/* AVATAR */}
      <View style={styles.avatarArea}>
        <View style={styles.avatarWrapper}>
          <Avatar
            uri={profile.avatar_url}
            name={profile.display_name}
            size={AVATAR_SIZE}
          />
        </View>
      </View>

      {/* IDENTITY */}
      <View style={styles.bodyPadding}>
        <Text style={styles.displayName}>{profile.display_name}</Text>

        {/* Sport chips */}
        {profile.sports?.length > 0 && (
          <View style={styles.sportsRow}>
            {profile.sports.slice(0, 3).map((sport) => (
              <FilterChip
                key={sport}
                label={sport}
                active={false}
                onPress={() => {}}
                size="sm"
                style={{ marginRight: spacing.xs }}
              />
            ))}
            {profile.skill_level && (
              <Badge label={profile.skill_level} variant="info" size="sm" />
            )}
          </View>
        )}

        {/* Location */}
        {profile.location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={palette.ink500} />
            <Text style={styles.locationText}>{profile.location}</Text>
          </View>
        )}

        {/* Rating */}
        {typeof profile.rating === 'number' && (
          <View style={styles.ratingRow}>
            <Rating value={profile.rating} count={profile.rating_count} />
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statRow}>
          <StatCard
            label="Sessions"
            value={String(profile.session_count ?? 0)}
            icon="calendar-outline"
          />
          <StatCard
            label="Matches"
            value={String(profile.match_count ?? 0)}
            icon="tennisball-outline"
          />
          <StatCard
            label="Joined"
            value={formatJoinDate(profile.created_at)}
            icon="person-add-outline"
          />
        </View>

        {/* Bio */}
        {profile.bio && (
          <View style={styles.bioContainer}>
            <Text
              style={styles.bioText}
              numberOfLines={bioExpanded ? undefined : 3}
            >
              {profile.bio}
            </Text>
            {!bioExpanded && profile.bio.length > 120 && (
              <Pressable onPress={() => setBioExpanded(true)}>
                <Text style={styles.readMore}>Read more</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* REQUEST ERROR */}
        {requestStatus === 'error' && requestError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={15} color={palette.red500} />
            <Text style={styles.errorBannerText}>{requestError}</Text>
          </View>
        )}

        {/* ACTIONS */}
        <View style={styles.actions}>
          {isOwnProfile ? (
            <Button
              label="Edit Profile"
              variant="primary"
              size="lg"
              onPress={handleEditProfile}
              fullWidth
            />
          ) : (
            <>
              <Button
                label={
                  requestStatus === 'pending'
                    ? 'Request Pending'
                    : requestStatus === 'submitting'
                    ? 'Sending...'
                    : 'Request Match'
                }
                variant="primary"
                size="lg"
                onPress={handleRequestMatch}
                disabled={requestStatus === 'pending' || requestStatus === 'submitting'}
                style={
                  requestStatus === 'pending'
                    ? { backgroundColor: palette.amber500 }
                    : undefined
                }
                fullWidth
              />
              <Button
                label="Send Invite"
                variant="secondary"
                size="lg"
                onPress={handleSendInvite}
                fullWidth
                style={{ marginTop: spacing.sm }}
              />
            </>
          )}
        </View>

        {/* BLOCK / REPORT */}
        {!isOwnProfile && (
          <View style={styles.dangerRow}>
            <Pressable onPress={handleBlock} style={styles.dangerLink}>
              <Text style={styles.dangerText}>Block player</Text>
            </Pressable>
            <Text style={styles.dangerDot}>·</Text>
            <Pressable onPress={handleReport} style={styles.dangerLink}>
              <Text style={styles.dangerText}>Report</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.white,
  },
  scrollContent: {
    paddingBottom: spacing.xxl * 2,
  },
  closeButton: {
    position: 'absolute',
    top: isWeb ? spacing.lg : 52,
    left: spacing.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    width: SCREEN_WIDTH,
    height: COVER_HEIGHT,
    overflow: 'hidden',
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  avatarArea: {
    alignItems: 'center',
    marginTop: -AVATAR_OFFSET,
    marginBottom: spacing.md,
  },
  avatarWrapper: {
    borderRadius: AVATAR_SIZE / 2 + 4,
    borderWidth: 4,
    borderColor: palette.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  bodyPadding: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  displayName: {
    fontFamily: font.bold,
    fontSize: 24,
    color: palette.ink900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sportsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  locationText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: palette.ink500,
  },
  ratingRow: {
    marginBottom: spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
    justifyContent: 'space-between',
  },
  bioContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  bioText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: palette.ink700,
    lineHeight: 22,
  },
  readMore: {
    fontFamily: font.medium,
    fontSize: 13,
    color: palette.navy600,
    marginTop: spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
  },
  errorBannerText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: palette.red500,
    flex: 1,
  },
  actions: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dangerLink: {
    paddingVertical: spacing.xs,
  },
  dangerText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: palette.red500,
  },
  dangerDot: {
    color: palette.ink400,
    fontSize: 13,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  notFoundText: {
    fontFamily: font.medium,
    fontSize: 16,
    color: palette.ink700,
    marginTop: spacing.md,
  },
});
