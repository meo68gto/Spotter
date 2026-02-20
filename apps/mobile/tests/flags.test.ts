import { describe, expect, it } from 'vitest';
import { flags } from '../src/lib/flags';

describe('flags', () => {
  it('exposes boolean feature flags', () => {
    expect(typeof flags.matchingV2).toBe('boolean');
    expect(typeof flags.videoPipeline).toBe('boolean');
  });
});
