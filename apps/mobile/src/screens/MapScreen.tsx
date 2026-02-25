import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  buildDeniedPermissionMessage,
  buildOfflineFallbackMessage,
  parseCachedCoords,
  type Coords
} from '../lib/location-utils';

const LAST_COORDS_KEY = 'spotter:last-known-coords';

export function MapScreen() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const cached = await AsyncStorage.getItem(LAST_COORDS_KEY);
      const parsed = parseCachedCoords(cached);
      if (parsed) setCoords(parsed);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(buildDeniedPermissionMessage());
        setLoading(false);
        return;
      }

      try {
        const current = await Location.getCurrentPositionAsync({});
        const next = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude
        };
        setCoords(next);
        await AsyncStorage.setItem(LAST_COORDS_KEY, JSON.stringify(next));
      } catch {
        setError(buildOfflineFallbackMessage());
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Nearby Activity Layer</Text>
      {error ? <Text style={styles.warning}>{error}</Text> : null}

      {coords ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Map Preview</Text>
          <Text style={styles.previewMeta}>Native map rendering is disabled in this local build.</Text>
          <Text style={styles.previewMeta}>Latitude: {coords.latitude.toFixed(5)}</Text>
          <Text style={styles.previewMeta}>Longitude: {coords.longitude.toFixed(5)}</Text>
          <View style={styles.previewSurface}>
            <View style={styles.pin} />
          </View>
        </View>
      ) : (
        <View style={styles.centered}>
          <Text>No location available.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
    paddingTop: 56
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingBottom: 10,
    color: '#102a43'
  },
  previewCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#d9e2ec'
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102a43',
    marginBottom: 8
  },
  previewMeta: {
    fontSize: 14,
    color: '#334e68',
    marginBottom: 4
  },
  previewSurface: {
    marginTop: 14,
    height: 280,
    borderRadius: 12,
    backgroundColor: '#bcccdc',
    alignItems: 'center',
    justifyContent: 'center'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  warning: {
    color: '#9f3a38',
    marginHorizontal: 16,
    marginBottom: 8
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0b3a53',
    borderColor: '#fff',
    borderWidth: 2
  }
});
