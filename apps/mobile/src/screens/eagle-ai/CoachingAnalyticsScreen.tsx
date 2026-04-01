/**
 * CoachingAnalyticsScreen.tsx
 * Eagle AI — Analytics dashboard for Spotter mobile app.
 * Part of Phase 3: Spotter Production Integration.
 */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Card } from '../../components/Card';
import { useEagleCoach, CoachingAnalytics } from '../../hooks/useEagleCoach';
import { palette, radius, spacing } from '../../theme/design';

interface Props {
  session: Session;
  onBack: () => void;
}

export function CoachingAnalyticsScreen({ session, onBack }: Props) {
  const { getAnalytics } = useEagleCoach();
  const [analytics, setAnalytics] = useState<CoachingAnalytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getAnalytics();
    setAnalytics(data);
  }, [getAnalytics]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const flaggedProblems = analytics?.flaggedProblems ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Coaching Analytics</Text>
        <Text style={styles.subtitle}>Your drill performance at a glance</Text>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{analytics?.totalDrills ?? 0}</Text>
          <Text style={styles.summaryLabel}>Total Drills</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>
            {analytics?.avgImprovement !== null && analytics?.avgImprovement !== undefined
              ? `${Math.round(analytics.avgImprovement * 100)}%`
              : '—'}
          </Text>
          <Text style={styles.summaryLabel}>Avg Improvement</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryNumber, flaggedProblems.length > 0 && { color: palette.red500 }]}>
            {flaggedProblems.length}
          </Text>
          <Text style={styles.summaryLabel}>Flagged</Text>
        </Card>
      </View>

      {/* Flagged problems */}
      {flaggedProblems.length > 0 && (
        <Card style={styles.flaggedCard}>
          <Text style={styles.flaggedTitle}>⚠️ Problems Needing Attention</Text>
          <Text style={styles.flaggedSubtitle}>
            These problems have low improvement scores. Consider a different drill approach.
          </Text>
          {flaggedProblems.map((problem) => (
            <View key={problem} style={styles.flaggedRow}>
              <Text style={styles.flaggedDot}>•</Text>
              <Text style={styles.flaggedProblem}>{problem}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Problem breakdown */}
      <Card>
        <Text style={styles.sectionTitle}>Problems by Drill Count</Text>
        {analytics?.problemStats && analytics.problemStats.length > 0 ? (
          analytics.problemStats.map((stat) => (
            <View key={stat.problem} style={styles.problemRow}>
              <View style={styles.problemLeft}>
                <Text style={styles.problemName}>{stat.problem}</Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min((stat.drillCount / (analytics.problemStats[0]?.drillCount ?? 1)) * 100, 100)}%`,
                        backgroundColor: stat.avgImprovement !== null && stat.avgImprovement < 0.4
                          ? palette.red400
                          : palette.navy600,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.problemRight}>
                <Text style={styles.problemCount}>{stat.drillCount}</Text>
                <Text style={styles.problemMeta}>
                  {stat.avgImprovement !== null
                    ? `${Math.round(stat.avgImprovement * 100)}% avg`
                    : 'no data'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>
            No drill data yet. Generate and complete drills to see analytics.
          </Text>
        )}
      </Card>

      {/* Best performing problems */}
      {analytics?.problemStats && analytics.problemStats.filter((s) => s.avgImprovement !== null && s.avgImprovement >= 0.7).length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>Top Performing Problems</Text>
          <Text style={styles.sectionSubtitle}>Highest avg improvement scores</Text>
          {analytics.problemStats
            .filter((s) => s.avgImprovement !== null && s.avgImprovement >= 0.7)
            .sort((a, b) => (b.avgImprovement ?? 0) - (a.avgImprovement ?? 0))
            .slice(0, 5)
            .map((stat) => (
              <View key={stat.problem} style={styles.topRow}>
                <Text style={styles.topProblem}>{stat.problem}</Text>
                <Text style={styles.topScore}>
                  {'★'.repeat(Math.round((stat.avgImprovement ?? 0) * 5))}
                </Text>
              </View>
            ))}
        </Card>
      )}
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
  subtitle: { fontSize: 14, color: palette.ink500 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1, alignItems: 'center' },
  summaryNumber: { fontSize: 28, fontWeight: '900', color: palette.navy600 },
  summaryLabel: { fontSize: 11, color: palette.ink500, marginTop: spacing.xs },
  flaggedCard: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1, marginBottom: spacing.md },
  flaggedTitle: { fontSize: 15, fontWeight: '800', color: '#92400E', marginBottom: spacing.xs },
  flaggedSubtitle: { fontSize: 12, color: '#B45309', marginBottom: spacing.md },
  flaggedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  flaggedDot: { fontSize: 14, color: '#B45309' },
  flaggedProblem: { fontSize: 14, color: '#92400E', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: palette.ink900, marginBottom: spacing.xs },
  sectionSubtitle: { fontSize: 12, color: palette.ink400, marginBottom: spacing.md },
  problemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  problemLeft: { flex: 1 },
  problemName: { fontSize: 13, color: palette.ink700, marginBottom: spacing.xs },
  progressBar: { height: 6, backgroundColor: palette.sky200, borderRadius: 3 },
  progressFill: { height: '100%', borderRadius: 3 },
  problemRight: { alignItems: 'flex-end', marginLeft: spacing.sm },
  problemCount: { fontSize: 16, fontWeight: '900', color: palette.ink900 },
  problemMeta: { fontSize: 11, color: palette.ink400 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  topProblem: { fontSize: 14, color: palette.ink700 },
  topScore: { fontSize: 12, color: '#F59E0B' },
  emptyText: { fontSize: 14, color: palette.ink400, textAlign: 'center', paddingVertical: spacing.lg },
});
