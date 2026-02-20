import { describe, expect, it } from 'vitest';
import { extractOAuthCode } from '../src/lib/auth-utils';

describe('extractOAuthCode', () => {
  it('returns code when callback url includes it', () => {
    expect(extractOAuthCode('spotter://auth/callback?code=abc123')).toBe('abc123');
  });

  it('returns null when url is invalid', () => {
    expect(extractOAuthCode('not-a-url')).toBeNull();
  });

  it('returns null when code is missing', () => {
    expect(extractOAuthCode('spotter://auth/callback')).toBeNull();
  });
});
