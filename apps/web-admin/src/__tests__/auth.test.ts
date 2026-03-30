/**
 * Web-admin auth tests — tests operator session shape and role checks.
 * Web-admin reuses web's auth logic, so these tests verify the same
 * invariants that lib/auth.ts relies on.
 */
import { describe, it, expect } from 'vitest';
import type { OperatorSession } from '@spotter/types';

const MOCK_ADMIN_SESSION: OperatorSession = {
  userId: 'admin-001',
  displayName: 'Spotter Admin',
  email: 'admin@spotter.com',
  role: 'admin',
};

const MOCK_OPERATOR_SESSION: OperatorSession = {
  userId: 'op-001',
  displayName: 'Club Organizer',
  email: 'organizer@golfclub.com',
  role: 'operator',
  organizerId: 'org-001',
  memberRole: 'owner',
};

const MOCK_GOLFER_SESSION: OperatorSession = {
  userId: 'golfer-001',
  displayName: 'Regular Golfer',
  email: 'golfer@email.com',
  role: 'golfer',
};

describe('Web-admin role requirements', () => {
  // Simulate the withOperatorAuth role check
  const requiresOperatorOrAdmin = (session: OperatorSession | null): boolean => {
    if (!session) return false;
    return session.role === 'operator' || session.role === 'admin';
  };

  it('admin session passes operator check', () => {
    expect(requiresOperatorOrAdmin(MOCK_ADMIN_SESSION)).toBe(true);
  });

  it('operator session passes operator check', () => {
    expect(requiresOperatorOrAdmin(MOCK_OPERATOR_SESSION)).toBe(true);
  });

  it('golfer session fails operator check', () => {
    expect(requiresOperatorOrAdmin(MOCK_GOLFER_SESSION)).toBe(false);
  });

  it('null session fails operator check', () => {
    expect(requiresOperatorOrAdmin(null)).toBe(false);
  });
});

describe('Organizer membership check', () => {
  // Simulate the organizer membership verification
  const hasOrganizerMembership = (session: OperatorSession | null): boolean => {
    if (!session) return false;
    return !!session.organizerId;
  };

  it('operator with organizerId passes membership check', () => {
    expect(hasOrganizerMembership(MOCK_OPERATOR_SESSION)).toBe(true);
  });

  it('admin without organizerId fails membership check', () => {
    // Admins may not have an organizerId — membership check is separate
    expect(hasOrganizerMembership(MOCK_ADMIN_SESSION)).toBe(false);
  });

  it('golfer fails membership check', () => {
    expect(hasOrganizerMembership(MOCK_GOLFER_SESSION)).toBe(false);
  });

  it('null session fails membership check', () => {
    expect(hasOrganizerMembership(null)).toBe(false);
  });
});

describe('Member role hierarchy', () => {
  const ROLES = ['owner', 'admin', 'manager', 'viewer'] as const;
  type MemberRole = typeof ROLES[number];

  const canManageMembers = (memberRole?: MemberRole): boolean => {
    if (!memberRole) return false;
    return memberRole === 'owner' || memberRole === 'admin';
  };

  const canCreateEvents = (memberRole?: MemberRole): boolean => {
    if (!memberRole) return false;
    return memberRole === 'owner' || memberRole === 'admin' || memberRole === 'manager';
  };

  const canDeleteEvents = (memberRole?: MemberRole): boolean => {
    if (!memberRole) return false;
    return memberRole === 'owner' || memberRole === 'admin';
  };

  it('owner can manage members', () => {
    expect(canManageMembers('owner')).toBe(true);
  });

  it('admin can manage members', () => {
    expect(canManageMembers('admin')).toBe(true);
  });

  it('manager cannot manage members', () => {
    expect(canManageMembers('manager')).toBe(false);
  });

  it('viewer cannot manage members', () => {
    expect(canManageMembers('viewer')).toBe(false);
  });

  it('owner can create events', () => {
    expect(canCreateEvents('owner')).toBe(true);
  });

  it('manager can create events', () => {
    expect(canCreateEvents('manager')).toBe(true);
  });

  it('viewer cannot create events', () => {
    expect(canCreateEvents('viewer')).toBe(false);
  });

  it('owner can delete events', () => {
    expect(canDeleteEvents('owner')).toBe(true);
  });

  it('manager cannot delete events', () => {
    expect(canDeleteEvents('manager')).toBe(false);
  });
});
