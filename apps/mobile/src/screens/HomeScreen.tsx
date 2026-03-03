/**
 * HomeScreen.tsx — New Personalized Home Tab (Week 1 placeholder)
 *
 * This is the new root screen for the Home tab in the 5-tab navigator.
 * Week 1 delivers a styled placeholder; full personalization
 * (activity feed, stat cards, match suggestions) ships in Week 2-3.
 *
 * Design tokens are used directly to validate the token system works
 * end-to-end before full component library adoption.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../contexts/SessionContext';
import { palette, spacing, radius } from '../theme/design';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickAction {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}

interface StatItem {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
}

// ---------------------------------------------------------------------------
// Mock data (will be replaced by real API in Week 3)
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'find',    icon: 'compass-outline',     label: 'Find Players',  color: palette.mint500 },
  { id: 'coach',   icon: 'school-outline',      label: 'Get Coached',   color: palette.sky400 },
  { id: 'message', icon: 'chatbubble-outline',  label: 'Messages',      color: palette.amber500 },
  { id: 'profile', icon: 'person-outline',      label: 'My Profile',    color: palette.navy400 },
];

const STATS: StatItem[] = [
  { label: 'Matches',     value: '24',   delta: '+3',  deltaPositive: true },
  { label: 'Sessions',    value: '8',    delta: '+1',  deltaPositive: true },
  { label: 'Rating',      value: '4.8',  delta: '0.0', deltaPositive: true },
  { label: 'Connections', value: '142',  delta: '+12', deltaPositive: true },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuickActionCard({ action }: { action: QuickAction }) {
  const [pressed, setPressed] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.quickActionCard,
        pressed && styles.quickActionCardPressed,
      ]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      activeOpacity={0.85}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
        <Ionicons name={action.icon} size={22} color={action.color} />
      </View>
      <Text style={styles.quickActionLabel}>{action.label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ stat }: { stat: StatItem }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{stat.value}</Text>
      <Text style={styles.statLabel}>{stat.label}</Text>
      {stat.delta && (
        <Text style={[
          styles.statDelta,
          { color: stat.deltaPositive ? palette.mint600 : palette.red500 },
        ]}>
          {stat.delta}
        </Text>
      )}
    </View>
  );
}

function ActivityPlaceholder() {
  return (
    <View style={styles.activityPlaceholder}>
      <Ionicons name="notifications-outline" size={32} color={palette.ink400} />
      <Text style={styles.activityPlaceholderTitle}>Activity feed coming soon</Text>
      <Text style={styles.activityPlaceholderText}>
        Match updates, coach session reminders, and community highlights
        will appear here in Week 2.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { session } = useSession();
  const firstName = session.user.user_metadata?.name?.split(' ')[0]
    ?? session.user.email?.split('@')[0]
    ?? 'Athlete';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
                'Good evening';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <TouchableOpacity style={styles.notifButton}>
            <Ionicons name="notifications-outline" size={24} color={palette.ink700} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {STATS.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <QuickActionCard key={action.id} action={action} />
          ))}
        </View>

        {/* Activity Feed */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <ActivityPlaceholder />

        {/* Bottom padding for tab bar */}
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.gray50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'android' ? spacing.xl : spacing.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  greeting: {
    fontSize: 14,
    color: palette.ink500,
    fontWeight: '400',
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.navy700,
    marginTop: 2,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.navy700,
  },
  statLabel: {
    fontSize: 10,
    color: palette.ink500,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDelta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink800,
    flex: 1,
  },

  // Section
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  seeAll: {
    fontSize: 13,
    color: palette.mint600,
    fontWeight: '600',
  },

  // Activity Placeholder
  activityPlaceholder: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityPlaceholderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink700,
    textAlign: 'center',
  },
  activityPlaceholderText: {
    fontSize: 13,
    color: palette.ink500,
    textAlign: 'center',
    lineHeight: 20,
  },

  bottomPad: {
    height: spacing.xl,
  },
});
