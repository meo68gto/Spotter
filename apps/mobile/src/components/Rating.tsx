import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { spaceXs } from '../theme/tokens/spacing';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RatingSize = 'sm' | 'md' | 'lg';

export interface RatingProps {
  /** Current rating value 0–5 */
  value:     number;
  /** Max stars (default: 5) */
  max?:      number;
  size?:     RatingSize;
  /** If true, renders interactive stars */
  editable?: boolean;
  /** Called with new value when a star is pressed */
  onChange?: (value: number) => void;
  /** Show numeric value next to stars */
  showValue?: boolean;
  /** Show review count next to stars */
  count?:    number;
  style?:    ViewStyle;
}

// ─── Size config ──────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<RatingSize, { starSize: number; fontSize: number }> = {
  sm: { starSize: 12, fontSize: 11 },
  md: { starSize: 16, fontSize: 13 },
  lg: { starSize: 22, fontSize: 16 },
};

// ─── Star helper ──────────────────────────────────────────────────────────────

function getStarIcon(
  starIndex: number,
  value: number
): keyof typeof Ionicons.glyphMap {
  if (value >= starIndex) return 'star';
  if (value >= starIndex - 0.5) return 'star-half';
  return 'star-outline';
}

// ─── Rating Component ─────────────────────────────────────────────────────────

export const Rating: React.FC<RatingProps> = ({
  value,
  max      = 5,
  size     = 'md',
  editable = false,
  onChange,
  showValue = false,
  count,
  style,
}) => {
  const cfg = SIZE_CONFIG[size];

  const handlePress = useCallback((starIndex: number) => {
    if (editable && onChange) {
      onChange(starIndex);
    }
  }, [editable, onChange]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.stars}>
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
          const icon = getStarIcon(star, value);
          if (editable) {
            return (
              <Pressable
                key={star}
                onPress={() => handlePress(star)}
                hitSlop={4}
              >
                <Ionicons
                  name={icon}
                  size={cfg.starSize}
                  color={icon === 'star-outline' ? palette.ink300 : palette.amber500}
                />
              </Pressable>
            );
          }
          return (
            <Ionicons
              key={star}
              name={icon}
              size={cfg.starSize}
              color={icon === 'star-outline' ? palette.ink300 : palette.amber500}
            />
          );
        })}
      </View>

      {showValue && (
        <Text style={[styles.value, { fontSize: cfg.fontSize }]}>
          {value.toFixed(1)}
        </Text>
      )}

      {count !== undefined && (
        <Text style={[styles.count, { fontSize: cfg.fontSize }]}>
          ({count.toLocaleString()})
        </Text>
      )}
    </View>
  );
};

export default Rating;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceXs,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  value: {
    fontWeight: '700',
    color: palette.ink800,
  },
  count: {
    color: palette.ink400,
  },
});
