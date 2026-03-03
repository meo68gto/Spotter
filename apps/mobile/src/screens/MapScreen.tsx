import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, RefreshControl, StyleSheet, Text, View, ScrollView } from 'react-native';
import { buildDeniedPermissionMessage, buildOfflineFallbackMessage, parseCachedCoords, type Coords } from '../lib/location-utils';
import { stockPhotos } from '../lib/stockPhotos';
import { font, isWeb, palette, radius, spacing } from '../theme/design';

const LAST_COORDS_KEY = 'spotter:last-known-coords';

export function MapScreen() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
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
      setError(null);
      await AsyncStorage.setItem(LAST_COORDS_KEY, JSON.stringify(next));
    } catch {
      setError(buildOfflineFallbackMessage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const NativeMap = !isWeb ? (require('react-native-maps').default as any) : null;
  const Marker = !isWeb ? (require('react-native-maps').Marker as any) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ImageBackground source={{ uri: stockPhotos.discoverHero }} style={styles.hero} imageStyle={styles.heroImage}>
        <Text style={styles.header}>Discover Nearby Sessions</Text>
      </ImageBackground>

      {error ? <Text style={styles.warning}>{error}</Text> : null}

      {coords ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Location Ready</Text>
          <Text style={styles.previewMeta}>Your local activity layer is active.</Text>
          <Text style={styles.previewMeta}>Latitude: {coords.latitude.toFixed(5)}</Text>
          <Text style={styles.previewMeta}>Longitude: {coords.longitude.toFixed(5)}</Text>

          {isWeb || !NativeMap ? (
            <View style={styles.previewSurface}>
              <View style={styles.pin} />
            </View>
          ) : (
            <NativeMap
              style={styles.map}
              initialRegion={{
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04
              }}
              region={{
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04
              }}
            >
              <Marker coordinate={{ latitude: coords.latitude, longitude: coords.longitude }} title="You are here" />
            </NativeMap>
          )}
        </View>
      ) : (
        <View style={styles.centered}>
          <Text>No location available.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl
  },
  hero: {
    marginHorizontal: spacing.lg,
    height: 150,
    justifyContent: 'flex-end',
    padding: spacing.md,
    marginBottom: spacing.md
  },
  heroImage: {
    borderRadius: radius.md
  },
  header: {
    fontSize: 22,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.white
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
  map: {
    marginTop: 14,
    height: 280,
    borderRadius: 12
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
