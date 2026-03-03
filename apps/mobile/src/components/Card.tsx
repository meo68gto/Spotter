import React, { useRef, useCallback, type ReactNode } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { radiusMd, radiusLg } from '../theme/tokens/radius';
import { spaceSm, spaceMd, spaceLg } from '../theme/tokens/spacing';
import { elevation } from '../theme/tokens/elevation';
import { durationFast, easingOut } from '../theme/tokens/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'hero';

export interface CardProps {
  variant?:  CardVariant;
  onPress?:  () => void;
  style?:    ViewStyle;
  children?: ReactNode;
}

// Player / match card
export interface PlayerCardProps {
  name:       string;
  sport:      string;
  location?:  string;
  level?:     string;
  avatarUri?: string;
  rating?:    number;
  onPress?:   () => void;
  style?:     ViewStyle;
}

// Coach card
export interface CoachCardProps {
  name:         string;
  specialty:    string;
  rating?:      number;
  reviewCount?: number;
  price?:       string;
  avatarUri?:   string;
  verified?:    boolean;
  onPress?:     () => void;
  style?:       ViewStyle;
}

// Event card
export interface EventCardProps {
  title:        string;
  date:         string;
  location?:    string;
  imageUri?:    string;
  spotsLeft?:   number;
  onPress?:     () => void;
  style?:       ViewStyle;
}

// Stat card (for dashboards)
export interface StatCardProps {
  label:  string;
  value:  string | number;
  delta?: string;
  positive?: boolean;
  icon?:  keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

// ─── Base Card ─────────────────────────────────────────────────────────────────

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  onPress,
  style,
  children,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (!onPress) return;
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: durationFast,
      easing: easingOut,
      useNativeDriver: true,
    }).start();
  }, [onPress, scaleAnim]);

  const handlePressOut = useCallback(() => {
    if (!onPress) return;
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: durationFast,
      easing: easingOut,
      useNativeDriver: true,
    }).start();
  }, [onPress, scaleAnim]);

  const variantStyles: Record<CardVariant, ViewStyle> = {
    default:  { backgroundColor: palette.white, borderRadius: radiusMd, ...(elevation.sm as ViewStyle) },
    elevated: { backgroundColor: palette.white, borderRadius: radiusMd, ...(elevation.md as ViewStyle) },
    outlined: { backgroundColor: palette.white, borderRadius: radiusMd, borderWidth: 1, borderColor: palette.ink200 },
    filled:   { backgroundColor: palette.gray100, borderRadius: radiusMd },
    hero:     { backgroundColor: palette.white, borderRadius: radiusLg, ...(elevation.lg as ViewStyle) },
  };

  const inner = (
    <Animated.View style={[styles.base, variantStyles[variant], style, { transform: [{ scale: scaleAnim }] }]}>
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        {inner}
      </Pressable>
    );
  }

  return inner;
};

// ─── PlayerCard ──────────────────────────────────────────────────────────────

export const PlayerCard: React.FC<PlayerCardProps> = ({
  name,
  sport,
  location,
  level,
  avatarUri,
  rating,
  onPress,
  style,
}) => {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card variant="elevated" onPress={onPress} style={[styles.playerCard, style]}>
      <View style={styles.playerCardInner}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.playerSport}>{sport}{level ? ` · ${level}` : ''}</Text>
          {location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={11} color={palette.ink400} />
              <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
            </View>
          )}
        </View>

        {/* Rating */}
        {rating !== undefined && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color={palette.amber500} />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
};

// ─── CoachCard ──────────────────────────────────────────────────────────────

export const CoachCard: React.FC<CoachCardProps> = ({
  name,
  specialty,
  rating,
  reviewCount,
  price,
  avatarUri,
  verified,
  onPress,
  style,
}) => {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card variant="elevated" onPress={onPress} style={[styles.coachCard, style]}>
      <View style={styles.coachCardInner}>
        <View style={styles.coachAvatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.coachAvatar} />
          ) : (
            <View style={[styles.coachAvatarFallback]}>
              <Text style={styles.coachInitials}>{initials}</Text>
            </View>
          )}
          {verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={palette.mint500} />
            </View>
          )}
        </View>

        <View style={styles.coachInfo}>
          <Text style={styles.coachName} numberOfLines={1}>{name}</Text>
          <Text style={styles.coachSpecialty} numberOfLines={1}>{specialty}</Text>
          <View style={styles.coachMeta}>
            {rating !== undefined && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={11} color={palette.amber500} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                {reviewCount !== undefined && (
                  <Text style={styles.reviewCount}>({reviewCount})</Text>
                )}
              </View>
            )}
            {price && <Text style={styles.priceText}>{price}</Text>}
          </View>
        </View>
      </View>
    </Card>
  );
};

// ─── EventCard ──────────────────────────────────────────────────────────────

export const EventCard: React.FC<EventCardProps> = ({
  title,
  date,
  location,
  imageUri,
  spotsLeft,
  onPress,
  style,
}) => (
  <Card variant="hero" onPress={onPress} style={[styles.eventCard, style]}>
    {imageUri && (
      <Image source={{ uri: imageUri }} style={styles.eventImage} resizeMode="cover" />
    )}
    <View style={styles.eventBody}>
      <Text style={styles.eventTitle} numberOfLines={2}>{title}</Text>
      <View style={styles.eventMeta}>
        <View style={styles.eventMetaRow}>
          <Ionicons name="calendar-outline" size={12} color={palette.ink400} />
          <Text style={styles.eventMetaText}>{date}</Text>
        </View>
        {location && (
          <View style={styles.eventMetaRow}>
            <Ionicons name="location-outline" size={12} color={palette.ink400} />
            <Text style={styles.eventMetaText}>{location}</Text>
          </View>
        )}
      </View>
      {spotsLeft !== undefined && (
        <Text style={styles.spotsLeft}>{spotsLeft} spots left</Text>
      )}
    </View>
  </Card>
);

// ─── StatCard ──────────────────────────────────────────────────────────────

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  delta,
  positive = true,
  icon,
  style,
}) => (
  <Card variant="elevated" style={[styles.statCard, style]}>
    <View style={styles.statCardInner}>
      {icon && (
        <View style={styles.statIcon}>
          <Ionicons name={icon} size={18} color={palette.mint500} />
        </View>
      )}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {delta && (
        <Text style={[styles.statDelta, { color: positive ? palette.green500 : palette.red500 }]}>
          {delta}
        </Text>
      )}
    </View>
  </Card>
);

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },

  // Player card
  playerCard: {
    paddingHorizontal: spaceMd,
    paddingVertical:   spaceMd,
  },
  playerCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceMd,
  },
  avatarContainer: {},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.navy500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
  },
  playerSport: {
    fontSize: 12,
    color: palette.ink500,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  locationText: {
    fontSize: 11,
    color: palette.ink400,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: palette.amber50,
    paddingHorizontal: spaceSm,
    paddingVertical: 3,
    borderRadius: 99,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.amber600,
  },

  // Coach card
  coachCard: {
    padding: spaceMd,
  },
  coachCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spaceMd,
  },
  coachAvatarWrap: {
    position: 'relative',
  },
  coachAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  coachAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.mint600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachInitials: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '700',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: palette.white,
    borderRadius: 99,
  },
  coachInfo: {
    flex: 1,
    gap: 2,
  },
  coachName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  coachSpecialty: {
    fontSize: 13,
    color: palette.ink500,
    marginBottom: spaceSm,
  },
  coachMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceMd,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewCount: {
    fontSize: 11,
    color: palette.ink400,
    marginLeft: 1,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.mint600,
  },

  // Event card
  eventCard: {
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 160,
  },
  eventBody: {
    padding: spaceMd,
    gap: spaceSm,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  eventMeta: {
    gap: 4,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventMetaText: {
    fontSize: 12,
    color: palette.ink400,
  },
  spotsLeft: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.red500,
  },

  // Stat card
  statCard: {
    padding: spaceMd,
    minWidth: 80,
  },
  statCardInner: {
    alignItems: 'center',
    gap: 2,
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.ink900,
  },
  statLabel: {
    fontSize: 11,
    color: palette.ink500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDelta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
