/**
 * DrillOutcomeScreen.tsx
 * Eagle AI — Log drill completion + improvement in Spotter.
 * Part of Phase 3: Spotter Production Integration.
 */

import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useEagleCoach } from '../../hooks/useEagleCoach';
import { palette, radius, spacing } from '../../theme/design';

const STAR_LABELS = ['No improvement', 'Slight', 'Moderate', 'Good', 'Excellent'];

interface Props {
  session: Session;
  drillId: string;
  onDone: () => void;
  onBack: () => void;
}

export function DrillOutcomeScreen({ session, drillId, onDone, onBack }: Props) {
  const { trackOutcome, loading } = useEagleCoach();
  const [completed, setCompleted] = useState(true);
  const [stars, setStars] = useState(3); // 1-5 improvement scale
  const [feedback, setFeedback] = useState('');

  const improvementScore = stars / 5; // 0.2, 0.4, 0.6, 0.8, 1.0

  const handleSubmit = useCallback(async () => {
    const success = await trackOutcome(
      drillId,
      completed,
      completed ? improvementScore : undefined,
      feedback.trim() || undefined
    );

    if (success) {
      Alert.alert(
        'Drill Logged ✓',
        'Your progress has been recorded and will improve future drill recommendations.',
        [{ text: 'Done', onPress: onDone }]
      );
    } else {
      Alert.alert('Error', 'Could not log your drill. Please try again.', [
        { text: 'OK' },
      ]);
    }
  }, [drillId, completed, improvementScore, feedback, trackOutcome, onDone]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Log Drill</Text>
        <Text style={styles.subtitle}>How did it go?</Text>
      </View>

      {/* Completed toggle */}
      <Card>
        <Text style={styles.label}>Did you complete this drill?</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, completed && styles.toggleBtnActive]}
            onPress={() => setCompleted(true)}
          >
            <Text style={[styles.toggleText, completed && styles.toggleTextActive]}>✓ Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !completed && styles.toggleBtnInactive]}
            onPress={() => setCompleted(false)}
          >
            <Text style={[styles.toggleText, !completed && styles.toggleTextInactive]}>✗ No</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Star rating */}
      <Card>
        <Text style={styles.label}>Rate your improvement</Text>
        <Text style={styles.starSubtext}>{STAR_LABELS[stars - 1]}</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <TouchableOpacity key={s} onPress={() => setStars(s)} style={styles.starBtn}>
              <Text style={[styles.star, s <= stars && styles.starActive]}>
                {s <= stars ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.starScale}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Text key={i} style={styles.scaleLabel}>{STAR_LABELS[i]}</Text>
          ))}
        </View>
      </Card>

      {/* Feedback */}
      <Card>
        <Text style={styles.label}>Any feedback? (optional)</Text>
        <TextInput
          style={styles.feedbackInput}
          placeholder="What worked? What didn't? Any pain or discomfort?"
          placeholderTextColor={palette.ink300}
          value={feedback}
          onChangeText={setFeedback}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </Card>

      <Button
        title={loading ? 'Saving...' : 'Save Outcome'}
        onPress={handleSubmit}
        disabled={loading}
        tone="primary"
      />

      <Text style={styles.disclaimer}>
        Your feedback is used to improve future drill recommendations.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.sky50 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  header: { marginBottom: spacing.lg },
  backBtn: { marginBottom: spacing.md },
  backText: { fontSize: 15, fontWeight: '600', color: palette.navy600 },
  title: { fontSize: 24, fontWeight: '900', color: palette.ink900 },
  subtitle: { fontSize: 14, color: palette.ink500, marginTop: spacing.xs },
  label: { fontSize: 14, fontWeight: '700', color: palette.ink700, marginBottom: spacing.md },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.sky200, alignItems: 'center', backgroundColor: palette.white },
  toggleBtnActive: { backgroundColor: '#D1FAE5', borderColor: '#10B981' },
  toggleBtnInactive: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  toggleText: { fontSize: 16, fontWeight: '700', color: palette.ink500 },
  toggleTextActive: { color: '#065F46' },
  toggleTextInactive: { color: '#991B1B' },
  starSubtext: { fontSize: 13, color: palette.ink500, marginBottom: spacing.md },
  starRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  starBtn: { padding: spacing.xs },
  star: { fontSize: 36, color: palette.sky200 },
  starActive: { color: '#F59E0B' },
  starScale: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: { fontSize: 10, color: palette.ink400 },
  feedbackInput: { backgroundColor: palette.sky50, borderRadius: radius.md, padding: spacing.md, fontSize: 15, borderWidth: 1, borderColor: palette.sky200, minHeight: 100, color: palette.ink900 },
  disclaimer: { fontSize: 12, color: palette.ink400, textAlign: 'center', marginTop: spacing.md },
});
