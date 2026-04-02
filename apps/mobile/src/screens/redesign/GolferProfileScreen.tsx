import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TierBadge } from '../../components/TierBadge';
import { DiscoverableGolfer } from '@spotter/types';
import { palette, radius, spacing } from '../../theme/design';

export function GolferProfileScreen({
  golfer,
  onBack,
  onInvite,
  onSave,
}: {
  golfer: DiscoverableGolfer;
  onBack: () => void;
  onInvite: () => void;
  onSave: () => void;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.eyebrow}>Golfer profile</Text>
        <Text style={styles.title}>{golfer.display_name}</Text>
        <Text style={styles.subtitle}>
          {golfer.city ?? 'Location hidden'} • {Math.round(golfer.compatibility_score)}% compatibility
        </Text>
        <View style={styles.badges}>
          <TierBadge tier={golfer.tier_slug as 'free' | 'select' | 'summit'} size="sm" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Reputation {Math.round(golfer.reputation_score)}</Text>
          </View>
        </View>
        <Button title="Invite to play" onPress={onInvite} />
        <Button title="Save golfer" onPress={onSave} tone="secondary" />
        <Button title="Back" onPress={onBack} tone="ghost" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Why you match</Text>
        <Text style={styles.body}>
          {golfer.golf?.handicap !== undefined ? `Handicap ${golfer.golf.handicap}. ` : ''}
          {golfer.golf?.home_course_name ? `Home course ${golfer.golf.home_course_name}. ` : ''}
          {golfer.networking_preferences?.networking_intent ? `Intent ${formatIntent(golfer.networking_preferences.networking_intent)}. ` : ''}
          {golfer.networking_preferences?.preferred_golf_area ? `Prefers ${golfer.networking_preferences.preferred_golf_area}.` : ''}
        </Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Golf identity</Text>
        <Text style={styles.body}>Profile completeness {golfer.profile_completeness}%</Text>
        <Text style={styles.body}>Joined {new Date(golfer.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</Text>
        {golfer.golf?.playing_frequency ? <Text style={styles.body}>Plays {golfer.golf.playing_frequency}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Professional context</Text>
        <Text style={styles.body}>{golfer.professional?.title ?? 'Role not shared'}</Text>
        <Text style={styles.body}>{golfer.professional?.company ?? 'Company not shared'}</Text>
        <Text style={styles.body}>{golfer.professional?.industry ?? 'Industry not shared'}</Text>
      </Card>
    </ScrollView>
  );
}

function formatIntent(intent: string) {
  if (intent === 'business_social') return 'Business + Social';
  return intent.charAt(0).toUpperCase() + intent.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.sky100 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  eyebrow: { color: palette.amber500, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs },
  title: { color: palette.ink900, fontSize: 28, fontWeight: '900' },
  subtitle: { color: palette.ink700, marginTop: spacing.xs, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  badge: { borderRadius: radius.pill, backgroundColor: '#f6f3ea', borderWidth: 1, borderColor: '#dccfa8', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badgeText: { color: '#173528', fontWeight: '700' },
  sectionTitle: { color: palette.ink900, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  body: { color: palette.ink700, lineHeight: 21, marginBottom: spacing.xs },
});
