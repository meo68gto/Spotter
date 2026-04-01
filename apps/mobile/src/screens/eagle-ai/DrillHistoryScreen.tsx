/**
 * DrillHistoryScreen.tsx
 * Eagle AI — Drill history view for Spotter mobile app.
 * Shows past drills generated for the user with completion status + improvement scores.
 * Part of Phase 3: Spotter Production Integration.
 */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Card } from '../../components/Card';
import { useEagleCoach, EagleDrill, EagleOutcome } from '../../hooks/useEagleCoach';
import { palette, radius, spacing } from '../../theme/design';

interface Props {
  session: Session;
  onSelectDrill: (drill: EagleDrill) => void;
  onBack: () => void;
}

export function DrillHistoryScreen({ session, onSelectDrill, onBack }: Props) {
  const { getUserDrills, getUserOutcomes, loading } = useEagleCoach();
  const [drills, setDrills] = useState<EagleDrill[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, EagleOutcome>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [drillsData, outcomesData] = await Promise.all([
      getUserDrills(30),
      getUserOutcomes(50),
    ]);
    setDrills(drillsData);
    // Index outcomes by drillId for fast lookup
    const outcomeMap: Record<string, EagleOutcome> = {};
    for (const o of outcomesData) {
      if (!outcomeMap[o.drillId]) outcomeMap[o.drillId] = o;
    }
    setOutcomes(outcomeMap);
  }, [getUserDrills, getUserOutcomes]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderDrillCard = ({ item: drill }: { item: EagleDrill }) => {
    const outcome = outcomes[drill.id];
    const confidence = drill.confidenceScore ?? 0;

    return (
      <TouchableOpacity onPress={() => onSelectDrill(drill)}>
        <Card>
          <View style={styles.drillCard}>
            <View style={styles.drillHeader}>
              <Text style={styles.drillTitle} numberOfLines={1}>{drill.title}</Text>
              <View style={[styles.confidenceDot, { backgroundColor: confidence >= 0.8 ? '#10B981' : confidence >= 0.6 ? '#F59E0B' : '#EF4444' }]} />
            </View>
            <Text style={styles.problemText}>{drill.inputProblem ?? drill.title}</Text>
            <View style={styles.drillMeta}>
              <View style={[styles.levelBadge]}>
                <Text style={styles.levelText}>
                  {drill.difficulty?.charAt(0).toUpperCase()}{drill.difficulty?.slice(1)}
                </Text>
              </View>
              {outcome ? (
                <View style={styles.outcomeRow}>
                  <Text style={styles.outcomeLabel}>Improvement:</Text>
                  {outcome.improvementScore !== null ? (
                    <Text style={styles.outcomeScore}>
                      {'★'.repeat(Math.round(outcome.improvementScore * 5))}
                      {'☆'.repeat(5 - Math.round(outcome.improvementScore * 5))}
                    </Text>
                  ) : (
                    <Text style={styles.outcomePending}>
                      {outcome.completed ? 'Completed ✓' : 'Not completed'}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={styles.noOutcome}>No outcome recorded</Text>
              )}
            </View>
            {drill.createdAt && (
              <Text style={styles.dateText}>
                {new Date(drill.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Drills</Text>
        <Text style={styles.subtitle}>{drills.length} drill{drills.length !== 1 ? 's' : ''} in your history</Text>
      </View>

      <FlatList
        data={drills}
        renderItem={renderDrillCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Card>
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyTitle}>No drills yet</Text>
              <Text style={styles.emptyText}>
                Generate your first AI drill to start building your coaching history.
              </Text>
            </View>
          </Card>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.sky50 },
  header: { padding: spacing.lg, paddingTop: spacing.xl, backgroundColor: palette.white, borderBottomWidth: 1, borderBottomColor: palette.sky100 },
  backBtn: { marginBottom: spacing.md },
  backText: { fontSize: 15, fontWeight: '600', color: palette.navy600 },
  title: { fontSize: 24, fontWeight: '900', color: palette.ink900, marginBottom: spacing.xs },
  subtitle: { fontSize: 13, color: palette.ink500 },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  drillCard: { gap: spacing.sm },
  drillHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drillTitle: { fontSize: 16, fontWeight: '800', color: palette.ink900, flex: 1 },
  confidenceDot: { width: 10, height: 10, borderRadius: 5 },
  problemText: { fontSize: 13, color: palette.ink500 },
  drillMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  levelBadge: { backgroundColor: palette.sky100, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  levelText: { fontSize: 11, fontWeight: '700', color: palette.navy600 },
  outcomeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  outcomeLabel: { fontSize: 11, color: palette.ink400 },
  outcomeScore: { fontSize: 11, color: '#F59E0B' },
  outcomePending: { fontSize: 11, color: palette.ink400 },
  noOutcome: { fontSize: 11, color: palette.ink300, fontStyle: 'italic' },
  dateText: { fontSize: 11, color: palette.ink300 },
  emptyState: { alignItems: 'center', padding: spacing.lg },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: palette.ink900, marginBottom: spacing.xs },
  emptyText: { fontSize: 14, color: palette.ink500, textAlign: 'center' },
});
