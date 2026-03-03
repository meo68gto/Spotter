import React, { useRef, useEffect } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { palette } from '../theme/tokens/colors';
import { radiusMd, radiusFull } from '../theme/tokens/radius';
import { spaceXs, spaceSm, spaceMd } from '../theme/tokens/spacing';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkeletonVariant = 'text' | 'circle' | 'rect' | 'card' | 'listItem' | 'avatar';

export interface SkeletonLoaderProps {
  variant?: SkeletonVariant;
  /** Number of repeated items (for list variants) */
  count?:   number;
  /** Override width */
  width?:   number | string;
  /** Override height */
  height?:  number;
  style?:   ViewStyle;
}

// ─── Animated Shimmer Hook ─────────────────────────────────────────────────────────

function useShimmer() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return shimmer;
}

// ─── Shimmer Box (base element) ────────────────────────────────────────────────────

interface ShimmerBoxProps {
  width?:        number | string;
  height?:       number;
  borderRadius?: number;
  style?:        ViewStyle;
  shimmer:       Animated.Value;
}

function ShimmerBox({ width, height, borderRadius, style, shimmer }: ShimmerBoxProps) {
  const bg = shimmer.interpolate({
    inputRange:  [0, 1],
    outputRange: [palette.gray100, palette.gray200],
  });

  return (
    <Animated.View
      style={[
        {
          width:        width ?? '100%',
          height:       height ?? 16,
          borderRadius: borderRadius ?? radiusMd,
          backgroundColor: bg,
        },
        style,
      ]}
    />
  );
}

// ─── Variant Layouts ───────────────────────────────────────────────────────────

function ListItemSkeleton({ shimmer }: { shimmer: Animated.Value }) {
  return (
    <View style={styles.listItemRow}>
      <ShimmerBox shimmer={shimmer} width={44} height={44} borderRadius={radiusFull} />
      <View style={styles.listItemText}>
        <ShimmerBox shimmer={shimmer} width="70%" height={14} />
        <ShimmerBox shimmer={shimmer} width="50%" height={11} style={styles.textGap} />
      </View>
    </View>
  );
}

function CardSkeleton({ shimmer }: { shimmer: Animated.Value }) {
  return (
    <View style={styles.card}>
      <ShimmerBox shimmer={shimmer} width="100%" height={140} borderRadius={0} />
      <View style={styles.cardBody}>
        <ShimmerBox shimmer={shimmer} width="80%" height={16} />
        <ShimmerBox shimmer={shimmer} width="60%" height={12} style={styles.textGap} />
        <ShimmerBox shimmer={shimmer} width="40%" height={12} style={styles.textGap} />
      </View>
    </View>
  );
}

// ─── SkeletonLoader Component ──────────────────────────────────────────────────

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'text',
  count   = 1,
  width,
  height,
  style,
}) => {
  const shimmer = useShimmer();
  const items   = Array.from({ length: count });

  if (variant === 'circle' || variant === 'avatar') {
    const dim = height ?? (variant === 'avatar' ? 48 : 40);
    return (
      <View style={[styles.row, style]}>
        {items.map((_, i) => (
          <ShimmerBox key={i} shimmer={shimmer} width={dim} height={dim} borderRadius={radiusFull} />
        ))}
      </View>
    );
  }

  if (variant === 'card') {
    return (
      <View style={style}>
        {items.map((_, i) => <CardSkeleton key={i} shimmer={shimmer} />)}
      </View>
    );
  }

  if (variant === 'listItem') {
    return (
      <View style={style}>
        {items.map((_, i) => <ListItemSkeleton key={i} shimmer={shimmer} />)}
      </View>
    );
  }

  // text or rect
  const br = variant === 'rect' ? radiusMd : radiusFull;
  return (
    <View style={[styles.column, style]}>
      {items.map((_, i) => (
        <ShimmerBox
          key={i}
          shimmer={shimmer}
          width={width ?? '100%'}
          height={height ?? (variant === 'rect' ? 80 : 14)}
          borderRadius={br}
          style={i > 0 ? styles.gap : undefined}
        />
      ))}
    </View>
  );
};

export default SkeletonLoader;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spaceSm,
    flexWrap: 'wrap',
  },
  column: {
    gap: spaceSm,
  },
  gap: {
    marginTop: spaceSm,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceMd,
    paddingVertical: spaceSm,
  },
  listItemText: {
    flex: 1,
    gap: spaceXs,
  },
  textGap: {
    marginTop: spaceXs,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: radiusMd,
    overflow: 'hidden',
    marginBottom: spaceMd,
  },
  cardBody: {
    padding: spaceMd,
    gap: spaceXs,
  },
});
