/**
 * DrillGenerationScreen.tsx
 * Eagle AI — Generate a golf drill from a problem statement.
 * Part of Phase 3: Spotter Production Integration.
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useEagleCoach, PlayerLevel, EagleDrill } from '../../hooks/useEagleCoach';
import { palette, radius, spacing } from '../../theme/design';

const PLAYER_LEVELS: PlayerLevel[] = ['beginner', 'intermediate', 'advanced'];
const QUICK_PROBLEMS = [
  'slice',
  'hook',
  'early extension',
  'over the top',
  'casting',
  'thin shot',
  'fat shot',
  'loss of posture',
  'reverse pivot',
  'steep swing plane',
];

const AXIS_LABELS: Record<string, string> = {
  biomechanics: 'Biomechanics',
  teaching_logic: 'Teaching Logic',
  safety: 'Safety',
  outcome: 'Outcome Correlation',
  factual: 'Factual Accuracy',
};

const AXIS_COLORS: Record<string, string> = {
  biomechanics: '#3B82F6',
  teaching_logic: '#8B5CF6',
  safety: '#10B981',
  outcome: '#F59E0B',
  factual: '#EF4444',
};

interface Props {
  session: Session;
  onDrillGenerated: (drill: EagleDrill) => void;
  onBack: () => void;
}

export function DrillGenerationScreen({ session, onDrillGenerated, onBack }: Props) {
  const [problem, setProblem] = useState('');
  const [playerLevel, setPlayerLevel] = useState<PlayerLevel>('intermediate');
  const { generateDrill, loading, error } = useEagleCoach();

  const handleGenerate = useCallback(async () => {
    if (!problem.trim()) {
      Alert.alert('Problem required', 'Please describe the swing problem you want to address.');
      return;
    }
    const drill = await generateDrill(problem.trim(), playerLevel);
    if (drill) onDrillGenerated(drill);
  }, [problem, playerLevel, generateDrill, onDrillGenerated]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AI Golf Coach</Text>
        <Text style={styles.subtitle}>
          Describe a swing problem and I'll generate a verified drill for you.
        </Text>
      </View>

      {/* Problem input */}
      <Card>
        <Text style={styles.label}>Swing Problem</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., slice, over the top, early extension..."
          placeholderTextColor={palette.ink300}
          value={problem}
          onChangeText={setProblem}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Quick select chips */}
        <Text style={styles.chipLabel}>Quick select:</Text>
        <View style={styles.chipRow}>
          {QUICK_PROBLEMS.slice(0, 5).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, problem === p && styles.chipActive]}
              onPress={() => setProblem(p)}
            >
              <Text style={[styles.chipText, problem === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.chipRow}>
          {QUICK_PROBLEMS.slice(5).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, problem === p && styles.chipActive]}
              onPress={() => setProblem(p)}
            >
              <Text style={[styles.chipText, problem === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Player level */}
      <Card>
        <Text style={styles.label}>Player Level</Text>
        <View style={styles.levelRow}>
          {PLAYER_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.levelBtn, playerLevel === level && styles.levelBtnActive]}
              onPress={() => setPlayerLevel(level)}
            >
              <Text style={[styles.levelText, playerLevel === level && styles.levelTextActive]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Error */}
      {error && (
        <Card>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      )}

      {/* Generate button */}
      <Button
        title={loading ? 'Generating...' : 'Generate Drill'}
        onPress={handleGenerate}
        disabled={loading || !problem.trim()}
        tone="primary"
      />

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        ⚠️ This is an AI-generated drill. Always consult a qualified golf instructor before trying new techniques.
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
  title: { fontSize: 26, fontWeight: '900', color: palette.ink900, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: palette.ink500, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '700', color: palette.ink700, marginBottom: spacing.sm },
  input: {
    backgroundColor: palette.sky50,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    borderWidth: 1,
    borderColor: palette.sky200,
    minHeight: 80,
    color: palette.ink900,
  },
  chipLabel: { fontSize: 12, color: palette.ink500, marginTop: spacing.md, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: palette.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  chipActive: { backgroundColor: palette.navy600, borderColor: palette.navy600 },
  chipText: { fontSize: 12, color: palette.ink700 },
  chipTextActive: { color: palette.white, fontWeight: '700' },
  levelRow: { flexDirection: 'row', gap: spacing.sm },
  levelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky200,
    alignItems: 'center',
    backgroundColor: palette.sky50,
  },
  levelBtnActive: { backgroundColor: palette.navy600, borderColor: palette.navy600 },
  levelText: { fontSize: 14, fontWeight: '600', color: palette.ink700 },
  levelTextActive: { color: palette.white },
  errorText: { fontSize: 14, color: palette.red600 },
  disclaimer: { fontSize: 12, color: palette.ink400, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
});
