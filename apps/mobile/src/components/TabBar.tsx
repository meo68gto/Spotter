import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../theme/tokens/colors';
import { spaceXs, spaceMd } from '../theme/tokens/spacing';
import { durationFast, easingOut } from '../theme/tokens/motion';
import { elevation } from '../theme/tokens/elevation';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TabBarTab {
  key:      string;
  label:    string;
  icon:     keyof typeof Ionicons.glyphMap;
  iconActive?: keyof typeof Ionicons.glyphMap;
  badge?:   number;
}

export interface TabBarProps {
  tabs:          TabBarTab[];
  activeTab:     string;
  onTabChange:   (key: string) => void;
  /** Background color (defaults to navy600) */
  bgColor?:      string;
  /** Active tint color (defaults to mint500) */
  activeTint?:   string;
  /** Inactive tint color (defaults to navy200) */
  inactiveTint?: string;
  style?:        ViewStyle;
}

// ─── TabBarItem ───────────────────────────────────────────────────────────

interface TabBarItemProps {
  tab:         TabBarTab;
  isActive:    boolean;
  onPress:     () => void;
  activeTint:  string;
  inactiveTint: string;
}

function TabBarItem({ tab, isActive, onPress, activeTint, inactiveTint }: TabBarItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.88,
      duration: durationFast,
      easing: easingOut,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: durationFast,
      easing: easingOut,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const iconName = isActive
    ? (tab.iconActive ?? tab.icon)
    : tab.icon;

  const tint = isActive ? activeTint : inactiveTint;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
    >
      <Animated.View
        style={[
          styles.tabContent,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Active indicator dot */}
        {isActive && (
          <View style={[styles.activeDot, { backgroundColor: activeTint }]} />
        )}

        <View style={styles.iconWrapper}>
          <Ionicons name={iconName} size={22} color={tint} />
          {tab.badge !== undefined && tab.badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.tabLabel, { color: tint }]}>
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── TabBar Component ─────────────────────────────────────────────────────────

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  bgColor      = palette.navy600,
  activeTint   = palette.mint500,
  inactiveTint = palette.navy200,
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:  bgColor,
          paddingBottom:    Math.max(insets.bottom, 8),
        },
        elevation.xl as ViewStyle,
        style,
      ]}
    >
      {tabs.map((tab) => (
        <TabBarItem
          key={tab.key}
          tab={tab}
          isActive={activeTab === tab.key}
          onPress={() => onTabChange(tab.key)}
          activeTint={activeTint}
          inactiveTint={inactiveTint}
        />
      ))}
    </View>
  );
};

export default TabBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: spaceXs + 2,
    borderTopWidth: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabContent: {
    alignItems: 'center',
    paddingHorizontal: spaceXs,
    paddingTop: 4,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginBottom: 2,
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.red500,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: palette.navy600,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.white,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
