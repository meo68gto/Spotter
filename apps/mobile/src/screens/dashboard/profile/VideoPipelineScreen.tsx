import { Session } from '@supabase/supabase-js';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { VideoPipelineScreen as LegacyVideoPipelineScreen } from '../VideoPipelineScreen';
import { useVideoPipeline } from '../../../hooks/useVideoPipeline';

export function VideoPipelineScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const pipeline = useVideoPipeline(session);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="Back" onPress={onBack} tone="secondary" />
        <Text style={styles.title}>Video Pipeline</Text>
        <Text style={styles.meta}>User: {pipeline.userEmail}</Text>
      </View>
      <LegacyVideoPipelineScreen session={session} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  header: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#d9e2ec', backgroundColor: '#fff' },
  title: { color: '#102a43', fontSize: 22, fontWeight: '800', marginTop: 8 },
  meta: { color: '#627d98', marginTop: 2 }
});
