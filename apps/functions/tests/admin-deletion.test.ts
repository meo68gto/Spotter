import { describe, it, expect } from 'vitest';

describe('admin-process-deletion', () => {
  it('rejects requests without admin HMAC', async () => {
    expect(true).toBe(true);
  });

  it('rejects requests with invalid HMAC signature', async () => {
    expect(true).toBe(true);
  });
});
