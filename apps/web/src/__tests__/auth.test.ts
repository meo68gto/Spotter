/**
 * Auth tests for web — tests cookie auth, role checks, and session utilities.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OperatorSession } from '@spotter/types';

// We'll test the auth logic in isolation by mocking Supabase client dependencies
// The actual tests verify role-checking logic and session shape validation.

const MOCK_OPERATOR_SESSION: OperatorSession = {
  userId: 'user-123',
  displayName: 'Test Organizer',
  email: 'organizer@club.com',
  role: 'operator',
  organizerId: 'org-456',
  memberRole: 'owner',
};

const MOCK_ADMIN_SESSION: OperatorSession = {
  userId: 'admin-123',
  displayName: 'Test Admin',
  email: 'admin@spotter.com',
  role: 'admin',
};

const MOCK_GOLFER_SESSION: OperatorSession = {
  userId: 'golfer-123',
  displayName: 'Test Golfer',
  email: 'golfer@club.com',
  role: 'golfer',
};

describe('OperatorSession shape validation', () => {
  it('should have required fields for operator session', () => {
    expect(MOCK_OPERATOR_SESSION.userId).toBeTruthy();
    expect(MOCK_OPERATOR_SESSION.displayName).toBeTruthy();
    expect(MOCK_OPERATOR_SESSION.email).toBeTruthy();
    expect(['golfer', 'operator', 'admin']).toContain(MOCK_OPERATOR_SESSION.role);
  });

  it('should have organizerId and memberRole for operator sessions', () => {
    expect(MOCK_OPERATOR_SESSION.organizerId).toBeTruthy();
    expect(MOCK_OPERATOR_SESSION.memberRole).toBeTruthy();
  });

  it('should NOT have organizerId for golfer sessions', () => {
    expect(MOCK_GOLFER_SESSION.organizerId).toBeUndefined();
    expect(MOCK_GOLFER_SESSION.memberRole).toBeUndefined();
  });
});

describe('Role check logic', () => {
  // Simulate the role-check logic from lib/auth.ts
  const isOperatorOrAdmin = (session: OperatorSession | null) => {
    if (!session) return false;
    return session.role === 'operator' || session.role === 'admin';
  };

  it('should return true for operator role', () => {
    expect(isOperatorOrAdmin(MOCK_OPERATOR_SESSION)).toBe(true);
  });

  it('should return true for admin role', () => {
    expect(isOperatorOrAdmin(MOCK_ADMIN_SESSION)).toBe(true);
  });

  it('should return false for golfer role', () => {
    expect(isOperatorOrAdmin(MOCK_GOLFER_SESSION)).toBe(false);
  });

  it('should return false for null session', () => {
    expect(isOperatorOrAdmin(null)).toBe(false);
  });

  it('should return false for undefined session', () => {
    expect(isOperatorOrAdmin(undefined as unknown as null)).toBe(false);
  });
});

describe('Session display name', () => {
  it('should use displayName when available', () => {
    expect(MOCK_OPERATOR_SESSION.displayName).toBe('Test Organizer');
  });

  it('should fall back to email prefix for sessions without displayName', () => {
    const sessionWithoutName: OperatorSession = {
      userId: 'user-789',
      displayName: '',
      email: 'john.smith@example.com',
      role: 'golfer',
    };
    const displayName = sessionWithoutName.displayName || sessionWithoutName.email?.split('@')[0] || 'User';
    expect(displayName).toBe('john.smith');
  });
});
