export type Coords = {
  latitude: number;
  longitude: number;
};

export const parseCachedCoords = (value: string | null): Coords | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<Coords>;
    if (typeof parsed.latitude !== 'number' || typeof parsed.longitude !== 'number') {
      return null;
    }
    return { latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    return null;
  }
};

export const buildDeniedPermissionMessage = (): string =>
  'Location permission denied. Showing last known state if available.';

export const buildOfflineFallbackMessage = (): string =>
  'Unable to fetch current location. Offline fallback active.';
