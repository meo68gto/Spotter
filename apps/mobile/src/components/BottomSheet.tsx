import React, {
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { palette } from '../theme/tokens/colors';
import { radiusLg } from '../theme/tokens/radius';
import { spaceMd, spaceLg, spaceXs } from '../theme/tokens/spacing';
import { durationNormal, easingOut } from '../theme/tokens/motion';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Max height as fraction of screen height (0–1). Default: 0.9 */
  maxHeightRatio?: number;
  /** If true, the sheet cannot be dismissed by tapping the backdrop */
  blocking?: boolean;
  children: ReactNode;
}

// ─── BottomSheet Component ───────────────────────────────────────────────────

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  maxHeightRatio = 0.9,
  blocking = false,
  children,
}) => {
  const translateY  = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOp  = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: durationNormal,
        easing: easingOut,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOp, {
        toValue: 1,
        duration: durationNormal,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOp]);

  const animateOut = useCallback((cb?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: durationNormal,
        easing: easingOut,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOp, {
        toValue: 0,
        duration: durationNormal,
        useNativeDriver: true,
      }),
    ]).start(() => cb?.());
  }, [translateY, backdropOp]);

  useEffect(() => {
    if (visible) {
      animateIn();
    }
  }, [visible, animateIn]);

  const handleClose = useCallback(() => {
    if (blocking) return;
    animateOut(onClose);
  }, [blocking, animateOut, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOp }]}
        pointerEvents={blocking ? 'none' : 'auto'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            maxHeight: SCREEN_H * maxHeightRatio,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleBar} />

        {/* Title */}
        {title && (
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{title}</Text>
            {!blocking && (
              <Pressable onPress={handleClose} hitSlop={8}>
                <Text style={styles.closeBtn}>✕</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Content */}
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

export default BottomSheet;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.white,
    borderTopLeftRadius: radiusLg,
    borderTopRightRadius: radiusLg,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    overflow: 'hidden',
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.ink300,
    marginTop: spaceMd,
    marginBottom: spaceXs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spaceMd,
    paddingVertical: spaceMd,
    borderBottomWidth: 1,
    borderBottomColor: palette.ink200,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.ink900,
  },
  closeBtn: {
    fontSize: 18,
    color: palette.ink400,
    paddingHorizontal: spaceXs,
  },
  scrollContent: {
    padding: spaceMd,
  },
});
