import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { palette } from '../theme/tokens/colors';
import { durationSlow, easingInOut } from '../theme/tokens/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgressRingSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ProgressRingProps {
  /** Progress value 0–100 */
  progress:    number;
  size?:       ProgressRingSize;
  /** Stroke color (defaults to mint500) */
  color?:      string;
  /** Track color (defaults to ink200) */
  trackColor?: string;
  /** Show percentage label in center */
  showLabel?:  boolean;
  /** Custom center label */
  label?:      string;
  /** Custom sublabel below percentage */
  sublabel?:   string;
  /** Animate progress change (default: true) */
  animated?:   boolean;
  style?:      ViewStyle;
}

// ─── Size config ──────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<ProgressRingSize, { dim: number; stroke: number; fontSize: number; subFontSize: number }> = {
  sm: { dim: 48,  stroke: 4,  fontSize: 12, subFontSize: 9  },
  md: { dim: 72,  stroke: 6,  fontSize: 16, subFontSize: 10 },
  lg: { dim: 100, stroke: 8,  fontSize: 22, subFontSize: 12 },
  xl: { dim: 136, stroke: 10, fontSize: 30, subFontSize: 14 },
};

// ─── Animated Circle ───────────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── ProgressRing Component ───────────────────────────────────────────────────

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size      = 'md',
  color     = palette.mint500,
  trackColor = palette.ink200,
  showLabel  = true,
  label,
  sublabel,
  animated   = true,
  style,
}) => {
  const cfg     = SIZE_CONFIG[size];
  const radius  = (cfg.dim - cfg.stroke) / 2;
  const circumf = 2 * Math.PI * radius;
  const center  = cfg.dim / 2;

  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const clampedProgress = Math.min(100, Math.max(0, progress));
    if (animated) {
      Animated.timing(animValue, {
        toValue: clampedProgress,
        duration: durationSlow,
        easing: easingInOut,
        useNativeDriver: false,
      }).start();
    } else {
      animValue.setValue(clampedProgress);
    }
  }, [progress, animated]);

  const strokeDashoffset = animValue.interpolate({
    inputRange:  [0, 100],
    outputRange: [circumf, 0],
  });

  const displayLabel = label ?? `${Math.round(progress)}%`;

  return (
    <View style={[styles.container, { width: cfg.dim, height: cfg.dim }, style]}>
      <Svg width={cfg.dim} height={cfg.dim}>
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={cfg.stroke}
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={cfg.stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumf}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90, ${center}, ${center})`}
        />
      </Svg>

      {/* Center label */}
      {showLabel && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.labelContainer}>
            <Text style={[styles.label, { fontSize: cfg.fontSize, color }]}>
              {displayLabel}
            </Text>
            {sublabel && (
              <Text style={[styles.sublabel, { fontSize: cfg.subFontSize }]}>
                {sublabel}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default ProgressRing;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  labelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '800',
    textAlign: 'center',
  },
  sublabel: {
    color: palette.ink500,
    marginTop: 1,
    textAlign: 'center',
  },
});
