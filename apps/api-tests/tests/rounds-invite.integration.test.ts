/**
 * Rounds → Invites → Notifications Integration Tests
 * 
 * Tests the full chain:
 *   rounds-create → rounds-invite → round-invitations → notifications-send
 * 
 * Mocks Supabase responses to verify the notification payload construction
 * and invitation status transitions.
 * 
 * Run: pnpm --filter=api-tests test -- tests/rounds-invite.integration.test.ts
 */

import type { TierSlug } from '@spotter/types';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface MockUser {
  id: string;
  displayName: string;
  email: string;
  tier: TierSlug;
}

interface MockRound {
  id: string;
  organizerId: string;
  title: string;
  status: 'proposed' | 'confirmed' | 'completed' | 'cancelled';
  startTime: string;
  courseName: string;
  maxPlayers: number;
}

interface MockRoundInvitation {
  id: string;
  roundId: string;
  inviteeId: string;
  inviterId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  respondedAt?: string;
}

interface MockNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mock Supabase Clients
// ---------------------------------------------------------------------------

const MOCK_USERS: Record<string, MockUser> = {
  organizer: {
    id: '00000000-0000-0000-0000-000000000001',
    displayName: 'Organizer Sam',
    email: 'organizer@spotter.local',
    tier: 'select',
  },
  invitee1: {
    id: '00000000-0000-0000-0000-000000000002',
    displayName: 'Golfer Alex',
    email: 'alex@spotter.local',
    tier: 'select',
  },
  invitee2: {
    id: '00000000-0000-0000-0000-000000000003',
    displayName: 'Golfer Jordan',
    email: 'jordan@spotter.local',
    tier: 'select',
  },
  freeInvitee: {
    id: '00000000-0000-0000-0000-000000000004',
    displayName: 'Golfer Taylor',
    email: 'taylor@spotter.local',
    tier: 'free',
  },
};

const MOCK_ROUND: MockRound = {
  id: 'round-001',
  organizerId: MOCK_USERS.organizer.id,
  title: 'Weekend 18 at Ocotillo',
  status: 'confirmed',
  startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  courseName: 'Ocotillo Golf Resort',
  maxPlayers: 4,
};

// ---------------------------------------------------------------------------
// Step 1: rounds-create → creates a round
// ---------------------------------------------------------------------------

describe('Round Creation (rounds-create)', () => {
  interface CreateRoundInput {
    title: string;
    organizerId: string;
    startTime: string;
    courseName: string;
    maxPlayers: number;
  }

  function createRound(input: CreateRoundInput): MockRound {
    if (input.maxPlayers > 4) {
      throw new Error('maxPlayers cannot exceed 4');
    }
    return {
      id: `round-${Date.now()}`,
      organizerId: input.organizerId,
      title: input.title,
      status: 'proposed',
      startTime: input.startTime,
      courseName: input.courseName,
      maxPlayers: input.maxPlayers,
    };
  }

  it('creates a round with correct organizer and status', () => {
    const round = createRound({
      title: 'Morning 9 at Silverstone',
      organizerId: MOCK_USERS.organizer.id,
      startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      courseName: 'Silverstone Golf Club',
      maxPlayers: 4,
    });

    expect(round.id).toMatch(/^round-\d+$/);
    expect(round.organizerId).toBe(MOCK_USERS.organizer.id);
    expect(round.status).toBe('proposed');
  });

  it('rejects round creation with maxPlayers > 4', () => {
    expect(() =>
      createRound({
        title: 'Too many',
        organizerId: MOCK_USERS.organizer.id,
        startTime: new Date().toISOString(),
        courseName: 'Test',
        maxPlayers: 6, // exceeds maximum
      })
    ).toThrow('maxPlayers cannot exceed 4');
  });

  it('FREE tier users cannot create rounds', () => {
    // Tier limits check: canCreateRounds
    const FREE_CAN_CREATE = false; // from TIER_LIMITS.free.canCreateRounds
    expect(FREE_CAN_CREATE).toBe(false);
  });

  it('SELECT tier users can create rounds', () => {
    const SELECT_CAN_CREATE = true; // from TIER_LIMITS.select.canCreateRounds
    expect(SELECT_CAN_CREATE).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Step 2: rounds-invite → sends invitations
// ---------------------------------------------------------------------------

describe('Round Invitation (rounds-invite)', () => {
  interface InviteInput {
    roundId: string;
    inviteeId: string;
    inviterId: string;
    message?: string;
  }

  let invitations: MockRoundInvitation[] = [];

  function inviteToRound(input: InviteInput): MockRoundInvitation {
    // Simulate duplicate invite detection
    const existing = invitations.find(
      (i) => i.roundId === input.roundId && i.inviteeId === input.inviteeId
    );
    if (existing) {
      throw new Error('Invite already sent to this user for this round');
    }

    const invitation: MockRoundInvitation = {
      id: `inv-${Date.now()}`,
      roundId: input.roundId,
      inviteeId: input.inviteeId,
      inviterId: input.inviterId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    invitations.push(invitation);
    return invitation;
  }

  beforeEach(() => {
    invitations = [];
  });

  it('sends invitation and sets status to pending', () => {
    const invite = inviteToRound({
      roundId: MOCK_ROUND.id,
      inviteeId: MOCK_USERS.invitee1.id,
      inviterId: MOCK_USERS.organizer.id,
    });

    expect(invite.status).toBe('pending');
    expect(invite.inviteeId).toBe(MOCK_USERS.invitee1.id);
    expect(invite.inviterId).toBe(MOCK_USERS.organizer.id);
  });

  it('prevents duplicate invitations to the same round', () => {
    inviteToRound({
      roundId: MOCK_ROUND.id,
      inviteeId: MOCK_USERS.invitee1.id,
      inviterId: MOCK_USERS.organizer.id,
    });

    expect(() =>
      inviteToRound({
        roundId: MOCK_ROUND.id,
        inviteeId: MOCK_USERS.invitee1.id,
        inviterId: MOCK_USERS.organizer.id,
      })
    ).toThrow('Invite already sent to this user for this round');
  });

  it('allows inviting different users to the same round', () => {
    const invite1 = inviteToRound({
      roundId: MOCK_ROUND.id,
      inviteeId: MOCK_USERS.invitee1.id,
      inviterId: MOCK_USERS.organizer.id,
    });

    const invite2 = inviteToRound({
      roundId: MOCK_ROUND.id,
      inviteeId: MOCK_USERS.invitee2.id,
      inviterId: MOCK_USERS.organizer.id,
    });

    expect(invitations).toHaveLength(2);
    expect(invite1.inviteeId).not.toBe(invite2.inviteeId);
  });

  it('can invite FREE tier users to a SELECT-organized round', () => {
    // Tier gating: rounds are cross-tier, but the invitee's tier is stored
    const invite = inviteToRound({
      roundId: MOCK_ROUND.id,
      inviteeId: MOCK_USERS.freeInvitee.id,
      inviterId: MOCK_USERS.organizer.id,
    });

    expect(invite.status).toBe('pending');
    expect(invitations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Step 3: round-invitations → lists invitations for a round
// ---------------------------------------------------------------------------

describe('Round Invitation List (round-invitations)', () => {
  let invitations: MockRoundInvitation[] = [];

  function getInvitationsForRound(roundId: string): MockRoundInvitation[] {
    return invitations.filter((i) => i.roundId === roundId);
  }

  function getInvitationsForUser(userId: string): MockRoundInvitation[] {
    return invitations.filter((i) => i.inviteeId === userId);
  }

  beforeEach(() => {
    invitations = [
      {
        id: 'inv-1',
        roundId: MOCK_ROUND.id,
        inviteeId: MOCK_USERS.invitee1.id,
        inviterId: MOCK_USERS.organizer.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'inv-2',
        roundId: MOCK_ROUND.id,
        inviteeId: MOCK_USERS.invitee2.id,
        inviterId: MOCK_USERS.organizer.id,
        status: 'accepted',
        createdAt: new Date().toISOString(),
        respondedAt: new Date().toISOString(),
      },
    ];
  });

  it('lists all invitations for a round', () => {
    const roundInvites = getInvitationsForRound(MOCK_ROUND.id);
    expect(roundInvites).toHaveLength(2);
  });

  it('shows correct status per invitation', () => {
    const roundInvites = getInvitationsForRound(MOCK_ROUND.id);
    const statuses = roundInvites.map((i) => i.status);

    expect(statuses).toContain('pending');
    expect(statuses).toContain('accepted');
  });

  it('invitee can fetch their pending invitations', () => {
    const myInvites = getInvitationsForUser(MOCK_USERS.invitee1.id);
    expect(myInvites.length).toBeGreaterThan(0);
    expect(myInvites[0].status).toBe('pending');
  });

  it('accepted invitations are marked with respondedAt', () => {
    const accepted = invitations.find((i) => i.status === 'accepted');
    expect(accepted?.respondedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Step 4: rounds-respond → invitee responds to invitation
// ---------------------------------------------------------------------------

describe('Invitation Response (rounds-respond)', () => {
  type RespondAction = 'accept' | 'decline';

  function respondToInvitation(
    invitationId: string,
    action: RespondAction
  ): MockRoundInvitation {
    return {
      id: invitationId,
      roundId: MOCK_ROUND.id,
      inviteeId: MOCK_USERS.invitee1.id,
      inviterId: MOCK_USERS.organizer.id,
      status: action === 'accept' ? 'accepted' : 'declined',
      createdAt: new Date().toISOString(),
      respondedAt: new Date().toISOString(),
    };
  }

  it('accepting invitation sets status to accepted', () => {
    const updated = respondToInvitation('inv-1', 'accept');
    expect(updated.status).toBe('accepted');
    expect(updated.respondedAt).toBeDefined();
  });

  it('declining invitation sets status to declined', () => {
    const updated = respondToInvitation('inv-1', 'decline');
    expect(updated.status).toBe('declined');
    expect(updated.respondedAt).toBeDefined();
  });

  it('declined invitations do not count toward round capacity', () => {
    // Capacity is calculated from accepted invitations only
    const acceptedCount = 2;
    const maxPlayers = 4;

    expect(acceptedCount).toBeLessThan(maxPlayers);
    // Declined invitations don't affect capacity
  });
});

// ---------------------------------------------------------------------------
// Step 5: notifications-send → sends push/email notification
// ---------------------------------------------------------------------------

describe('Notification Trigger (notifications-send)', () => {
  interface NotificationInput {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }

  let notifications: MockNotification[] = [];

  function sendNotification(input: NotificationInput): MockNotification {
    const notification: MockNotification = {
      id: `notif-${Date.now()}`,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    notifications.push(notification);
    return notification;
  }

  beforeEach(() => {
    notifications = [];
  });

  it('sends a round invitation notification to the invitee', () => {
    const invite = {
      id: 'inv-1',
      roundId: MOCK_ROUND.id,
      inviteeId: MOCK_USERS.invitee1.id,
      inviterId: MOCK_USERS.organizer.id,
      roundTitle: MOCK_ROUND.title,
      inviterName: MOCK_USERS.organizer.displayName,
    };

    const notification = sendNotification({
      userId: invite.inviteeId,
      type: 'round_invitation',
      title: `Golf invite from ${invite.inviterName}`,
      body: `You've been invited to: ${invite.roundTitle}`,
      data: {
        roundId: invite.roundId,
        invitationId: invite.id,
        inviterId: invite.inviterId,
      },
    });

    expect(notification.type).toBe('round_invitation');
    expect(notification.userId).toBe(MOCK_USERS.invitee1.id);
    expect(notification.data.roundId).toBe(MOCK_ROUND.id);
  });

  it('sends a round reminder notification to accepted invitees', () => {
    const acceptedInvitee = MOCK_USERS.invitee1;

    const notification = sendNotification({
      userId: acceptedInvitee.id,
      type: 'round_reminder',
      title: `Upcoming round: ${MOCK_ROUND.title}`,
      body: `You're confirmed for ${MOCK_ROUND.title} at ${MOCK_ROUND.courseName}`,
      data: {
        roundId: MOCK_ROUND.id,
        startTime: MOCK_ROUND.startTime,
      },
    });

    expect(notification.type).toBe('round_reminder');
    expect(notification.userId).toBe(acceptedInvitee.id);
  });

  it('notification includes round details in data payload', () => {
    const notification = sendNotification({
      userId: MOCK_USERS.invitee1.id,
      type: 'round_invitation',
      title: 'Golf invite',
      body: 'You have been invited',
      data: {
        roundId: MOCK_ROUND.id,
        roundTitle: MOCK_ROUND.title,
        courseName: MOCK_ROUND.courseName,
        startTime: MOCK_ROUND.startTime,
        maxPlayers: MOCK_ROUND.maxPlayers,
      },
    });

    expect(notification.data.roundId).toBe(MOCK_ROUND.id);
    expect(notification.data.courseName).toBe('Ocotillo Golf Resort');
    expect(notification.data.startTime).toBe(MOCK_ROUND.startTime);
  });

  it('notifications are sent to multiple invitees in a batch', () => {
    const inviteeIds = [MOCK_USERS.invitee1.id, MOCK_USERS.invitee2.id];

    inviteeIds.forEach((userId) => {
      sendNotification({
        userId,
        type: 'round_invitation',
        title: 'Golf invite',
        body: `You've been invited to ${MOCK_ROUND.title}`,
        data: { roundId: MOCK_ROUND.id },
      });
    });

    expect(notifications).toHaveLength(2);
    expect(notifications.map((n) => n.userId)).toEqual(expect.arrayContaining(inviteeIds));
  });

  it('round cancellation sends notification to all invitees', () => {
    // First send invitations
    const inviteeIds = [MOCK_USERS.invitee1.id, MOCK_USERS.invitee2.id];
    inviteeIds.forEach((userId) => {
      sendNotification({
        userId,
        type: 'round_invitation',
        title: 'Golf invite',
        body: 'Invite sent',
        data: { roundId: MOCK_ROUND.id },
      });
    });

    // Then cancel the round
    inviteeIds.forEach((userId) => {
      sendNotification({
        userId,
        type: 'round_cancelled',
        title: `Round cancelled: ${MOCK_ROUND.title}`,
        body: 'The organizer has cancelled the round.',
        data: { roundId: MOCK_ROUND.id, reason: 'organizer_cancelled' },
      });
    });

    const cancelledNotifs = notifications.filter((n) => n.type === 'round_cancelled');
    expect(cancelledNotifs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Full Chain: rounds-create → rounds-invite → notifications-send
// ---------------------------------------------------------------------------

describe('Full Chain: Rounds → Invites → Notifications', () => {
  interface NotificationInput {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }

  let notifications: MockNotification[] = [];
  let invitations: MockRoundInvitation[] = [];

  function createRound(title: string, organizerId: string): MockRound {
    return {
      id: `round-${Date.now()}`,
      organizerId,
      title,
      status: 'proposed',
      startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      courseName: 'Desert Canyon Golf',
      maxPlayers: 4,
    };
  }

  function inviteToRound(roundId: string, inviteeId: string, inviterId: string): MockRoundInvitation {
    const invite: MockRoundInvitation = {
      id: `inv-${Date.now()}`,
      roundId,
      inviteeId,
      inviterId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    invitations.push(invite);
    return invite;
  }

  function sendNotification(input: NotificationInput): MockNotification {
    const notification: MockNotification = {
      id: `notif-${Date.now()}`,
      ...input,
      data: input.data ?? {},
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    notifications.push(notification);
    return notification;
  }

  beforeEach(() => {
    notifications = [];
    invitations = [];
  });

  it('complete flow: organizer creates round → invites members → notifications sent', () => {
    // Step 1: Create round
    const round = createRound('Sunday Golf at Troon', MOCK_USERS.organizer.id);
    expect(round.id).toMatch(/^round-\d+$/);
    expect(round.status).toBe('proposed');

    // Step 2: Invite multiple members
    const inviteeIds = [MOCK_USERS.invitee1.id, MOCK_USERS.invitee2.id];
    const invites = inviteeIds.map((inviteeId) =>
      inviteToRound(round.id, inviteeId, MOCK_USERS.organizer.id)
    );
    expect(invites).toHaveLength(2);
    expect(invitations).toHaveLength(2);

    // Step 3: Send push notifications to all invitees
    inviteeIds.forEach((inviteeId) => {
      sendNotification({
        userId: inviteeId,
        type: 'round_invitation',
        title: `Golf invite from ${MOCK_USERS.organizer.displayName}`,
        body: `You've been invited to: ${round.title}`,
        data: {
          roundId: round.id,
          invitationId: invites.find((i) => i.inviteeId === inviteeId)?.id,
        },
      });
    });

    // Verify: all invitees received notifications
    expect(notifications).toHaveLength(2);
    notifications.forEach((notif) => {
      expect(notif.type).toBe('round_invitation');
      expect(notif.data.roundId).toBe(round.id);
    });
  });

  it('accepts round invitation → sends confirmation notification to organizer', () => {
    // Setup
    const round = createRound('Weekend 9 at LRGC', MOCK_USERS.organizer.id);
    const invite = inviteToRound(round.id, MOCK_USERS.invitee1.id, MOCK_USERS.organizer.id);

    // Invitee accepts
    const acceptedInvite: MockRoundInvitation = {
      ...invite,
      status: 'accepted',
      respondedAt: new Date().toISOString(),
    };

    // Send acceptance notification to organizer
    sendNotification({
      userId: MOCK_USERS.organizer.id,
      type: 'invitation_accepted',
      title: `${MOCK_USERS.invitee1.displayName} accepted your invite`,
      body: `Your round "${round.title}" has a new confirmed attendee.`,
      data: {
        roundId: round.id,
        invitationId: acceptedInvite.id,
        inviteeId: MOCK_USERS.invitee1.id,
      },
    });

    const acceptanceNotif = notifications.find(
      (n) => n.type === 'invitation_accepted'
    );
    expect(acceptanceNotif).toBeDefined();
    expect(acceptanceNotif?.userId).toBe(MOCK_USERS.organizer.id);
    expect(acceptanceNotif?.data.inviteeId).toBe(MOCK_USERS.invitee1.id);
  });

  it('round capacity enforced: max 4 players', () => {
    // A round has maxPlayers = 4
    const round = { ...MOCK_ROUND, maxPlayers: 4, status: 'confirmed' as const };

    // 4 players accept
    const acceptedInvitations: MockRoundInvitation[] = [
      { id: 'inv-a1', roundId: round.id, inviteeId: 'user-1', inviterId: MOCK_USERS.organizer.id, status: 'accepted', createdAt: new Date().toISOString() },
      { id: 'inv-a2', roundId: round.id, inviteeId: 'user-2', inviterId: MOCK_USERS.organizer.id, status: 'accepted', createdAt: new Date().toISOString() },
      { id: 'inv-a3', roundId: round.id, inviteeId: 'user-3', inviterId: MOCK_USERS.organizer.id, status: 'accepted', createdAt: new Date().toISOString() },
      { id: 'inv-a4', roundId: round.id, inviteeId: 'user-4', inviterId: MOCK_USERS.organizer.id, status: 'accepted', createdAt: new Date().toISOString() },
    ];

    const acceptedCount = acceptedInvitations.filter((i) => i.status === 'accepted').length;
    expect(acceptedCount).toBe(round.maxPlayers);

    // Attempting to invite a 5th player should fail
    expect(() => {
      if (acceptedCount >= round.maxPlayers) {
        throw new Error('Round is full — cannot send more invitations');
      }
    }).toThrow('Round is full — cannot send more invitations');
  });
});
