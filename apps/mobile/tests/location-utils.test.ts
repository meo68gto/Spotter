import { describe, expect, it } from 'vitest';
import {
  buildDeniedPermissionMessage,
  buildOfflineFallbackMessage,
  parseCachedCoords
} from '../src/lib/location-utils';

describe('parseCachedCoords', () => {
  it('parses valid coords', () => {
    expect(parseCachedCoords('{"latitude":43.4,"longitude":-110.7}')).toEqual({
      latitude: 43.4,
      longitude: -110.7
    });
  });

  it('returns null for invalid payload', () => {
    expect(parseCachedCoords('{"latitude":"bad"}')).toBeNull();
  });

  it('returns null for non-json', () => {
    expect(parseCachedCoords('x')).toBeNull();
  });
});

describe('location messages', () => {
  it('matches denied permission message', () => {
    expect(buildDeniedPermissionMessage()).toContain('permission denied');
  });

  it('matches offline fallback message', () => {
    expect(buildOfflineFallbackMessage()).toContain('Offline fallback');
  });
});
