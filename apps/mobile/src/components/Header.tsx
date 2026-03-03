import React, { type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../theme/tokens/colors';
import { spaceSm, spaceMd, spaceLg } from '../theme/tokens/spacing';
import { elevation } from '../theme/tokens/elevation';
import { typography } from '../theme/tokens/typography';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HeaderVariant = 'default' | 'transparent' | 'colored';

export interface HeaderAction {
  icon:    keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?:  number;
  label?:  string;
}

export interface HeaderProps {
  title?:        string;
  subtitle?:     string;
  variant?:      HeaderVariant;
  /** Show a back chevron that calls onBack when pressed */
  showBack?:     boolean;
  onBack?:       () => void;
  /** Right-side action buttons (max 3) */
  rightActions?: HeaderAction[];
  /** Custom left content (overrides back button) */
  leftContent?:  ReactNode;
  /** Custom right content (overrides rightActions) */
  rightContent?: ReactNode;
  /** Custom center content (overrides title/subtitle) */
  centerContent?: ReactNode;
  /** Apply safe-area top inset (default: true) */
  safeArea?:     boolean;
  style?:        ViewStyle;
}

// ─── Header Component ─────────────────────────────────────────────────────────

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  variant     = 'default',
  showBack    = false,
  onBack,
  rightActions,
  leftContent,
  rightContent,
  centerContent,
  safeArea    = true,
  style,
}) => {
  const insets = useSafeAreaInsets();

  const bgColor = variant === 'colored'
    ? palette.navy600
    : variant === 'transparent'
      ? 'transparent'
      : palette.white;

  const textColor = variant === 'colored'
    ? palette.white
    : palette.ink900;

  const iconColor = variant === 'colored'
    ? palette.white
    : palette.ink700;

  const topPad = safeArea ? insets.top : 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgColor, paddingTop: topPad },
        variant !== 'transparent' && (elevation.xs as ViewStyle),
        style,
      ]}
    >
      <View style={styles.inner}>
        {/* Left side */}
        <View style={styles.side}>
          {leftContent ? (
            leftContent
          ) : showBack ? (
            <Pressable
              onPress={onBack}
              style={styles.backBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={iconColor} />
            </Pressable>
          ) : null}
        </View>

        {/* Center */}
        <View style={styles.center}>
          {centerContent ? centerContent : (
            <>
              {title && (
                <Text
                  style={[styles.title, { color: textColor }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text
                  style={[
                    styles.subtitle,
                    { color: variant === 'colored' ? 'rgba(255,255,255,0.7)' : palette.ink500 },
                  ]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Right side */}
        <View style={[styles.side, styles.sideRight]}>
          {rightContent ? rightContent : (
            rightActions?.slice(0, 3).map((action, i) => (
              <Pressable
                key={i}
                onPress={action.onPress}
                style={styles.actionBtn}
                hitSlop={6}
              >
                <Ionicons name={action.icon} size={22} color={iconColor} />
                {action.badge !== undefined && action.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {action.badge > 99 ? '99+' : action.badge}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))
          )}
        </View>
      </View>
    </View>
  );
};

export default Header;

const HEADER_H = Platform.OS === 'ios' ? 44 : 56;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.ink200,
  },
  inner: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spaceMd,
  },
  side: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
    gap: spaceSm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spaceSm,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 1,
  },
  actionBtn: {
    position: 'relative',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.red500,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: palette.white,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.white,
  },
});
