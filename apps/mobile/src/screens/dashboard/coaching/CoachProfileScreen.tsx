import { ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CoachCatalogItem, EngagementMode } from '../../../hooks/useCoachCatalog';
import { stockPhotos } from '../../../lib/stockPhotos';
import { BookingMode } from '../../../hooks/useBookingFlow';
import { Button } from '../../../components/Button';

type Props = {
  coach: CoachCatalogItem;
  mode: BookingMode;
  setMode: (next: BookingMode) => void;
  onBook: () => void;
  onBack: () => void;
  refreshing: boolean;
  onRefresh: () => void;
};

const MODE_DETAILS: Record<EngagementMode, { label: string; description: string; icon: string }> = {
  text_answer: { label: 'Text Answer', description: 'Written response to your question', icon: '✍️' },
  video_answer: { label: 'Video Answer', description: 'Recorded video analysis', icon: '🎥' },
  video_call: { label: 'Live Call', description: 'Real-time video session', icon: '📹' }
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

export function CoachProfileScreen({ coach, mode, setMode, onBook, onBack, refreshing, onRefresh }: Props) {
  const currentPrice = coach.pricing.find(p => p.mode === mode)?.priceCents ?? 0;
  const hasPricing = coach.pricing.length > 0;

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
              {coach.ratingCount > 0 && (
                <Text style={styles.ratingCount}>({coach.ratingCount} reviews)</Text>
              )}
            </View>
          )}
        </View>
      </ImageBackground>

      {/* Quick Info Bar */}
      <View style={styles.quickInfoBar}>
        <View style={styles.quickInfoItem}>
          <Text style={styles.quickInfoLabel}>Location</Text>
          <Text style={styles.quickInfoValue}>{coach.city}</Text>
        </View>
        {coach.avgResponseMinutes !== null && (
          <View style={styles.quickInfoItem}>
            <Text style={styles.quickInfoLabel}>Response</Text>
            <Text style={styles.quickInfoValue}>{formatResponseTime(coach.avgResponseMinutes)}</Text>
          </View>
        )}
        {hasPricing && (
          <View style={styles.quickInfoItem}>
            <Text style={styles.quickInfoLabel}>From</Text>
            <Text style={styles.quickInfoValue}>{formatPrice(coach.minPrice)}</Text>
          </View>
        )}
      </View>

      {/* Headline & Bio */}
      <View style={styles.sectionCard}>
        <Text style={styles.headline}>{coach.headline}</Text>
        <Text style={styles.bio}>{coach.bio}</Text>
      </View>

      {/* Specialties */}
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

      {/* Session Type Selection */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Choose Session Type</Text>
        <Text style={styles.sectionSubtitle}>Select how you want to connect with {coach.displayName.split(' ')[0]}</Text>
        
        <View style={styles.modeOptions}>
          {(Object.keys(MODE_DETAILS) as EngagementMode[]).map((modeKey) => {
            const details = MODE_DETAILS[modeKey];
            const price = coach.pricing.find(p => p.mode === modeKey)?.priceCents;
            const isAvailable = price !== undefined;
            const isSelected = mode === modeKey;

            return (
              <TouchableOpacity
                key={modeKey}
                style={[
                  styles.modeCard,
                  isSelected && styles.modeCardSelected,
                  !isAvailable && styles.modeCardDisabled
                ]}
                onPress={() => isAvailable && setMode(modeKey)}
                disabled={!isAvailable}
                activeOpacity={0.8}
              >
                <View style={styles.modeHeader}>
                  <Text style={styles.modeIcon}>{details.icon}</Text>
                  <View style={styles.modeInfo}>
                    <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>
                      {details.label}
                    </Text>
                    <Text style={styles.modeDescription}>{details.description}</Text>
                  </View>
                </View>
                <View style={styles.modePriceSection}>
                  {isAvailable ? (
                    <Text style={[styles.modePrice, isSelected && styles.modePriceSelected]}>
                      {formatPrice(price)}
                    </Text>
                  ) : (
                    <Text style={styles.modeUnavailable}>Unavailable</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Price Summary */}
      {currentPrice > 0 && (
        <View style={styles.priceSummary}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Session Price</Text>
            <Text style={styles.priceValue}>{formatPrice(currentPrice)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform Fee</Text>
            <Text style={styles.priceValue}>Included</Text>
          </View>
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(currentPrice)}</Text>
          </View>
        </View>
      )}

      {/* CTA Buttons */}
      <View style={styles.ctaSection}>
        <Button title="Back to Browse" onPress={onBack} tone="secondary" />
        <View style={styles.bookButtonContainer}>
          <Button 
            title={currentPrice > 0 ? `Book for ${formatPrice(currentPrice)}` : 'Book Session'} 
            onPress={onBook} 
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  hero: { 
    height: 200, 
    justifyContent: 'flex-end', 
    padding: 16, 
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden'
  },
  heroImage: { borderRadius: 14 },
  heroOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 12,
    borderRadius: 8,
    margin: -8
  },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4
  },
  ratingText: { 
    color: '#ffd700', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  ratingCount: { 
    color: '#fff', 
    fontSize: 14,
    opacity: 0.9
  },
  quickInfoBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    gap: 16
  },
  quickInfoItem: {
    flex: 1
  },
  quickInfoLabel: {
    fontSize: 11,
    color: '#627d98',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  quickInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#102a43'
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d9e2ec'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102a43',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#627d98',
    marginBottom: 12
  },
  headline: { 
    color: '#102a43', 
    fontSize: 18, 
    fontWeight: '700',
    marginBottom: 8
  },
  bio: { 
    color: '#334e68', 
    lineHeight: 22,
    fontSize: 14
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  specialtyTag: {
    backgroundColor: '#eaf2f8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  specialtyText: {
    color: '#0b3a53',
    fontSize: 13,
    fontWeight: '500'
  },
  modeOptions: {
    gap: 10
  },
  modeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modeCardSelected: {
    borderColor: '#0b3a53',
    backgroundColor: '#eaf2f8'
  },
  modeCardDisabled: {
    opacity: 0.5
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  modeIcon: {
    fontSize: 24
  },
  modeInfo: {
    flex: 1
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#102a43'
  },
  modeLabelSelected: {
    color: '#0b3a53'
  },
  modeDescription: {
    fontSize: 12,
    color: '#627d98',
    marginTop: 2
  },
  modePriceSection: {
    alignItems: 'flex-end'
  },
  modePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0b3a53'
  },
  modePriceSelected: {
    color: '#0b3a53'
  },
  modeUnavailable: {
    fontSize: 12,
    color: '#627d98',
    fontStyle: 'italic'
  },
  priceSummary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d9e2ec'
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  priceLabel: {
    color: '#627d98',
    fontSize: 14
  },
  priceValue: {
    color: '#334e68',
    fontSize: 14,
    fontWeight: '500'
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 0
  },
  totalLabel: {
    color: '#102a43',
    fontSize: 16,
    fontWeight: '700'
  },
  totalValue: {
    color: '#0b3a53',
    fontSize: 20,
    fontWeight: '800'
  },
  ctaSection: {
    gap: 10,
    marginTop: 8
  },
  bookButtonContainer: {
    marginTop: 4
  }
});
