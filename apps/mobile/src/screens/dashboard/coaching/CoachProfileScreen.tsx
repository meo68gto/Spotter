import { ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CoachCatalogItem } from '../../../hooks/useCoachCatalog';
import { stockPhotos } from '../../../lib/stockPhotos';
import { PriceModePillRow } from '../../../components/coaching/PriceModePillRow';
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

export function CoachProfileScreen({ coach, mode, setMode, onBook, onBack, refreshing, onRefresh }: Props) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ImageBackground source={{ uri: stockPhotos.coachProfileHero }} imageStyle={styles.heroImage} style={styles.hero}>
        <Text style={styles.heroTitle}>{coach.displayName}</Text>
      </ImageBackground>

      <Text style={styles.headline}>{coach.headline}</Text>
      <Text style={styles.bio}>{coach.bio}</Text>
      <Text style={styles.meta}>Location: {coach.city}</Text>

      <Text style={styles.section}>Select Session Type</Text>
      <PriceModePillRow mode={mode} onChange={setMode} />

      <View style={styles.priceBox}>
        <Text style={styles.priceLabel}>Estimated price</Text>
        <Text style={styles.price}>{mode === 'video_call' ? '$45' : mode === 'video_answer' ? '$30' : '$20'}</Text>
      </View>

      <Button title="Back to Browse" onPress={onBack} tone="secondary" />
      <Button title="Choose Availability" onPress={onBook} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  hero: { height: 180, justifyContent: 'flex-end', padding: 12, marginBottom: 12 },
  heroImage: { borderRadius: 14 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headline: { color: '#102a43', fontSize: 18, fontWeight: '700' },
  bio: { color: '#334e68', marginTop: 6 },
  meta: { color: '#627d98', marginTop: 8 },
  section: { color: '#102a43', marginTop: 16, marginBottom: 4, fontWeight: '700' },
  priceBox: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    padding: 12
  },
  priceLabel: { color: '#627d98' },
  price: { color: '#0b3a53', fontSize: 22, fontWeight: '800', marginTop: 4 }
});
