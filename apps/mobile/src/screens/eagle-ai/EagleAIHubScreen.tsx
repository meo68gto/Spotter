/**
 * EagleAIHubScreen.tsx
 * Eagle AI — Main orchestrator screen in Spotter mobile app.
 * Ties together: generate → detail → outcome → history → analytics.
 * Part of Phase 3: Spotter Production Integration.
 */

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Card } from '../../components/Card';
import { DrillGenerationScreen } from './DrillGenerationScreen';
import { DrillDetailScreen } from './DrillDetailScreen';
import { DrillOutcomeScreen } from './DrillOutcomeScreen';
import { DrillHistoryScreen } from './DrillHistoryScreen';
import { CoachingAnalyticsScreen } from './CoachingAnalyticsScreen';
import { EagleDrill } from '../../hooks/useEagleCoach';
import { palette, radius, spacing } from '../../theme/design';

type Screen =
  | 'hub'
  | 'generate'
  | 'detail'
  | 'outcome'
  | 'history'
  | 'analytics';

interface Props {
  session: Session;
  onBack: () => void;
}

export function EagleAIHubScreen({ session, onBack }: Props) {
  const [screen, setScreen] = useState<Screen>('hub');
  const [activeDrill, setActiveDrill] = useState<EagleDrill | null>(null);

  if (screen === 'generate') {
    return (
      <DrillGenerationScreen
        session={session}
        onDrillGenerated={(drill) => {
          setActiveDrill(drill);
          setScreen('detail');
        }}
        onBack={() => setScreen('hub')}
      />
    );
  }

  if (screen === 'detail' && activeDrill) {
    return (
      <DrillDetailScreen
        session={session}
        drill={activeDrill}
        onComplete={(drillId) => setScreen('outcome')}
        onBack={() => setScreen('hub')}
      />
    );
  }

  if (screen === 'outcome') {
    const drillId = activeDrill?.drillId ?? activeDrill?.id ?? '';
    return (
      <DrillOutcomeScreen
        session={session}
        drillId={drillId}
        onDone={() => { setActiveDrill(null); setScreen('hub'); }}
        onBack={() => setScreen('hub')}
      />
    );
  }

  if (screen === 'history') {
    return (
      <DrillHistoryScreen
        session={session}
        onSelectDrill={(drill) => {
          setActiveDrill(drill);
          setScreen('detail');
        }}
        onBack={() => setScreen('hub')}
      />
    );
  }

  if (screen === 'analytics') {
    return (
      <CoachingAnalyticsScreen
        session={session}
        onBack={() => setScreen('hub')}
      />
    );
  }

  // Hub screen
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AI Golf Coach</Text>
        <Text style={styles.subtitle}>
          Generate personalized drills using Eagle AI — the self-improving golf coaching engine.
        </Text>
      </View>

      <View style={styles.grid}>
        {/* Generate */}
        <TouchableOpacity style={styles.card} onPress={() => setScreen('generate')}>
          <Card style={styles.innerCard}>
            <Text style={styles.icon}>🎯</Text>
            <Text style={styles.cardTitle}>Generate Drill</Text>
            <Text style={styles.cardDesc}>Describe a swing problem and get an AI-verified drill</Text>
          </Card>
        </TouchableOpacity>

        {/* History */}
        <TouchableOpacity style={styles.card} onPress={() => setScreen('history')}>
          <Card style={styles.innerCard}>
            <Text style={styles.icon}>📋</Text>
            <Text style={styles.cardTitle}>My Drills</Text>
            <Text style={styles.cardDesc}>View your drill history and past outcomes</Text>
          </Card>
        </TouchableOpacity>

        {/* Analytics */}
        <TouchableOpacity style={styles.card} onPress={() => setScreen('analytics')}>
          <Card style={styles.innerCard}>
            <Text style={styles.icon}>📊</Text>
            <Text style={styles.cardTitle}>Analytics</Text>
            <Text style={styles.cardDesc}>Track your improvement by problem type</Text>
          </Card>
        </TouchableOpacity>

        {/* How it works */}
        <TouchableOpacity style={styles.card}>
          <Card style={styles.innerCard}>
            <Text style={styles.icon}>🧠</Text>
            <Text style={styles.cardTitle}>How It Works</Text>
            <Text style={styles.cardDesc}>Eagle AI verifies every drill across 5 quality axes</Text>
          </Card>
        </TouchableOpacity>
      </View>

      {/* Privacy note */}
      <View style={styles.privacyNote}>
        <Text style={styles.privacyText}>
          🔒 Your drill data is used only to improve your coaching experience.{' '}
          <Text style={styles.privacyLink}>Privacy Policy →</Text>
        </Text>
        <Text style={styles.privacyNote}>
          📋 Privacy policy update flagged for Diana's review before launch.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.sky50 },
  header: { padding: spacing.lg, paddingTop: spacing.xl, backgroundColor: palette.white, borderBottomWidth: 1, borderBottomColor: palette.sky100 },
  backBtn: { marginBottom: spacing.md },
  backText: { fontSize: 15, fontWeight: '600', color: palette.navy600 },
  title: { fontSize: 26, fontWeight: '900', color: palette.ink900, marginBottom: spacing.xs },
  subtitle: { fontSize: 13, color: palette.ink500, lineHeight: 18 },
  grid: { padding: spacing.lg, gap: spacing.md },
  card: {},
  innerCard: { alignItems: 'center', gap: spacing.sm },
  icon: { fontSize: 32 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: palette.ink900 },
  cardDesc: { fontSize: 12, color: palette.ink500, textAlign: 'center' },
  privacyNote: { margin: spacing.lg, padding: spacing.md, backgroundColor: palette.sky100, borderRadius: radius.md },
  privacyText: { fontSize: 12, color: palette.ink500, lineHeight: 18 },
  privacyLink: { color: palette.navy600, fontWeight: '600' },
});
