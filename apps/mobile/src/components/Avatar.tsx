import React, { useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { palette } from '../theme/tokens/colors';
import { radiusFull } from '../theme/tokens/radius';
import { typography } from '../theme/tokens/typography';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarVariant = 'circle' | 'rounded';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps {
  /** Image URL */
  uri?: string;
  /** Full display name — used to generate initials fallback */
  name?: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
  /** Show an online/offline badge in the corner */
  status?: AvatarStatus;
  style?: ViewStyle;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const FONT_SIZE_MAP: Record<AvatarSize, number> = {
  xs: 9,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 30,
};

const STATUS_COLORS: Record<AvatarStatus, string> = {
  online:  palette.green500,
  offline: palette.ink300,
  busy:    palette.red500,
  away:    palette.amber500,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getInitialsBg(name?: string): string {
  // Deterministic color based on name
  const colors = [
    palette.navy500, palette.mint600, palette.sky400,
    palette.amber500, palette.red500, palette.green500,
  ];
  if (!name) return palette.ink400;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Avatar Component ─────────────────────────────────────────────────────

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 'md',
  variant = 'circle',
  status,
  style,
}) => {
  const [imgError, setImgError] = useState(false);
  const dim = SIZE_MAP[size];
  const borderRadius = variant === 'circle' ? radiusFull : dim * 0.2;
  const showFallback = !uri || imgError;

  return (
    <View style={[styles.wrapper, { width: dim, height: dim }, style]}>
      {showFallback ? (
        <View
          style={[
            styles.fallback,
            { width: dim, height: dim, borderRadius, backgroundColor: getInitialsBg(name) },
          ]}
        >
          <Text style={[styles.initials, { fontSize: FONT_SIZE_MAP[size] }]}>
            {getInitials(name)}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={{ width: dim, height: dim, borderRadius }}
          onError={() => setImgError(true)}
        />
      )}

      {status && (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: STATUS_COLORS[status],
              width:  dim * 0.28,
              height: dim * 0.28,
              borderRadius: radiusFull,
              right:  0,
              bottom: 0,
            },
          ]}
        />
      )}
    </View>
  );
};

export default Avatar;

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: palette.white,
    fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: palette.white,
  },
});
