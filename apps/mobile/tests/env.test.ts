import { describe, expect, it } from 'vitest';
import { validateMobileEnv } from '../src/types/env';

describe('validateMobileEnv', () => {
  it('returns array of missing keys in test env', () => {
    const result = validateMobileEnv();
    expect(Array.isArray(result)).toBe(true);
  });
});
