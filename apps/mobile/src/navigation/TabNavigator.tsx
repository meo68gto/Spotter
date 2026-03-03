/**
 * Spotter — 5-Tab Bottom Tab Navigator
 *
 * Tabs:
 *   Home      — PersonalizedHome (new)
 *   Discover  — Map + networking + events + matches
 *   Coaching  — Experts + ask + feed + sessions
 *   Inbox     — Requests + messages
 *   Profile   — Profile + videos + progress + expert console
 *
 * Design decisions:
 *   - Tab bar uses Spotter navy (#1B2B4B) background with mint active tint
 *   - Custom tab icons from @expo/vector-icons Ionicons set
 *   - Tab labels always visible (no hide-on-scroll at this stage)
 *   - Each tab renders its own stack navigator (HomeStack, DiscoverStack, etc.)
 *   - Session is accessed via SessionContext — no prop drilling
 */

import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { TabParamList } from './types';

// Stack navigators for each tab
import HomeStack from './HomeStack';
import DiscoverStack from './DiscoverStack';
import CoachingStack from './CoachingStack';
import InboxStack from './InboxStack';
import ProfileStack from './ProfileStack';

const Tab = createBottomTabNavigator<TabParamList>();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAV_BG = '#1B2B4B';       // navy600
const ACTIVE_TINT = '#2DD4A8';  // mint500
const INACTIVE_TINT = '#9FB0CE'; // navy200

// ---------------------------------------------------------------------------
// TabNavigator
// ---------------------------------------------------------------------------

export default function TabNavigator(): React.ReactElement {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: NAV_BG,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: ACTIVE_TINT,
        tabBarInactiveTintColor: INACTIVE_TINT,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: -2,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const iconMap: Record<string, { active: string; inactive: string }> = {
            HomeTab:     { active: 'home',           inactive: 'home-outline' },
            DiscoverTab: { active: 'compass',        inactive: 'compass-outline' },
            CoachingTab: { active: 'school',         inactive: 'school-outline' },
            InboxTab:    { active: 'chatbubbles',    inactive: 'chatbubbles-outline' },
            ProfileTab:  { active: 'person-circle',  inactive: 'person-circle-outline' },
          };
          const icons = iconMap[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab"     component={HomeStack}     options={{ title: 'Home' }} />
      <Tab.Screen name="DiscoverTab" component={DiscoverStack} options={{ title: 'Discover' }} />
      <Tab.Screen name="CoachingTab" component={CoachingStack} options={{ title: 'Coaching' }} />
      <Tab.Screen name="InboxTab"    component={InboxStack}    options={{ title: 'Inbox' }} />
      <Tab.Screen name="ProfileTab"  component={ProfileStack}  options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
