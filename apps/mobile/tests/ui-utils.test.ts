import { describe, expect, it } from 'vitest';
import { formatMode, formatStatus, shortId } from '../src/screens/dashboard/ui-utils';

describe('ui-utils', () => {
  it('formats modes', () => {
    expect(formatMode('text_answer')).toBe('Text Answer');
    expect(formatMode('video_answer')).toBe('Video Answer');
    expect(formatMode('video_call')).toBe('Video Call');
  });

  it('formats status', () => {
    expect(formatStatus('awaiting_expert')).toBe('Awaiting Expert');
  });

  it('shortens ids', () => {
    expect(shortId('1234567890')).toBe('12345678');
  });
});
