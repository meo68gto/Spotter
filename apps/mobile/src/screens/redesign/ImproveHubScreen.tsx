import { Session } from '@supabase/supabase-js';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useSkillRadarData } from '../../hooks/useSkillRadarData';
import { palette, radius, spacing } from '../../theme/design';

export function ImproveHubScreen({
  session,
  onOpenCoaching,
  onOpenVideo,
}: {
  session: Session;
  onOpenCoaching: () => void;
  onOpenVideo: () => void;
}) {
  const { points } = useSkillRadarData(session);

  const highlights = useMemo(() => {
    return [...points]
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [points]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Improve</Text>
        <Text style={styles.heroTitle}>A better golf network gets stronger when your game does too.</Text>
        <Text style={styles.heroBody}>Keep coaching, swing analysis, and visible progress in one premium improvement lane.</Text>
      </View>

      <View style={styles.twoUp}>
        <Card>
          <Text style={styles.sectionTitle}>Coaching</Text>
          <Text style={styles.cardTitle}>Book outcome-focused coaching</Text>
          <Text style={styles.cardBody}>Browse coaches, see proof, and book a session around the part of your game that needs work.</Text>
          <Button title="Browse coaches" onPress={onOpenCoaching} />
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>Swing analysis</Text>
          <Text style={styles.cardTitle}>Upload and review your swing</Text>
          <Text style={styles.cardBody}>Video analysis and AI annotations stay connected to your coaching and progress history.</Text>
          <Button title="Open videos" onPress={onOpenVideo} tone="secondary" />
        </Card>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Progress snapshot</Text>
        {highlights.length === 0 ? (
          <Text style={styles.cardBody}>Your improvement dashboard will populate after coaching sessions or skill-profile updates.</Text>
        ) : (
          highlights.map((point) => (
            <View key={point.key} style={styles.metricRow}>
              <View style={styles.metricTrack}>
                <View style={[styles.metricFill, { width: `${Math.max(6, (point.value / point.maxValue) * 100)}%` }]} />
              </View>
              <Text style={styles.metricLabel}>{point.label}</Text>
              <Text style={styles.metricValue}>{point.value}</Text>
            </View>
          ))
        )}
        <TouchableOpacity onPress={onOpenVideo}>
          <Text style={styles.linkText}>View full improvement flow</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.sky100 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  hero: { padding: spacing.xl, borderRadius: radius.lg, backgroundColor: '#173528', marginBottom: spacing.lg },
  eyebrow: { color: '#d4bf88', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs },
  heroTitle: { color: '#f7f0de', fontSize: 28, fontWeight: '900', marginBottom: spacing.sm },
  heroBody: { color: '#d6dcc7', lineHeight: 22 },
  twoUp: { gap: spacing.sm },
  sectionTitle: { color: palette.ink900, fontSize: 17, fontWeight: '800', marginBottom: spacing.xs },
  cardTitle: { color: palette.ink900, fontSize: 19, fontWeight: '800', marginBottom: spacing.xs },
  cardBody: { color: palette.ink700, lineHeight: 20 },
  metricRow: { marginTop: spacing.md },
  metricTrack: { height: 10, borderRadius: radius.pill, backgroundColor: '#ece7db', overflow: 'hidden', marginBottom: spacing.xs },
  metricFill: { height: '100%', backgroundColor: '#173528' },
  metricLabel: { color: palette.ink700, fontWeight: '700' },
  metricValue: { color: palette.ink900, fontWeight: '800', marginTop: 2 },
  linkText: { marginTop: spacing.md, color: palette.navy600, fontWeight: '700' },
});
