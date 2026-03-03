import { ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { CoachCatalogItem, useCoachCatalog } from '../../../hooks/useCoachCatalog';
import { stockPhotos } from '../../../lib/stockPhotos';
import { CoachListCard } from '../../../components/coaching/CoachListCard';
import { Button } from '../../../components/Button';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onSelectCoach: (coach: CoachCatalogItem) => void;
};

export function CoachBrowseScreen({ search, onSearchChange, onSelectCoach }: Props) {
  const { items, loading, refresh, page, hasNextPage, nextPage, prevPage } = useCoachCatalog(search);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <ImageBackground source={{ uri: stockPhotos.coachBrowseHero }} imageStyle={styles.heroImage} style={styles.hero}>
        <Text style={styles.heroTitle}>Coach Directory</Text>
      </ImageBackground>

      <TextInput
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search coaches by headline"
        style={styles.input}
      />

      {items.map((coach) => (
        <CoachListCard
          key={coach.coachId}
          name={coach.displayName}
          headline={coach.headline}
          city={coach.city}
          onPress={() => onSelectCoach(coach)}
        />
      ))}

      <Text style={styles.pageMeta}>Page {page}</Text>
      <Button title="Previous" onPress={prevPage} disabled={page <= 1 || loading} tone="secondary" />
      <Button title="Next" onPress={nextPage} disabled={!hasNextPage || loading} tone="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  hero: { height: 150, justifyContent: 'flex-end', padding: 12, marginBottom: 12 },
  heroImage: { borderRadius: 14 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10
  },
  pageMeta: { color: '#627d98', marginTop: 8, textAlign: 'center' }
});
