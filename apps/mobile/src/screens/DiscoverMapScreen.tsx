import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { palette, spacing, radius, font, isWeb } from '../../theme/design';
import { Avatar, Badge, FilterChip, PlayerCard, SkeletonLoader, EmptyState, Header } from '../../components';
import { useDiscoverPlayers } from '../hooks';
import { useSession } from '../../contexts/SessionContext';
import { Coords, parseCachedCoords, buildDeniedPermissionMessage, buildOfflineFallbackMessage } from '../../lib/location-utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SPORTS = ['All', 'Tennis', 'Pickleball', 'Basketball', 'Soccer', 'Golf', 'Padel'];
const SHELF_COLLAPSED_HEIGHT = 220;
const SHELF_EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.55;
const LOCATION_CACHE_KEY = 'spotter_last_known_coords';

interface MapPin { id: string; x: number; y: number; type: 'player' | 'event'; avatarUrl?: string; label?: string; color?: string; }

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildPins(playerIds: string[]): MapPin[] {
  const mapH = SCREEN_HEIGHT * 0.65;
  return playerIds.map((id, i) => ({ id, x: seededRandom(i * 17 + 3) * (SCREEN_WIDTH - 60) + 30, y: seededRandom(i * 13 + 7) * (mapH - 80) + 40, type: 'player' as const }));
}

const EVENT_PINS: MapPin[] = [
  { id: 'e1', x: SCREEN_WIDTH * 0.25, y: 180, type: 'event', label: 'Tournament', color: palette.mint500 },
  { id: 'e2', x: SCREEN_WIDTH * 0.7, y: 260, type: 'event', label: 'Open Court', color: palette.amber500 },
];

export default function DiscoverMapScreen() {
  const navigation = useNavigation<any>();
  const { session } = useSession();
  const userId = session?.user?.id ?? '';
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationBanner, setLocationBanner] = useState<string | null>(null);
  const [activeSport, setActiveSport] = useState('All');
  const [filtersActive, setFiltersActive] = useState(false);
  const [shelfExpanded, setShelfExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const shelfAnim = useRef(new Animated.Value(SHELF_COLLAPSED_HEIGHT)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { players, loading, error } = useDiscoverPlayers({ sport: activeSport === 'All' ? undefined : activeSport, coords, radiusMiles: 5 });

  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
        if (cached) { const parsed = parseCachedCoords(cached); if (parsed) setCoords(parsed); }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocationBanner(buildDeniedPermissionMessage()); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const fresh: Coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCoords(fresh);
        await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(fresh));
        setLocationBanner(null);
      } catch { const msg = buildOfflineFallbackMessage(); if (!coords) setLocationBanner(msg); }
    })();
  }, []);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const toggleShelf = useCallback(() => {
    const toValue = shelfExpanded ? SHELF_COLLAPSED_HEIGHT : SHELF_EXPANDED_HEIGHT;
    Animated.spring(shelfAnim, { toValue, useNativeDriver: false, friction: 8 }).start();
    setShelfExpanded((v) => !v);
  }, [shelfExpanded, shelfAnim]);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
    onPanResponderRelease: (_, g) => {
      if (g.dy < -30) { Animated.spring(shelfAnim, { toValue: SHELF_EXPANDED_HEIGHT, useNativeDriver: false, friction: 8 }).start(); setShelfExpanded(true); }
      else if (g.dy > 30) { Animated.spring(shelfAnim, { toValue: SHELF_COLLAPSED_HEIGHT, useNativeDriver: false, friction: 8 }).start(); setShelfExpanded(false); }
    },
  })).current;

  const filteredPlayers = players.filter((p) => searchQuery.trim() === '' || p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const playerPins = buildPins(filteredPlayers.slice(0, 12).map((p) => p.id));
  const handlePinPress = (playerId: string) => { navigation.navigate('PlayerProfile', { playerId }); };
  const handleToggleToList = () => { navigation.navigate('DiscoverList'); };
  const mapAreaHeight = SCREEN_HEIGHT;

  return (
    <View style={styles.container}>
      <View style={[styles.mapArea, { height: mapAreaHeight }]}>
        {Array.from({ length: 8 }).map((_, i) => (<View key={`h${i}`} style={[styles.mapGridLine, { top: (mapAreaHeight / 8) * i, width: '100%', height: 1 }]} />))}
        {Array.from({ length: 6 }).map((_, i) => (<View key={`v${i}`} style={[styles.mapGridLine, { left: (SCREEN_WIDTH / 6) * i, width: 1, height: '100%' }]} />))}
        {coords && (<View style={styles.locationDotWrapper}><Animated.View style={[styles.locationPulse, { transform: [{ scale: pulseAnim }] }]} /><View style={styles.locationDot} /></View>)}
        {!loading && playerPins.map((pin) => {
          const player = filteredPlayers.find((p) => p.id === pin.id);
          return (<Pressable key={pin.id} style={[styles.playerPin, { left: pin.x - 18, top: pin.y - 18 }]} onPress={() => handlePinPress(pin.id)}><View style={styles.playerPinRing}><Avatar uri={player?.avatar_url} name={player?.display_name} size={30} /></View></Pressable>);
        })}
        {loading && Array.from({ length: 8 }).map((_, i) => (<View key={`skel-pin-${i}`} style={[styles.skeletonPin, { left: seededRandom(i * 17 + 3) * (SCREEN_WIDTH - 60) + 30, top: seededRandom(i * 13 + 7) * (SCREEN_HEIGHT * 0.45 - 80) + 40 }]}><SkeletonLoader width={36} height={36} borderRadius={18} /></View>))}
        {EVENT_PINS.map((pin) => (<View key={pin.id} style={[styles.eventPin, { left: pin.x - 16, top: pin.y - 10 }]}><View style={[styles.eventPinBubble, { backgroundColor: pin.color }]}><Text style={styles.eventPinLabel}>{pin.label}</Text></View><View style={[styles.eventPinTail, { borderTopColor: pin.color }]} /></View>))}
      </View>
      <View style={styles.headerOverlay}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Discover</Text>
          <Pressable style={styles.filterButton} onPress={() => { setFiltersActive((v) => !v); }}>
            <Ionicons name="options-outline" size={22} color={palette.white} />
            {filtersActive && (<View style={styles.filterBadge}><Badge label="!" variant="danger" size="sm" /></View>)}
          </Pressable>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={palette.ink500} style={{ marginRight: spacing.sm }} />
          <TextInput style={styles.searchInput} placeholder="Search players, events, courts..." placeholderTextColor={palette.ink400} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery.length > 0 && (<Pressable onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={16} color={palette.ink400} /></Pressable>)}
        </View>
      </View>
      {locationBanner && (<View style={styles.locationBanner}><Ionicons name="location-outline" size={16} color={palette.white} /><Text style={styles.locationBannerText}>{locationBanner}</Text></View>)}
      <Animated.View style={[styles.bottomShelf, { height: shelfAnim }]}>
        <View {...panResponder.panHandlers} style={styles.shelfHandle}>
          <Pressable onPress={toggleShelf} style={styles.shelfHandleTouchable}><View style={styles.handleBar} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {SPORTS.map((sport) => (<FilterChip key={sport} label={sport} active={activeSport === sport} onPress={() => setActiveSport(sport)} style={{ marginRight: spacing.sm }} />))}
        </ScrollView>
        {!loading && (<Text style={styles.playerCount}>{filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''} within 5 miles</Text>)}
        {loading && (<View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}><SkeletonLoader width={160} height={14} borderRadius={radius.sm} /></View>)}
        {shelfExpanded && (
          <View style={styles.shelfContent}>
            {loading ? (<View style={styles.skeletonGrid}>{Array.from({ length: 4 }).map((_, i) => (<SkeletonLoader key={i} width={(SCREEN_WIDTH - spacing.lg * 3) / 2} height={160} borderRadius={radius.lg} />))}</View>)
            : filteredPlayers.length === 0 ? (<EmptyState icon="person-outline" title="No players nearby" subtitle="Try expanding your search radius or changing sport filters" />)
            : (<FlatList data={filteredPlayers.slice(0, 6)} keyExtractor={(item) => item.id} numColumns={2} columnWrapperStyle={styles.gridRow} contentContainerStyle={styles.gridContent} scrollEnabled={false} renderItem={({ item }) => (<PlayerCard player={item} onPress={() => handlePinPress(item.id)} style={{ flex: 1 }} />)} />)}
          </View>
        )}
        {!loading && !coords && !locationBanner && filteredPlayers.length === 0 && !shelfExpanded && (<View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}><Text style={styles.emptyHint}>Enable location to see players near you</Text></View>)}
      </Animated.View>
      <Pressable style={styles.fab} onPress={handleToggleToList}>
        <Ionicons name="list-outline" size={26} color={palette.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.sky200 },
  mapArea: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: palette.sky200, overflow: 'hidden' },
  mapGridLine: { position: 'absolute', backgroundColor: palette.sky300, opacity: 0.5 },
  locationDotWrapper: { position: 'absolute', left: SCREEN_WIDTH / 2 - 10, top: SCREEN_HEIGHT * 0.32, alignItems: 'center', justifyContent: 'center' },
  locationPulse: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: palette.sky300, opacity: 0.5 },
  locationDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: palette.navy600, borderWidth: 2.5, borderColor: palette.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  playerPin: { position: 'absolute' },
  playerPinRing: { borderRadius: 20, borderWidth: 2.5, borderColor: palette.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3, overflow: 'hidden' },
  skeletonPin: { position: 'absolute', borderRadius: 18, overflow: 'hidden' },
  eventPin: { position: 'absolute', alignItems: 'center' },
  eventPinBubble: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  eventPinLabel: { color: palette.white, fontSize: 10, fontFamily: font.semibold },
  eventPinTail: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: isWeb ? spacing.lg : 52, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: 'transparent' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  headerTitle: { fontFamily: font.bold, fontSize: 28, color: palette.white, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  filterButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  filterBadge: { position: 'absolute', top: -2, right: -2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.gray100, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 14, color: palette.ink900 },
  locationBanner: { position: 'absolute', top: isWeb ? 120 : 160, left: spacing.lg, right: spacing.lg, backgroundColor: palette.amber500, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  locationBannerText: { fontFamily: font.medium, fontSize: 13, color: palette.white, flex: 1 },
  bottomShelf: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: palette.white, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10, overflow: 'hidden' },
  shelfHandle: { width: '100%', alignItems: 'center' },
  shelfHandleTouchable: { paddingVertical: spacing.md, width: '100%', alignItems: 'center' },
  handleBar: { width: 40, height: 4, borderRadius: radius.full, backgroundColor: palette.gray200 },
  chipsRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  playerCount: { fontFamily: font.regular, fontSize: 12, color: palette.ink500, paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.sm },
  shelfContent: { flex: 1, paddingBottom: spacing.xl },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  gridRow: { gap: spacing.md },
  gridContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  emptyHint: { fontFamily: font.regular, fontSize: 13, color: palette.ink500, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 90, right: spacing.lg, width: 52, height: 52, borderRadius: 26, backgroundColor: palette.navy600, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});
