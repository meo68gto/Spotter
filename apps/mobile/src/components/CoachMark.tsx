import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { radiusMd, radiusLg, radiusFull } from '../theme/tokens/radius';
import { spaceXs, spaceSm, spaceMd, spaceLg } from '../theme/tokens/spacing';
import { durationNormal, easingOut } from '../theme/tokens/motion';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

export type CoachMarkPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface CoachMarkStep {
  title:       string;
  description: string;
  /** x,y coordinates of the element being highlighted (from measure()) */
  targetX?:    number;
  targetY?:    number;
  targetW?:    number;
  targetH?:    number;
  placement?:  CoachMarkPlacement;
}

export interface CoachMarkProps {
  steps:     CoachMarkStep[];
  visible:   boolean;
  onFinish:  () => void;
  onSkip?:   () => void;
  /** Custom text for the final "Finish" button */
  finishLabel?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOOLTIP_W = Math.min(SCREEN_W - spaceLg * 2, 320);
const TOOLTIP_OFFSET = 12; // gap between highlight and tooltip

function getTooltipPosition(step: CoachMarkStep): ViewStyle {
  if (!step.targetX && step.placement !== 'center') {
    return { top: SCREEN_H / 2 - 80, left: (SCREEN_W - TOOLTIP_W) / 2 };
  }

  const tx = step.targetX ?? 0;
  const ty = step.targetY ?? 0;
  const tw = step.targetW ?? 0;
  const th = step.targetH ?? 0;

  switch (step.placement) {
    case 'top':
      return {
        top: ty - 120 - TOOLTIP_OFFSET,
        left: Math.max(spaceLg, Math.min(tx - 20, SCREEN_W - TOOLTIP_W - spaceLg)),
      };
    case 'bottom':
      return {
        top: ty + th + TOOLTIP_OFFSET,
        left: Math.max(spaceLg, Math.min(tx - 20, SCREEN_W - TOOLTIP_W - spaceLg)),
      };
    case 'left':
      return {
        top: Math.max(spaceLg, ty - 40),
        left: Math.max(spaceLg, tx - TOOLTIP_W - TOOLTIP_OFFSET),
      };
    case 'right':
      return {
        top: Math.max(spaceLg, ty - 40),
        left: Math.min(tx + tw + TOOLTIP_OFFSET, SCREEN_W - TOOLTIP_W - spaceLg),
      };
    default:
      return { top: SCREEN_H / 2 - 80, left: (SCREEN_W - TOOLTIP_W) / 2 };
  }
}

// ─── CoachMark Component ───────────────────────────────────────────────────

export const CoachMark: React.FC<CoachMarkProps> = ({
  steps,
  visible,
  onFinish,
  onSkip,
  finishLabel = 'Got it!',
}) => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: durationNormal,
          easing: easingOut,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: durationNormal,
          easing: easingOut,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  const animateStep = useCallback(() => {
    scaleAnim.setValue(0.95);
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 180,
      easing: easingOut,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handleNext = useCallback(() => {
    if (isLast) {
      onFinish();
    } else {
      setCurrentStep(s => s + 1);
      animateStep();
    }
  }, [isLast, onFinish, animateStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
      animateStep();
    }
  }, [currentStep, animateStep]);

  if (!visible || !step) return null;

  const tooltipPos = getTooltipPosition(step);

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Highlight */}
        {step.targetX !== undefined && (
          <View
            style={[
              styles.highlight,
              {
                left:   (step.targetX  ?? 0) - 4,
                top:    (step.targetY  ?? 0) - 4,
                width:  (step.targetW ?? 40) + 8,
                height: (step.targetH ?? 40) + 8,
              },
            ]}
          />
        )}

        {/* Tooltip */}
        <Animated.View
          style={[
            styles.tooltip,
            tooltipPos,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Step counter */}
          <View style={styles.stepCounter}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.stepDot,
                  i === currentStep && styles.stepDotActive,
                ]}
              />
            ))}
          </View>

          {/* Content */}
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          {/* Actions */}
          <View style={styles.actions}>
            {onSkip && (
              <Pressable onPress={onSkip} style={styles.skipBtn}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            )}
            <View style={styles.navBtns}>
              {currentStep > 0 && (
                <Pressable onPress={handlePrev} style={styles.prevBtn}>
                  <Ionicons name="chevron-back" size={16} color={palette.ink500} />
                </Pressable>
              )}
              <Pressable onPress={handleNext} style={styles.nextBtn}>
                <Text style={styles.nextText}>{isLast ? finishLabel : 'Next'}</Text>
                {!isLast && <Ionicons name="chevron-forward" size={14} color={palette.white} />}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default CoachMark;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  highlight: {
    position: 'absolute',
    borderRadius: radiusMd,
    borderWidth: 2,
    borderColor: palette.mint500,
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_W,
    backgroundColor: palette.white,
    borderRadius: radiusLg,
    padding: spaceLg,
    gap: spaceSm,
  },
  stepCounter: {
    flexDirection: 'row',
    gap: spaceXs,
    marginBottom: spaceXs,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: radiusFull,
    backgroundColor: palette.ink200,
  },
  stepDotActive: {
    backgroundColor: palette.mint500,
    width: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  description: {
    fontSize: 14,
    color: palette.ink600,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spaceSm,
  },
  skipBtn: {
    paddingVertical: spaceXs,
    paddingHorizontal: spaceSm,
  },
  skipText: {
    fontSize: 13,
    color: palette.ink400,
  },
  navBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceSm,
    marginLeft: 'auto',
  },
  prevBtn: {
    width: 32,
    height: 32,
    borderRadius: radiusFull,
    backgroundColor: palette.ink100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.navy600,
    paddingHorizontal: spaceMd,
    paddingVertical: spaceXs + 2,
    borderRadius: radiusFull,
  },
  nextText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.white,
  },
});
