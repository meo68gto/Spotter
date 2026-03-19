import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, radius, spacing } from '../theme/design';

// ============================================================================
// Types
// ============================================================================

interface ReliabilityIndicatorProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getScoreColor = (score: number): string => {
  if (score >= 90) return '#059669'; // green
  if (score >= 75) return '#0891b2'; // cyan
  if (score >= 60) return '#d97706'; // amber
  return '#6b7280'; // gray
};

const getScoreRingColor = (score: number): string => {
  if (score >= 90) return '#34d399'; // light green
  if (score >= 75) return '#67e8f9'; // light cyan
  if (score >= 60) return '#fcd34d'; // light amber
  return '#9ca3af'; // light gray
};

// ============================================================================
// Component
// ============================================================================

export function ReliabilityIndicator({ 
  score, 
  label, 
  size = 'md',
  showLabel = true 
}: ReliabilityIndicatorProps) {
  const color = getScoreColor(score);
  const ringColor = getScoreRingColor(score);
  
  const sizeStyles = {
    sm: { 
      containerSize: 48, 
      strokeWidth: 3, 
      fontSize: 14, 
      labelSize: 10 
    },
    md: { 
      containerSize: 72, 
      strokeWidth: 4, 
      fontSize: 20, 
      labelSize: 12 
    },
    lg: { 
      containerSize: 96, 
      strokeWidth: 5, 
      fontSize: 28, 
      labelSize: 14 
    },
  };
  
  const s = sizeStyles[size];
  const normalizedScore = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * ((s.containerSize / 2) - (s.strokeWidth * 2));
  const strokeDashoffset = circumference * (1 - normalizedScore / 100);

  return (
    <View style={styles.container}>
      <View style={[
        styles.ringContainer, 
        { 
          width: s.containerSize, 
          height: s.containerSize 
        }
      ]}>
        {/* Background ring */}
        <View style={[
          StyleSheet.absoluteFill,
          styles.ringBackground,
          { 
            width: s.containerSize, 
            height: s.containerSize,
            borderWidth: s.strokeWidth,
            borderColor: palette.sky200
          }
        ]} />
        
        {/* Progress ring using SVG-like approach with border */}
        <View style={[
          styles.progressRing,
          {
            width: s.containerSize,
            height: s.containerSize,
            borderWidth: s.strokeWidth,
            borderColor: ringColor,
            borderRadius: s.containerSize / 2,
            // Create partial ring effect
            borderLeftColor: ringColor,
            borderTopColor: ringColor,
            borderRightColor: normalizedScore > 50 ? ringColor : palette.sky200,
            borderBottomColor: normalizedScore > 75 ? ringColor : palette.sky200,
          }
        ]} />
        
        {/* Score text */}
        <View style={styles.scoreContainer}>
          <Text style={[
            styles.scoreValue, 
            { 
              fontSize: s.fontSize, 
              color 
            }
          ]}>
            {Math.round(score)}
          </Text>
        </View>
      </View>
      
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={[
            styles.label, 
            { 
              fontSize: s.labelSize, 
              color 
            }
          ]}>
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  ringContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringBackground: {
    position: 'absolute',
    borderRadius: 999,
  },
  progressRing: {
    position: 'absolute',
  },
  scoreContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontWeight: '800',
  },
  labelContainer: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: palette.sky100,
    borderRadius: radius.sm,
  },
  label: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
