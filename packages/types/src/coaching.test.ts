import { describe, expect, it } from 'vitest';
import type { CoachRequestStatus, CoachServiceType } from './coaching';

const SERVICE_TYPES: CoachServiceType[] = ['video_review', 'live_video_call', 'swing_plan', 'text_qna'];
const TERMINAL_STATUSES: CoachRequestStatus[] = ['delivered', 'declined', 'expired', 'cancelled', 'refunded'];

describe('coaching types', () => {
  it('supports the unified service catalog', () => {
    expect(SERVICE_TYPES).toContain('video_review');
    expect(SERVICE_TYPES).toContain('live_video_call');
  });

  it('includes paid fulfillment terminal statuses', () => {
    expect(TERMINAL_STATUSES).toContain('delivered');
    expect(TERMINAL_STATUSES).toContain('refunded');
  });
});
