import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../Button';
import { Card } from '../Card';

export type CoachListCardProps = {
  name: string;
  headline: string;
  city: string;
  onPress: () => void;
};

export function CoachListCard({ name, headline, city, onPress }: CoachListCardProps) {
  return (
    <Card>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.city}>{city}</Text>
      <View style={styles.cta}>
        <Button title="View Profile" onPress={onPress} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700', color: '#102a43' },
  headline: { marginTop: 4, color: '#334e68' },
  city: { marginTop: 2, color: '#627d98' },
  cta: { marginTop: 4 }
});
