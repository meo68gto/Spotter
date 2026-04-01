/**
 * DrillDetailScreen.tsx
 * Eagle AI — Display a drill with verification scores and outcome recording.
 * Part of Phase 3: Spotter Production Integration.
 */

import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EagleDrill } from '../../hooks/useEagleCoach';
import { palette, radius, spacing } from '../../theme/design';

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
  drill: EagleDrill;
  onComplete: (drillId: string) => void;
  onBack: () => void;
}

export function DrillDetailScreen({ session, drill, onComplete, onBack }: Props) {
  const verifications = drill.verifications ?? {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.confidenceBanner}>
          <Text style={styles.confidenceLabel}>AI Confidence</Text>
          <Text style={styles.confidenceScore}>
            {Math.round((drill.confidenceScore ?? 0) * 100)}%
          </Text>
        </View>
      </View>

      {/* Title + meta */}
      <Card style={styles.titleCard}>
        <Text style={styles.drillTitle}>{drill.title}</Text>
        <Text style={styles.drillDescription}>{drill.description}</Text>
        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {drill.difficulty?.charAt(0).toUpperCase()}{drill.difficulty?.slice(1)}
            </Text>
          </View>
          <Text style={styles.metaText}>⏱ {drill.estimatedMinutes ?? 10} min</Text>
          {drill.focusAreas?.map((area: string) => (
            <View key={area} style={[styles.badge, styles.badgeOutline]}>
              <Text style={styles.badgeText}>{area.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Verification Scores */}
      <Card>
        <Text style={styles.sectionTitle}>Verification Scores</Text>
        <Text style={styles.sectionSubtitle}>AI multi-axis quality assessment</Text>
        {Object.entries(verifications).map(([axis, data]: [string, any]) => {
          const score = data?.score ?? 0;
          const pass = data?.pass ?? false;
          const color = AXIS_COLORS[axis] ?? '#6B7280';
          const label = AXIS_LABELS[axis] ?? axis;

          return (
            <View key={axis} style={styles.verifiedRow}>
              <View style={styles.axisLeft}>
                <View style={[styles.axisDot, { backgroundColor: pass ? color : '#9CA3AF' }]} />
                <Text style={styles.axisLabel}>{label}</Text>
              </View>
              <View style={styles.axisRight}>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreFill,
                      { width: `${score * 100}%`, backgroundColor: pass ? color : '#9CA3AF' },
                    ]}
                  />
                </View>
                <Text style={[styles.scoreText, { color: pass ? color : '#9CA3AF' }]}>
                  {Math.round(score * 100)}%
                </Text>
              </View>
            </View>
          );
        })}
        <View style={styles.overallRow}>
          <Text style={styles.overallLabel}>Overall</Text>
          <View style={[styles.overallBadge, { backgroundColor: drill.passed ? '#10B981' : '#EF4444' }]}>
            <Text style={styles.overallText}>
              {drill.passed ? 'PASSED ✓' : 'BEST EFFORT'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Steps */}
      <Card>
        <Text style={styles.sectionTitle}>Steps</Text>
        {drill.steps?.map((step: string, i: number) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </Card>

      {/* Safety Notes */}
      {drill.safetyNotes && (
        <Card>
          <Text style={styles.sectionTitle}>⚠️ Safety Notes</Text>
          <Text style={styles.safetyText}>{drill.safetyNotes}</Text>
        </Card>
      )}

      {/* Equipment */}
      {drill.equipment && drill.equipment.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>Equipment</Text>
          <View style={styles.chipRow}>
            {drill.equipment.map((item: string) => (
              <View key={item} style={styles.equipChip}>
                <Text style={styles.equipText}>{item}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* CTA */}
      <Button
        title="Log Completion + Improvement"
        onPress={() => onComplete(drill.drillId ?? drill.id ?? '')}
        tone="primary"
      />

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.sky50 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  backBtn: { paddingVertical: spacing.sm },
  backText: { fontSize: 15, fontWeight: '600', color: palette.navy600 },
  confidenceBanner: {
    backgroundColor: palette.navy600,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  confidenceLabel: { fontSize: 11, color: palette.sky200, fontWeight: '600', textTransform: 'uppercase' },
  confidenceScore: { fontSize: 22, fontWeight: '900', color: palette.white },
  titleCard: { marginBottom: spacing.md },
  drillTitle: { fontSize: 22, fontWeight: '900', color: palette.ink900, marginBottom: spacing.xs },
  drillDescription: { fontSize: 15, color: palette.ink600, lineHeight: 22, marginBottom: spacing.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  badge: { backgroundColor: palette.navy600, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2 },
  badgeOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.navy600 },
  badgeText: { fontSize: 11, fontWeight: '700', color: palette.white },
  metaText: { fontSize: 12, color: palette.ink500, marginLeft: spacing.xs },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: palette.ink900, marginBottom: spacing.xs },
  sectionSubtitle: { fontSize: 12, color: palette.ink400, marginBottom: spacing.md },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  axisLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  axisDot: { width: 8, height: 8, borderRadius: 4 },
  axisLabel: { fontSize: 13, color: palette.ink700 },
  axisRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreBar: { width: 80, height: 6, backgroundColor: palette.sky200, borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 3 },
  scoreText: { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },
  overallRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: palette.sky200 },
  overallLabel: { fontSize: 14, fontWeight: '800', color: palette.ink900 },
  overallBadge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2 },
  overallText: { fontSize: 12, fontWeight: '900', color: palette.white },
  stepRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: palette.navy600, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 13, fontWeight: '900', color: palette.white },
  stepText: { flex: 1, fontSize: 15, color: palette.ink800, lineHeight: 22 },
  safetyText: { fontSize: 14, color: palette.ink600, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  equipChip: { backgroundColor: palette.sky100, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  equipText: { fontSize: 12, color: palette.ink700 },
});
