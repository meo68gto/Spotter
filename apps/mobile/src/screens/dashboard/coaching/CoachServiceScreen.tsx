import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import type { CoachCatalogItem, CoachService } from '../../../hooks/useCoachCatalog';

type Props = {
  coach: CoachCatalogItem;
  service: CoachService;
  onBack: () => void;
  onContinue: () => void;
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

export function CoachServiceScreen({ coach, service, onBack, onContinue }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{service.title}</Text>
      <Text style={styles.subtitle}>{coach.displayName}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What you get</Text>
        <Text style={styles.body}>{service.description || 'Direct, coach-authored feedback tailored to your swing and goals.'}</Text>
        <Text style={styles.meta}>Price: {formatPrice(service.priceCents)}</Text>
        <Text style={styles.meta}>
          Delivery: {service.requiresSchedule ? 'Coach will confirm a time' : `${service.turnaroundHours ?? 48} hour turnaround`}
        </Text>
        <Text style={styles.meta}>Video: {service.requiresVideo ? 'Required before payment' : 'Optional'}</Text>
      </View>

      <View style={styles.actions}>
        <Button title="Back" onPress={onBack} tone="secondary" />
        <Button title="Continue" onPress={onContinue} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16, gap: 12 },
  title: { color: '#102a43', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#486581' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#d9e2ec', padding: 16, gap: 8 },
  cardTitle: { color: '#102a43', fontWeight: '700', fontSize: 16 },
  body: { color: '#334e68', lineHeight: 20 },
  meta: { color: '#486581', fontWeight: '600' },
  actions: { gap: 10, paddingBottom: 24 }
});
