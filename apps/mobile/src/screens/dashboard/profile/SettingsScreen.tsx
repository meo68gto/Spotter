import { Session } from '@supabase/supabase-js';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { flags } from '../../../lib/flags';
import { env } from '../../../types/env';
import { useTheme } from '../../../theme/provider';

export function SettingsScreen({ session, onBack, onSignOut }: { session: Session; onBack: () => void; onSignOut: () => void }) {
  const { tokens, preference, setPreference } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: tokens.background }]} contentContainerStyle={styles.content}>
      <Button title="Back" accessibilityLabel="Back to profile" onPress={onBack} tone="secondary" />
      <Text style={[styles.title, { color: tokens.text }]}>Settings</Text>

      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
        <Text style={[styles.section, { color: tokens.text }]}>Theme</Text>
        <Text style={[styles.meta, { color: tokens.textSecondary }]}>Current: {preference}</Text>
        <Button title="System" accessibilityLabel="Use system theme" onPress={() => setPreference('system')} tone={preference === 'system' ? 'primary' : 'secondary'} />
        <Button title="Light" accessibilityLabel="Use light theme" onPress={() => setPreference('light')} tone={preference === 'light' ? 'primary' : 'secondary'} />
        <Button title="Dark" accessibilityLabel="Use dark theme" onPress={() => setPreference('dark')} tone={preference === 'dark' ? 'primary' : 'secondary'} />
      </View>

      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
        <Text style={[styles.section, { color: tokens.text }]}>Feature Flags</Text>
        <Text style={[styles.meta, { color: tokens.textSecondary }]}>Inbox v2: {String(flags.inboxV2)}</Text>
        <Text style={[styles.meta, { color: tokens.textSecondary }]}>Profile v2: {String(flags.profileV2)}</Text>
        <Text style={[styles.meta, { color: tokens.textSecondary }]}>Coaching Part 2: {String(flags.coachingPart2)}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
        <Text style={[styles.section, { color: tokens.text }]}>Legal</Text>
        <Button title="Terms" onPress={() => Linking.openURL(env.legalTosUrl)} tone="secondary" />
        <Button title="Privacy" onPress={() => Linking.openURL(env.legalPrivacyUrl)} tone="secondary" />
      </View>

      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
        <Text style={[styles.section, { color: tokens.text }]}>Account</Text>
        <Text style={[styles.meta, { color: tokens.textSecondary }]}>Signed in: {session.user.email}</Text>
        <Button title="Sign Out" accessibilityLabel="Sign out of account" onPress={onSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  card: { marginTop: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  section: { fontWeight: '800' },
  meta: { marginTop: 4 }
});
