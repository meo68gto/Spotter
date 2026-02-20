import { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { env } from '../types/env';
import { invokeFunction } from '../lib/api';

type Props = {
  onAccepted: () => void | Promise<void>;
};

export function LegalConsentScreen({ onAccepted }: Props) {
  const [loading, setLoading] = useState(false);

  const versions = useMemo(
    () =>
      `${env.legalTosVersion} / ${env.legalPrivacyVersion} / ${env.legalCookieVersion}`,
    []
  );

  const accept = async () => {
    setLoading(true);
    try {
      await invokeFunction('legal-consent', {
        method: 'POST',
        body: { accepted: true }
      });
      onAccepted();
    } catch (error) {
      Alert.alert('Consent failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.title}>Legal Consent Required</Text>
        <Text style={styles.subtitle}>You must accept legal terms before using Spotter.</Text>
        <Text style={styles.meta}>Versions: {versions}</Text>

        <Button title="Terms of Service" onPress={() => Linking.openURL(env.legalTosUrl)} />
        <Button title="Privacy Policy" onPress={() => Linking.openURL(env.legalPrivacyUrl)} />
        <Button title="Cookie Policy" onPress={() => Linking.openURL(env.legalCookieUrl)} />
        <Button title={loading ? 'Saving...' : 'I Accept'} onPress={accept} disabled={loading} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#102a43',
    marginBottom: 8
  },
  subtitle: {
    color: '#486581',
    marginBottom: 8
  },
  meta: {
    color: '#334e68',
    marginBottom: 14
  }
});
