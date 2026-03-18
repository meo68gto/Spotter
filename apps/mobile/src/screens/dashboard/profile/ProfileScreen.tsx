import { Session } from '@supabase/supabase-js';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Skeleton } from '../../../components/Skeleton';
import { fireRefreshDoneHaptic, fireRefreshStartHaptic } from '../../../lib/haptics';
import { motion } from '../../../lib/motion';
import { useProfileDashboard } from '../../../hooks/useProfileDashboard';
import { useTheme } from '../../../theme/provider';

type Target = 'edit' | 'skills' | 'history' | 'videos' | 'settings';

export function ProfileScreen({ session, onNavigate }: { session: Session; onNavigate: (target: Target) => void }) {
  const { tokens } = useTheme();
  const dashboard = useProfileDashboard(session);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tokens.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={dashboard.loading}
          onRefresh={async () => {
            await fireRefreshStartHaptic();
            await dashboard.refresh();
            await fireRefreshDoneHaptic();
          }}
        />
      }
    >
      {/* @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated */}
      <Animated.View entering={motion.screenEnter} style={[styles.hero, { backgroundColor: tokens.primary }]}>
        <Text style={[styles.title, { color: tokens.primaryContrast }]}>{dashboard.profile?.display_name || 'Profile'}</Text>
        <Text style={[styles.subtitle, { color: tokens.primaryContrast }]}>{dashboard.profile?.bio || 'Complete your profile to improve match quality.'}</Text>
      </Animated.View>

      {dashboard.loading && !dashboard.profile ? (
        <>
          <Skeleton style={styles.skeleton} />
          <Skeleton style={styles.skeleton} />
        </>
      ) : null}

      <View style={styles.statsRow}>
        {/* @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated */}
        <Animated.View entering={motion.cardEnter} style={[styles.statCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={[styles.statLabel, { color: tokens.textMuted }]}>Buddy Rating</Text>
          <Text style={[styles.statValue, { color: tokens.text }]}>{dashboard.feedback ? `${dashboard.feedback.positiveRatio.toFixed(1)}%` : 'n/a'}</Text>
        </Animated.View>
        {/* @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated */}
        <Animated.View entering={motion.cardEnter} style={[styles.statCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={[styles.statLabel, { color: tokens.textMuted }]}>Reviews</Text>
          <Text style={[styles.statValue, { color: tokens.text }]}>{dashboard.feedback?.totalFeedback ?? 0}</Text>
        </Animated.View>
      </View>

      <Action title="Edit Profile" tokens={tokens} onPress={() => onNavigate('edit')} />
      <Action title="Skill Radar" tokens={tokens} onPress={() => onNavigate('skills')} />
      <Action title="Match History" tokens={tokens} onPress={() => onNavigate('history')} />
      <Action title="Video Pipeline" tokens={tokens} onPress={() => onNavigate('videos')} />
      <Action title="Settings" tokens={tokens} onPress={() => onNavigate('settings')} />
    </ScrollView>
  );
}

function Action({
  title,
  onPress,
  tokens
}: {
  title: string;
  onPress: () => void;
  tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  return (
    // @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated
    <Animated.View entering={motion.cardEnter}>
      <TouchableOpacity style={[styles.action, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={onPress}>
        <Text style={[styles.actionText, { color: tokens.text }]}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  hero: { borderRadius: 16, padding: 16 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 6, opacity: 0.9 },
  skeleton: {
    marginTop: 10,
    height: 80,
    width: '100%'
  },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  statLabel: {},
  statValue: { fontWeight: '800', fontSize: 24, marginTop: 4 },
  action: { marginTop: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  actionText: { fontWeight: '700' }
});
