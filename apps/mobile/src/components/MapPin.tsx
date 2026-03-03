import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { radiusFull, radiusLg, radiusMd } from '../theme/tokens/radius';
import { spaceXs, spaceSm, spaceMd } from '../theme/tokens/spacing';
import { elevation } from '../theme/tokens/elevation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MapPinVariant =
  | 'default'
  | 'selected'
  | 'player'
  | 'coach'
  | 'event'
  | 'cluster';

export interface MapPinProps {
  variant?:  MapPinVariant;
  label?:    string;
  count?:    number;   // for cluster variant
  onPress?:  () => void;
  style?:    ViewStyle;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<MapPinVariant, {
  bg:        string;
  iconColor: string;
  icon:      keyof typeof Ionicons.glyphMap;
  size:      number;
}> = {
  default:  { bg: palette.navy600,  iconColor: palette.white,  icon: 'location',          size: 20 },
  selected: { bg: palette.mint500,  iconColor: palette.white,  icon: 'location',          size: 24 },
  player:   { bg: palette.sky400,   iconColor: palette.white,  icon: 'person',            size: 18 },
  coach:    { bg: palette.amber500, iconColor: palette.white,  icon: 'school',            size: 18 },
  event:    { bg: palette.red500,   iconColor: palette.white,  icon: 'calendar',          size: 18 },
  cluster:  { bg: palette.navy600,  iconColor: palette.white,  icon: 'ellipsis-horizontal', size: 16 },
};

// ─── MapPin Component ───────────────────────────────────────────────────────

export const MapPin: React.FC<MapPinProps> = ({
  variant  = 'default',
  label,
  count,
  onPress,
  style,
}) => {
  const config    = VARIANT_CONFIG[variant];
  const isCluster = variant === 'cluster';
  const isSelected = variant === 'selected';

  const pinSize = isSelected ? 52 : isCluster ? 44 : 40;

  const inner = (
    <View style={[styles.wrapper, style]}>
      {/* Pin body */}
      <View
        style={[
          styles.pin,
          {
            width:           pinSize,
            height:          pinSize,
            borderRadius:    radiusFull,
            backgroundColor: config.bg,
          },
          isSelected && (elevation.md as ViewStyle),
        ]}
      >
        {isCluster && count !== undefined ? (
          <Text style={styles.clusterCount}>{count > 99 ? '99+' : count}</Text>
        ) : (
          <Ionicons name={config.icon} size={config.size} color={config.iconColor} />
        )}
      </View>

      {/* Tail */}
      {!isCluster && (
        <View
          style={[
            styles.tail,
            { borderTopColor: config.bg },
          ]}
        />
      )}

      {/* Label callout */}
      {label && (
        <View style={styles.callout}>
          <Text style={styles.calloutText} numberOfLines={1}>{label}</Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8}>
        {inner}
      </Pressable>
    );
  }

  return inner;
};

export default MapPin;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.white,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  clusterCount: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.white,
  },
  callout: {
    position: 'absolute',
    top: -32,
    backgroundColor: palette.white,
    borderRadius: radiusMd,
    paddingHorizontal: spaceSm,
    paddingVertical: spaceXs,
    ...(elevation.sm as ViewStyle),
    maxWidth: 120,
  },
  calloutText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.ink800,
  },
});
