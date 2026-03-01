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
import { font, palette, radius, spacing } from '../theme/design';

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
      <Text style={styles.header}>Discover Nearby Sessions</Text>
      {error ? <Text style={styles.warning}>{error}</Text> : null}

      {coords ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Location Ready</Text>
          <Text style={styles.previewMeta}>Your local activity layer is active.</Text>
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
    backgroundColor: palette.sky100,
    paddingTop: spacing.xl
  },
  header: {
    fontSize: 20,
    fontFamily: font.display,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    color: palette.ink900
  },
  previewCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.sky300
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: 8
  },
  previewMeta: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: 4
  },
  previewSurface: {
    marginTop: 14,
    height: 280,
    borderRadius: 12,
    backgroundColor: palette.sky200,
    alignItems: 'center',
    justifyContent: 'center'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  warning: {
    color: palette.red500,
    marginHorizontal: spacing.lg,
    marginBottom: 8
  },
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.navy600,
    borderColor: '#fff',
    borderWidth: 2
  }
});
