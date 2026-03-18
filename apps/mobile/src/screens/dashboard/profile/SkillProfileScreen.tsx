import { Session } from '@supabase/supabase-js';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon, Circle, Text as SvgText } from 'react-native-svg';
import { Button } from '../../../components/Button';
import { useSkillRadarData } from '../../../hooks/useSkillRadarData';

export function SkillProfileScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const radar = useSkillRadarData(session);

  const size = 260;
  const center = size / 2;
  const radius = 92;
  const points = radar.points;

  const polygonPoints = points
    .map((point, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(points.length, 1) - Math.PI / 2;
      const ratio = Math.max(0, Math.min(1, point.value / point.maxValue));
      const x = center + Math.cos(angle) * radius * ratio;
      const y = center + Math.sin(angle) * radius * ratio;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={radar.loading} onRefresh={radar.refresh} />}
    >
      <Button title="Back" onPress={onBack} tone="secondary" />
      <Text style={styles.title}>Skill Radar</Text>

      <View style={styles.activityRow}>
        {radar.activities.map((activity) => (
          <Button key={activity.id} title={activity.name} onPress={() => radar.setActivityId(activity.id)} tone={activity.id === radar.activityId ? 'primary' : 'secondary'} />
        ))}
      </View>

      <View style={styles.chartCard}>
        {points.length === 0 ? (
          <Text style={styles.empty}>No skill dimensions available.</Text>
        ) : (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error TypeScript 5.7+ compatibility with react-native-svg
          <Svg width={size} height={size}>
            <Circle cx={center} cy={center} r={radius} stroke="#d9e2ec" strokeWidth={1} fill="none" />
            <Polygon points={polygonPoints} fill="rgba(11,58,83,0.2)" stroke="#0b3a53" strokeWidth={2} />
            {points.map((point, index) => {
              const angle = (Math.PI * 2 * index) / points.length - Math.PI / 2;
              const labelX = center + Math.cos(angle) * (radius + 20);
              const labelY = center + Math.sin(angle) * (radius + 20);
              return (
                <SvgText key={point.key} x={labelX} y={labelY} fill="#334e68" fontSize="11" textAnchor="middle">
                  {point.label}
                </SvgText>
              );
            })}
          </Svg>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { color: '#102a43', fontSize: 24, fontWeight: '800', marginTop: 8 },
  activityRow: { marginTop: 10, gap: 8 },
  chartCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center'
  },
  empty: { color: '#829ab1' }
});
