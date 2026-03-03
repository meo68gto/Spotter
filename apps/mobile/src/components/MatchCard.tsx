import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { radiusMd, radiusLg, radiusFull } from '../theme/tokens/radius';
import { spaceXs, spaceSm, spaceMd, spaceLg } from '../theme/tokens/spacing';
import { elevation } from '../theme/tokens/elevation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type MatchType   = 'player' | 'coach' | 'event';

export interface MatchCardProps {
  /** The person/event being suggested */
  name:          string;
  type:          MatchType;
  sport?:        string;
  location?:     string;
  avatarUri?:    string;
  matchScore?:   number;   // 0–100
  status?:       MatchStatus;
  /** Distance in miles/km (caller formats the string) */
  distance?:     string;
  /** Mutual connections count */
  mutuals?:      number;
  onAccept?:     () => void;
  onDecline?:    () => void;
  onPress?:      () => void;
  style?:        ViewStyle;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<MatchType, keyof typeof Ionicons.glyphMap> = {
  player: 'person-outline',
  coach:  'school-outline',
  event:  'calendar-outline',
};

const STATUS_CONFIG: Record<MatchStatus, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: palette.amber500 },
  accepted: { label: 'Matched', color: palette.mint600 },
  declined: { label: 'Passed',  color: palette.ink400 },
  expired:  { label: 'Expired', color: palette.red500 },
};

function getScoreColor(score: number): string {
  if (score >= 80) return palette.mint600;
  if (score >= 60) return palette.amber500;
  return palette.ink500;
}

// ─── MatchCard Component ───────────────────────────────────────────────────

export const MatchCard: React.FC<MatchCardProps> = ({
  name,
  type,
  sport,
  location,
  avatarUri,
  matchScore,
  status,
  distance,
  mutuals,
  onAccept,
  onDecline,
  onPress,
  style,
}) => {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const statusCfg = status ? STATUS_CONFIG[status] : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        )}
        <View style={styles.typeChip}>
          <Ionicons name={TYPE_ICON[type]} size={10} color={palette.white} />
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {matchScore !== undefined && (
            <Text style={[styles.score, { color: getScoreColor(matchScore) }]}>
              {matchScore}%
            </Text>
          )}
        </View>

        {sport && <Text style={styles.sport}>{sport}</Text>}

        <View style={styles.metaRow}>
          {distance && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={11} color={palette.ink400} />
              <Text style={styles.metaText}>{distance}</Text>
            </View>
          )}
          {mutuals !== undefined && mutuals > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={11} color={palette.ink400} />
              <Text style={styles.metaText}>{mutuals} mutual</Text>
            </View>
          )}
          {statusCfg && (
            <Text style={[styles.statusText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          )}
        </View>

        {location && (
          <Text style={styles.location} numberOfLines={1}>{location}</Text>
        )}
      </View>

      {/* Actions */}
      {(onAccept ?? onDecline) && status === 'pending' && (
        <View style={styles.actions}>
          {onDecline && (
            <Pressable onPress={onDecline} style={[styles.actionBtn, styles.declineBtn]}>
              <Ionicons name="close" size={18} color={palette.red500} />
            </Pressable>
          )}
          {onAccept && (
            <Pressable onPress={onAccept} style={[styles.actionBtn, styles.acceptBtn]}>
              <Ionicons name="checkmark" size={18} color={palette.white} />
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
};

export default MatchCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: radiusLg,
    padding: spaceMd,
    gap: spaceMd,
    ...(elevation.sm as ViewStyle),
  },

  // Avatar
  avatarSection: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radiusFull,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: radiusFull,
    backgroundColor: palette.navy500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.white,
  },
  typeChip: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: radiusFull,
    backgroundColor: palette.mint500,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.white,
  },

  // Info
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
    flex: 1,
  },
  score: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: spaceXs,
  },
  sport: {
    fontSize: 13,
    color: palette.ink500,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spaceSm,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: palette.ink400,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  location: {
    fontSize: 12,
    color: palette.ink400,
    marginTop: 1,
  },

  // Actions
  actions: {
    flexDirection: 'column',
    gap: spaceSm,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: palette.mint500,
  },
  declineBtn: {
    backgroundColor: palette.red50,
  },
});
