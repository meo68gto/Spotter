import { ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CoachCatalogItem, CoachService } from '../../../hooks/useCoachCatalog';
import { stockPhotos } from '../../../lib/stockPhotos';
import { Button } from '../../../components/Button';

type Props = {
  coach: CoachCatalogItem;
  selectedServiceId: string | null;
  onSelectService: (service: CoachService) => void;
  onContinue: () => void;
  onBack: () => void;
  refreshing: boolean;
  onRefresh: () => void;
};

const SERVICE_META: Record<CoachService['serviceType'], { label: string; icon: string }> = {
  video_review: { label: 'Video Review', icon: '🎥' },
  live_video_call: { label: 'Live Call', icon: '📹' },
  swing_plan: { label: 'Swing Plan', icon: '📋' },
  text_qna: { label: 'Text Q&A', icon: '✍️' }
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatResponseTime(minutes: number | null): string {
  if (!minutes) return 'Usually responds quickly';
  if (minutes < 60) return `Avg. response: ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `Avg. response: ${hours} hr${hours > 1 ? 's' : ''}`;
}

export function CoachProfileScreen({
  coach,
  selectedServiceId,
  onSelectService,
  onContinue,
  onBack,
  refreshing,
  onRefresh
}: Props) {
  const selectedService = coach.services.find((service) => service.id === selectedServiceId) ?? coach.services[0] ?? null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ImageBackground source={{ uri: stockPhotos.coachProfileHero }} imageStyle={styles.heroImage} style={styles.hero}>
        <View style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>{coach.displayName}</Text>
          {coach.ratingAvg !== null && (
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>★ {coach.ratingAvg.toFixed(1)}</Text>
              {coach.ratingCount > 0 && <Text style={styles.ratingCount}>({coach.ratingCount} reviews)</Text>}
            </View>
          )}
        </View>
      </ImageBackground>

      <View style={styles.quickInfoBar}>
        <View style={styles.quickInfoItem}>
          <Text style={styles.quickInfoLabel}>Location</Text>
          <Text style={styles.quickInfoValue}>{coach.city}</Text>
        </View>
        <View style={styles.quickInfoItem}>
          <Text style={styles.quickInfoLabel}>Response</Text>
          <Text style={styles.quickInfoValue}>{formatResponseTime(coach.avgResponseMinutes)}</Text>
        </View>
        <View style={styles.quickInfoItem}>
          <Text style={styles.quickInfoLabel}>From</Text>
          <Text style={styles.quickInfoValue}>{formatPrice(coach.minPrice)}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.headline}>{coach.headline}</Text>
        <Text style={styles.bio}>{coach.bio}</Text>
      </View>

      {coach.specialties.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <View style={styles.specialtiesGrid}>
            {coach.specialties.map((specialty, idx) => (
              <View key={idx} style={styles.specialtyTag}>
                <Text style={styles.specialtyText}>{specialty}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Choose a Service</Text>
        <Text style={styles.sectionSubtitle}>Every request turns into one tracked coaching timeline.</Text>

        <View style={styles.modeOptions}>
          {coach.services.map((service) => {
            const isSelected = service.id === selectedServiceId || (!selectedServiceId && selectedService?.id === service.id);
            const meta = SERVICE_META[service.serviceType];

            return (
              <TouchableOpacity
                key={service.id}
                style={[styles.modeCard, isSelected && styles.modeCardSelected]}
                onPress={() => onSelectService(service)}
                activeOpacity={0.85}
              >
                <View style={styles.modeHeader}>
                  <Text style={styles.modeIcon}>{meta.icon}</Text>
                  <View style={styles.modeInfo}>
                    <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>{service.title}</Text>
                    <Text style={styles.modeDescription}>
                      {service.description || meta.label}
                    </Text>
                    <Text style={styles.modeRequirements}>
                      {service.requiresVideo ? 'Video required' : 'No video required'} •{' '}
                      {service.requiresSchedule ? 'Schedule with coach' : `${service.turnaroundHours ?? 48}h turnaround`}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.modePrice, isSelected && styles.modePriceSelected]}>{formatPrice(service.priceCents)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {selectedService ? (
        <View style={styles.priceSummary}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service</Text>
            <Text style={styles.priceValue}>{selectedService.title}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Checkout total</Text>
            <Text style={styles.priceValue}>{formatPrice(selectedService.priceCents)}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.ctaSection}>
        <Button title="Back to Browse" onPress={onBack} tone="secondary" />
        <View style={styles.bookButtonContainer}>
          <Button title="Continue" onPress={onContinue} disabled={!selectedService} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  hero: { height: 200, justifyContent: 'flex-end', padding: 16, marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
  heroImage: { borderRadius: 14 },
  heroOverlay: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: 8, margin: -8 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  ratingText: { color: '#ffd700', fontSize: 16, fontWeight: '700' },
  ratingCount: { color: '#fff', fontSize: 14, opacity: 0.9 },
  quickInfoBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#d9e2ec', gap: 16 },
  quickInfoItem: { flex: 1 },
  quickInfoLabel: { fontSize: 11, color: '#627d98', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  quickInfoValue: { fontSize: 14, fontWeight: '600', color: '#102a43' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#d9e2ec' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#102a43', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#627d98', marginBottom: 12 },
  headline: { color: '#102a43', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  bio: { color: '#334e68', lineHeight: 22, fontSize: 14 },
  specialtiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specialtyTag: { backgroundColor: '#eaf2f8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  specialtyText: { color: '#0b3a53', fontSize: 13, fontWeight: '500' },
  modeOptions: { gap: 10 },
  modeCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, borderWidth: 2, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeCardSelected: { borderColor: '#0b3a53', backgroundColor: '#eaf2f8' },
  modeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 },
  modeIcon: { fontSize: 24 },
  modeInfo: { flex: 1 },
  modeLabel: { fontSize: 15, fontWeight: '600', color: '#102a43' },
  modeLabelSelected: { color: '#0b3a53' },
  modeDescription: { fontSize: 12, color: '#627d98', marginTop: 2 },
  modeRequirements: { fontSize: 12, color: '#486581', marginTop: 6, fontWeight: '500' },
  modePrice: { fontSize: 18, fontWeight: '700', color: '#0b3a53' },
  modePriceSelected: { color: '#0b3a53' },
  priceSummary: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#d9e2ec' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  priceLabel: { color: '#486581', fontWeight: '600' },
  priceValue: { color: '#102a43', fontWeight: '700' },
  ctaSection: { gap: 10, paddingBottom: 24 },
  bookButtonContainer: { marginTop: 4 }
});
