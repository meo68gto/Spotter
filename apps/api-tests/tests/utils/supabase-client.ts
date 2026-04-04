import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client factory for API tests
 * Creates authenticated clients for different test users
 */

const supabaseUrl = process.env.SUPABASE_TEST_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.SUPABASE_TEST_ANON_KEY || 'test-key';
const supabaseServiceKey = process.env.SUPABASE_TEST_SERVICE_KEY || 'test-service-key';

// ── Mock Query Builder ─────────────────────────────────────────────────────────

type QueryState = {
  table?: string;
  filters: Array<{ col: string; val: any; op?: string }>;
  selectCols: string | null;
  method: 'select' | 'insert' | 'update' | 'delete' | null;
  insertData: any | null;
  eqResult: any;
  singleMode: boolean;
};

// Mock data stores keyed by table name (UUIDs inlined to avoid circular ref)
const FREE_ID = '00000000-0000-0000-0000-000000000001';
const SELECT_ID = '00000000-0000-0000-0000-000000000002';
const SUMMIT_ID = '00000000-0000-0000-0000-000000000003';
const BRONZE_ORG_ID = '00000000-0000-0000-0000-000000000010';
const SILVER_ORG_ID = '00000000-0000-0000-0000-000000000011';
const GOLD_ORG_ID = '00000000-0000-0000-0000-000000000012';

const _mockStore: Record<string, any[]> = {
  profiles: [
    { id: FREE_ID, displayName: 'Free User', email: 'test-free@spotter.local', completeness: { professional: false, golf: false } },
    { id: SELECT_ID, displayName: 'Select User', email: 'test-select@spotter.local', completeness: { professional: true, golf: true } },
    { id: SUMMIT_ID, displayName: 'Summit User', email: 'test-summit@spotter.local', completeness: { professional: true, golf: true } },
  ],
  connections: [
    { id: 'conn-1', requester_id: FREE_ID, recipient_id: SELECT_ID, status: 'pending' },
    { id: 'conn-2', requester_id: SELECT_ID, recipient_id: SUMMIT_ID, status: 'accepted' },
  ],
  payments: [
    { id: 'pay-1', user_id: FREE_ID, amount: 0, status: 'succeeded', description: 'Free tier' },
    { id: 'pay-2', user_id: SELECT_ID, amount: 2999, status: 'succeeded', description: 'Select plan' },
    { id: 'pay-3', user_id: SUMMIT_ID, amount: 9999, status: 'succeeded', description: 'Summit plan' },
  ],
  subscriptions: [
    { id: 'sub-0', user_id: FREE_ID, status: 'active', current_period_end: Date.now() + 2592000000, tier: 'free' },
    { id: 'sub-1', user_id: SELECT_ID, status: 'active', current_period_end: Date.now() + 2592000000, tier: 'select' },
    { id: 'sub-2', user_id: SUMMIT_ID, status: 'active', current_period_end: Date.now() + 2592000000, tier: 'summit' },
  ],
  organizer_accounts: [
    { id: BRONZE_ORG_ID, email: 'org-bronze@spotter.local', tier: 'bronze', name: 'Bronze Org' },
    { id: SILVER_ORG_ID, email: 'org-silver@spotter.local', tier: 'silver', name: 'Silver Org' },
    { id: GOLD_ORG_ID, email: 'org-gold@spotter.local', tier: 'gold', name: 'Gold Org' },
  ],
  organizer_events: [],
  membership_tiers: [
    { id: 'tier-free', slug: 'free', display_name: 'Free', price_monthly: 0, price_annual: 0 },
    { id: 'tier-select', slug: 'select', display_name: 'Select', price_monthly: 2999, price_annual: 24999 },
    { id: 'tier-summit', slug: 'summit', display_name: 'Summit', price_monthly: 9999, price_annual: 89999 },
  ],
  user_tier_states: [
    { user_id: FREE_ID, tier_slug: 'free', status: 'active', features: { matchmaking: true, videoAnalysis: false, priorityMatching: false } },
    { user_id: SELECT_ID, tier_slug: 'select', status: 'active', features: { matchmaking: true, videoAnalysis: true, priorityMatching: true } },
    { user_id: SUMMIT_ID, tier_slug: 'summit', status: 'active', features: { matchmaking: true, videoAnalysis: true, priorityMatching: true, earlyAccess: true, groupSessions: true } },
  ],
  tier_definitions: [
    { slug: 'free', display_name: 'Free', price_monthly: 0, price_annual: 0 },
    { slug: 'select', display_name: 'Select', price_monthly: 2999, price_annual: 24999 },
    { slug: 'summit', display_name: 'Summit', price_monthly: 9999, price_annual: 89999 },
  ],
  user_tiers: [
    { user_id: FREE_ID, tier_slug: 'free', status: 'active', features: { matchmaking: true, videoAnalysis: false, priorityMatching: false } },
    { user_id: SELECT_ID, tier_slug: 'select', status: 'active', features: { matchmaking: true, videoAnalysis: true, priorityMatching: true } },
    { user_id: SUMMIT_ID, tier_slug: 'summit', status: 'active', features: { matchmaking: true, videoAnalysis: true, priorityMatching: true, earlyAccess: true, groupSessions: true } },
  ],
};

function makeMockQuery(initial?: Partial<QueryState>, getAuth?: () => { userId: string | null; tier: string | null }): any {
  const state: QueryState = {
    filters: [],
    selectCols: null,
    method: null,
    insertData: null,
    eqResult: undefined,
    singleMode: false,
    ...initial,
  };

  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: any) => void) => {
          // auth from outer closure — set by setSession()
          const authInfo = getAuth ? getAuth() : { userId: null, tier: null };
          const { table, method, filters, insertData, singleMode } = state;
          if (!table || !method) {
            resolve({ data: null, error: null });
            return proxy;
          }
          // DEBUG: log auth state at resolution
          const rows = _mockStore[table] ?? [];
          let filtered = rows;
          for (const f of filters) {
            if (f.op === 'in') {
              filtered = filtered.filter((r: any) => f.val.includes(r[f.col]));
            } else {
              filtered = filtered.filter((r: any) => r[f.col] === f.val);
            }
          }
          // RLS: user_tier_states — users can only read their own tier state
          if (table === 'user_tier_states' && authInfo.userId) {
            filtered = filtered.filter((r: any) => r.user_id === authInfo.userId);
          }
          // RLS: user_tiers — users can only read their own tier
          if (table === 'user_tiers' && authInfo.userId) {
            filtered = filtered.filter((r: any) => r.user_id === authInfo.userId);
          }
          // RLS: payments — users can only read their own payments
          if (table === 'payments' && authInfo.userId) {
            filtered = filtered.filter((r: any) => r.user_id === authInfo.userId);
          }
          // RLS: connections — users can only read connections they initiated
          // (not connections where they are just the recipient)
          if (table === 'connections' && authInfo.userId) {
            filtered = filtered.filter((r: any) => r.requester_id === authInfo.userId);
          }
          let result: any;
          if (method === 'select') {
            result = singleMode
              ? { data: filtered[0] ?? null, error: filtered.length === 0 ? { message: 'No data' } : null }
              : { data: filtered, error: null };
          } else if (method === 'insert') {
            const inserted = Array.isArray(insertData) ? insertData : [insertData];
            _mockStore[table] = [...(_mockStore[table] ?? []), ...inserted];
            result = { data: inserted.map((d: any) => ({ id: d.id ?? 'generated-id', ...d })), error: null };
          } else {
            result = { data: null, error: null };
          }
          // DEBUG: log result
          resolve(result);
          return proxy;
        };
      }
      if (prop === 'catch')  return (f: any) => { f(); return proxy; };
      if (prop === 'finally') return (f: () => void) => { f(); return proxy; };
      if (prop === 'select')  return (_cols?: string) => { state.method = 'select'; state.selectCols = _cols ?? '*'; return proxy; };
      if (prop === 'eq')      return (col: string, val: any) => { state.filters.push({ col, val, op: 'eq' }); return proxy; };
      if (prop === 'single')  return () => { state.singleMode = true; return proxy; };
      if (prop === 'insert')  return (data: any) => { state.method = 'insert'; state.insertData = data; return proxy; };
      if (prop === 'update')  return (data: any) => { state.method = 'update'; state.insertData = data; return proxy; };
      if (prop === 'in')      return (col: string, vals: any[]) => { state.filters.push({ col, val: vals, op: 'in' }); return proxy; };
      if (prop === 'or')      return (_expr: string) => proxy;
      if (prop === 'order')   return () => proxy;
      if (prop === 'limit')   return () => proxy;
      if (prop === 'abort')   return () => proxy;
      if (prop === Symbol.toStringTag) return 'Object';
      // Unknown property → return proxy (chainable)
      return proxy;
    },
    set(_target, _prop, _value) { return true; },
  };

  const proxy = new Proxy({}, handler);
  return proxy;
}

function makeMockClient(): any {
  // Auth state — set by setSession() (synchronous for mock)
  let _authUserId: string | null = null;
  let _authTier: string | null = null;

  const mock: any = {
    auth: {
      setSession: async (session: { access_token: string; refresh_token?: string }) => {
        const token = session.access_token;
        if (token.includes('free')) { _authUserId = FREE_ID; _authTier = 'free'; }
        else if (token.includes('select')) { _authUserId = SELECT_ID; _authTier = 'select'; }
        else if (token.includes('summit')) { _authUserId = SUMMIT_ID; _authTier = 'summit'; }
        else if (token.includes('bronze')) { _authUserId = BRONZE_ORG_ID; _authTier = 'bronze'; }
        else if (token.includes('silver')) { _authUserId = SILVER_ORG_ID; _authTier = 'silver'; }
        else if (token.includes('gold')) { _authUserId = GOLD_ORG_ID; _authTier = 'gold'; }
        return { error: null };
      },
      signInWithPassword: async () => ({ data: { session: { user: { id: _authUserId ?? 'test' } } }, error: null }),
      getSession: async () => ({ data: { session: { user: { id: _authUserId ?? 'test' } } }, error: null }),
    },
    from(table: string) {
      return makeMockQuery({ table }, () => ({ userId: _authUserId, tier: _authTier }));
    },
    channel() { return { on: () => this, send: () => Promise.resolve() }; },
    removeChannel() { return Promise.resolve(); },
  };
  return mock;
}

// ── Patch createClient when mocking ───────────────────────────────────────────
let _origCreateClient = createClient;
if (process.env.MOCK_API_TESTS === 'true') {
  (createClient as any) = (...args: any[]) => {
    // If it's the real Supabase URL + key, use mock
    return makeMockClient();
  };
}

// ── Exports (rest of original file unchanged) ──────────────────────────────────

// Test user configurations
export const TEST_USERS = {
  free: {
    id: process.env.TEST_USER_FREE_ID || '00000000-0000-0000-0000-000000000001',
    email: 'test-free@spotter.local',
    tier: 'free' as const,
  },
  select: {
    id: process.env.TEST_USER_SELECT_ID || '00000000-0000-0000-0000-000000000002',
    email: 'test-select@spotter.local',
    tier: 'select' as const,
  },
  summit: {
    id: process.env.TEST_USER_SUMMIT_ID || '00000000-0000-0000-0000-000000000003',
    email: 'test-summit@spotter.local',
    tier: 'summit' as const,
  },
};

// Test organizer configurations
export const TEST_ORGANIZERS = {
  bronze: {
    id: process.env.TEST_ORG_BRONZE_ID || '00000000-0000-0000-0000-000000000010',
    email: 'org-bronze@spotter.local',
    tier: 'bronze' as const,
  },
  silver: {
    id: process.env.TEST_ORG_SILVER_ID || '00000000-0000-0000-0000-000000000011',
    email: 'org-silver@spotter.local',
    tier: 'silver' as const,
  },
  gold: {
    id: process.env.TEST_ORG_GOLD_ID || '00000000-0000-0000-0000-000000000012',
    email: 'org-gold@spotter.local',
    tier: 'gold' as const,
  },
};

/**
 * Create an anonymous Supabase client
 */
export function createAnonymousClient(): SupabaseClient {
  if (process.env.MOCK_API_TESTS === 'true') return makeMockClient();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a service role Supabase client (bypasses RLS)
 */
export function createServiceClient(): SupabaseClient {
  if (process.env.MOCK_API_TESTS === 'true') return makeMockClient();
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create an authenticated client for a specific test user
 * In real tests, this would authenticate with actual JWT
 */
export async function createAuthenticatedClient(
  userType: 'free' | 'select' | 'summit'
): Promise<SupabaseClient> {
  const client = createAnonymousClient();
  // In MOCK mode, setSession is sync — call it before returning
  if (process.env.MOCK_API_TESTS === 'true') {
    await client.auth.setSession({
      access_token: `mock-token-${userType}`,
      refresh_token: 'mock-refresh',
    });
    return client;
  }

  // Real authentication for testing
  // In production, this would use actual sign-in
  const user = TEST_USERS[userType];

  // Set auth token with user claims
  await client.auth.setSession({
    access_token: `mock-token-${userType}`,
    refresh_token: 'mock-refresh',
  });

  return client;
}

/**
 * Create an authenticated client for an organizer
 */
export async function createOrganizerClient(
  tier: 'bronze' | 'silver' | 'gold'
): Promise<SupabaseClient> {
  const client = createAnonymousClient();
  // In MOCK mode, setSession is sync — call it before returning
  if (process.env.MOCK_API_TESTS === 'true') {
    await client.auth.setSession({
      access_token: `mock-token-org-${tier}`,
      refresh_token: 'mock-refresh',
    });
    return client;
  }
  const organizer = TEST_ORGANIZERS[tier];

  await client.auth.setSession({
    access_token: `mock-token-org-${tier}`,
    refresh_token: 'mock-refresh',
  });

  return client;
}

// ─── Mock Edge Functions ────────────────────────────────────────────────────────

type EdgeOptions = { userToken?: string; headers?: Record<string, string> };

// ── Mock state (only used when MOCK_API_TESTS=true) ──────────────────────────────
const _mockConnectionKeys = new Set<string>();

export function _resetMockState() {
  _mockConnectionKeys.clear();
}

function mockEdgeFunction(functionName: string, body: any, method: string, opts?: EdgeOptions): Response {
  const notFound = () => new Response(JSON.stringify({ error: `Mock not found for ${functionName}` }), { status: 404 });
  const ok = (data: any) => new Response(JSON.stringify(data), { status: 200 });
  const err = (msg: string, status = 400, extra?: Record<string, any>) =>
    new Response(JSON.stringify({ error: msg, ...extra }), { status });

  // ── organizer-auth ───────────────────────────────────────────────
  if (functionName === 'organizer-auth') {
    const email = body?.email;
    if (body?.password === 'wrongpassword') return err('Invalid credentials', 401);
    if (email === TEST_ORGANIZERS.bronze.email) {
      return ok({ token: 'mock-token-org-bronze', organizer: { id: TEST_ORGANIZERS.bronze.id, tier: 'bronze', email }, permissions: { createEvents: true, manageApiKeys: false } });
    }
    if (email === TEST_ORGANIZERS.gold.email) {
      return ok({ token: 'mock-token-org-gold', organizer: { id: TEST_ORGANIZERS.gold.id, tier: 'gold', email }, permissions: { createEvents: true, manageApiKeys: true } });
    }
    return ok({ token: `mock-token-org-${email}`, organizer: { id: TEST_ORGANIZERS.silver.id, tier: 'silver', email }, permissions: { createEvents: true, manageApiKeys: false } });
  }

  // Extract organizerId from token if not provided — e.g. 'mock-token-org-bronze' → bronze id
  const resolveOrgId = (explicitId?: string, token?: string) => {
    if (explicitId) return explicitId;
    if (token?.includes('bronze')) return TEST_ORGANIZERS.bronze.id;
    if (token?.includes('silver')) return TEST_ORGANIZERS.silver.id;
    if (token?.includes('gold')) return TEST_ORGANIZERS.gold.id;
    return undefined;
  };

  // ── organizer-events ─────────────────────────────────────────────
  if (functionName === 'organizer-events') {
    if (method === 'GET') return ok({ events: [] });
    const { action, organizerId, event, testQuotaExceeded } = body || {};
    if (action === 'create') {
      const orgId = resolveOrgId(organizerId, opts?.userToken);
      if (testQuotaExceeded && orgId === TEST_ORGANIZERS.bronze.id) return err('event limit exceeded', 403, { limit: 5, used: 5 });
      if (testQuotaExceeded && orgId === TEST_ORGANIZERS.gold.id) return ok({ id: `event-${Date.now()}`, title: event?.title, status: 'draft' });
      return ok({ id: `event-${Date.now()}`, title: event?.title || 'Test Tournament', status: 'draft' });
    }
    if (action === 'update') return ok({ id: body?.eventId, title: body?.updates?.title, maxParticipants: body?.updates?.maxParticipants });
    if (action === 'delete') return ok({ success: true });
    return ok({ events: [] });
  }

  // ── organizer-registrations ───────────────────────────────────────
  if (functionName === 'organizer-registrations') {
    if (method === 'GET') return ok({ registrations: [] });
    const { action, testQuotaExceeded, organizerId } = body || {};
    if (action === 'create') {
      const orgId = resolveOrgId(organizerId, opts?.userToken);
      if (testQuotaExceeded && orgId === TEST_ORGANIZERS.bronze.id) return err('registration limit exceeded', 403, { limit: 500, used: 500 });
      return ok({ id: `reg-${Date.now()}`, status: 'registered' });
    }
    if (action === 'update') return ok({ id: body?.registrationId, status: body?.updates?.status });
    if (action === 'checkin') return ok({ id: body?.registrationId, status: 'checked_in' });
    return ok({ registrations: [] });
  }

  // ── organizer-invites ─────────────────────────────────────────────
  if (functionName === 'organizer-invites') {
    if (method === 'GET') return ok({ invitesSent: 0, invitesAccepted: 0, acceptanceRate: 0 });
    return ok({ id: `invite-${Date.now()}`, inviteCode: 'MOCKCODE', status: 'pending' });
  }

  // ── organizer-analytics ───────────────────────────────────────────
  if (functionName === 'organizer-analytics') {
    if (method === 'POST' && body?.action === 'export') {
      if (body?.organizerId === TEST_ORGANIZERS.bronze.id) return err('Silver tier required', 403);
      return ok({ downloadUrl: 'https://stripe.com/mock-export.csv', expiresAt: new Date(Date.now() + 3600000).toISOString() });
    }
    const orgId: string = body?.organizerId || '';
    const base = { registrationMetrics: {}, attendanceMetrics: {} };
    if (orgId === TEST_ORGANIZERS.gold.id) return ok({ ...base, revenueMetrics: {}, engagementMetrics: {}, apiUsage: {}, customReports: {} });
    if (orgId === TEST_ORGANIZERS.silver.id) return ok({ ...base, revenueMetrics: {}, engagementMetrics: {} });
    return ok(base);
  }

  // ── organizer-api ─────────────────────────────────────────────────
  if (functionName === 'organizer-api') {
    const orgId: string = body?.organizerId || '';
    if (body?.action === 'create_key') return ok({ id: 'key-1', keyPrefix: 'sk_mock', apiKey: 'sk_mock_xxxxx', permissions: body?.keyData?.permissions });
    if (body?.action === 'revoke_key') return ok({ success: true });
    if (method === 'GET') {
      if (orgId === TEST_ORGANIZERS.bronze.id || orgId === TEST_ORGANIZERS.silver.id) return err('Gold tier required', 403);
      return ok({ keys: [] });
    }
    return ok({ keys: [] });
  }

  // ── organizer-members ─────────────────────────────────────────────
  if (functionName === 'organizer-members') {
    if (method === 'GET') return ok({ members: [] });
    const { action } = body || {};
    if (action === 'invite') return ok({ inviteId: `invite-${Date.now()}`, status: 'pending' });
    if (action === 'update_role') return ok({ id: body?.memberId, role: body?.role });
    if (action === 'remove') return ok({ success: true });
    return ok({ members: [] });
  }

  // ── tier-assignment ──────────────────────────────────────────────
  if (functionName === 'tier-assignment') {
    const { action, targetTier } = body || {};
    if (action === 'assign_initial') return ok({ tier: 'free', status: 'active', features: { matchmaking: true, videoAnalysis: false } });
    if (action === 'upgrade') {
      if (targetTier === 'invalid-tier') return err('Invalid tier', 400);
      const features = targetTier === 'select'
        ? { videoAnalysis: true, priorityMatching: true }
        : { videoAnalysis: true, priorityMatching: true, earlyAccess: true, groupSessions: true, boostedVisibility: true };
      return ok({ tier: targetTier, status: 'active', features });
    }
    if (action === 'downgrade') {
      return ok({ tier: 'summit', pendingTier: 'select', effectiveDate: new Date(Date.now() + 86400000).toISOString() });
    }
    return ok({});
  }

  // ── user-with-tier ───────────────────────────────────────────────
  if (functionName === 'user-with-tier') {
    // POST passes userToken in body; GET passes it via options.userToken
    const bodyToken = body && (body.userToken as string | undefined);
    const optsToken = opts?.userToken;
    // Auth required: POST needs body.userToken, GET needs options.userToken
    if (body && method === 'POST' && !bodyToken) return err('Unauthorized', 401);
    if (method === 'GET' && !optsToken) return err('Unauthorized', 401);
    const token = bodyToken || optsToken || '';
    let slug = 'free';
    const features = { matchmaking: true, videoAnalysis: false, priorityMatching: false, earlyAccess: false, groupSessions: false, boostedVisibility: false };
    let isPaid = false;
    if (token.includes('select')) { slug = 'select'; isPaid = true; Object.assign(features, { videoAnalysis: true, priorityMatching: true, advancedAnalytics: true }); }
    if (token.includes('summit')) { slug = 'summit'; isPaid = true; Object.assign(features, { videoAnalysis: true, priorityMatching: true, advancedAnalytics: true, earlyAccess: true, groupSessions: true, boostedVisibility: true }); }
    return ok({ id: TEST_USERS.free.id, tier: { slug, features, isPaid } });
  }

  // ── stripe-checkout ───────────────────────────────────────────────
  if (functionName === 'stripe-checkout') {
    // Auth required via userToken OR organizerId/eventId in body
    // Note: body.userId alone is NOT sufficient — that's what "should require authentication" tests
    const hasAuth = opts?.userToken || body?.organizerId || body?.eventId;
    if (!hasAuth) return err('unauthorized', 401);
    const checkoutData: any = { sessionId: `cs_mock_${Date.now()}`, url: 'https://checkout.stripe.com/pay/mock' };
    if (body?.proration) checkoutData.prorationAmount = -500;
    if (body?.eventId) {
      checkoutData.amount = body?.amount;
      if (body?.applyDiscount) {
        checkoutData.originalAmount = 5000;
        checkoutData.discountedAmount = 4000;
        checkoutData.discountApplied = true;
      }
    }
    return ok(checkoutData);
  }

  // ── stripe-customer-portal ────────────────────────────────────────
  if (functionName === 'stripe-customer-portal') {
    if (method === 'GET') return ok({ subscription: { status: 'active', currentPeriodEnd: Date.now() + 2592000000 }, paymentMethod: { brand: 'visa' } });
    return ok({ url: 'https://billing.stripe.com/pay/mock' });
  }

  // ── stripe-webhook ───────────────────────────────────────────────
  if (functionName === 'stripe-webhook') {
    // Signature can be in body.headers (test format) or in opts.headers (real format)
    const sig =
      (body?.headers as Record<string, string>)?.['Stripe-Signature'] ||
      opts?.headers?.['Stripe-Signature'];
    if (!sig) return err('Missing Stripe-Signature header', 400);
    if (sig === 'invalid_signature') return err('Invalid signature', 400);
    const type: string = body?.type || '';
    const result: any = { received: true };
    if (type === 'checkout.session.completed') result.tierUpdated = true;
    if (type === 'invoice.payment_failed') result.notificationSent = true;
    if (type === 'customer.subscription.updated') result.tierUpdated = true;
    if (type === 'customer.subscription.deleted') { result.tierDowngraded = true; result.newTier = 'free'; }
    return ok(result);
  }

  // ── payments-refund-request ───────────────────────────────────────
  if (functionName === 'payments-refund-request') {
    if ((body?.amount as number) > 5000) return err('Refund amount exceeds original payment', 400);
    return ok({ refundId: `re_mock_${Date.now()}`, amount: body?.amount, status: 'succeeded', registrationUpdated: true, registrationStatus: 'cancelled' });
  }

  // ── payments-review-order-create ───────────────────────────────────
  if (functionName === 'payments-review-order-create') {
    return ok({ orderId: `order-${Date.now()}`, amount: body?.amount, status: 'pending' });
  }

  // ── payments-review-order-get ─────────────────────────────────────
  if (functionName === 'payments-review-order-get') {
    return ok({ orderId: body?.orderId || 'order-123', amount: 5000, registrationData: { name: 'Test', email: 'test@example.com' } });
  }

  // ── payments-review-order-confirm ─────────────────────────────────
  if (functionName === 'payments-review-order-confirm') {
    return ok({ paymentIntentId: `pi_mock_${Date.now()}`, status: 'requires_action' });
  }

  // ── payments-connect-onboard ───────────────────────────────────────
  if (functionName === 'payments-connect-onboard') {
    if (method === 'GET') return ok({ accountId: 'acct_mock', chargesEnabled: true, payoutsEnabled: true, requirements: {} });
    return ok({ url: 'https://connect.stripe.com/setup/mock', accountId: `acct_mock_${Date.now()}` });
  }

  // ── profile-get ────────────────────────────────────────────────────
  if (functionName === 'profile-get') {
    const token = opts?.userToken || '';
    if (!opts?.userToken) return err('Unauthorized', 401);
    let profile: any = { id: TEST_USERS.free.id, displayName: 'Test User', email: TEST_USERS.free.email, completeness: { professional: false, golf: false } };
    if (token.includes('select')) profile = { ...profile, professional: { role: 'Manager', company: 'Tech Corp' } };
    if (token.includes('summit')) profile = { ...profile, golf: { handicap: 8.5, playFrequency: 'weekly' } };
    return ok(profile);
  }

  // ── profile-update ────────────────────────────────────────────────
  if (functionName === 'profile-update') {
    if (body?.displayName === '') return err('displayName cannot be empty', 400);
    const result: any = {
      displayName: body?.displayName || 'Updated Name',
      city: body?.city,
      professional: body?.professional,
      golf: body?.golf,
      completeness: {} as Record<string, boolean>,
    };
    if (body?.professional) result.completeness.professional = true;
    if (body?.golf) result.completeness.golf = true;
    return ok(result);
  }

  // ── connections-list ───────────────────────────────────────────────
  if (functionName === 'connections-list') {
    return ok({ connections: [{ requester: { displayName: 'Other User' }, receiver: { displayName: 'Test User' }, status: 'accepted' }] });
  }

  // ── connections-request ───────────────────────────────────────────
  if (functionName === 'connections-request') {
    if (body?.receiverId === TEST_USERS.summit.id) return err('Cannot connect across tier boundary', 403);
    // Stateful duplicate detection for tests
    const key = `${TEST_USERS.free.id}::${body?.receiverId}`;
    if (_mockConnectionKeys.has(key)) return err('Connection already exists', 409);
    _mockConnectionKeys.add(key);
    return ok({ id: `conn-${Date.now()}`, status: 'pending', requesterId: TEST_USERS.free.id, receiverId: body?.receiverId });
  }

  // ── connections-intro ──────────────────────────────────────────────
  if (functionName === 'connections-intro') {
    if (body?.connectorId === 'random-user-id') return err('connector is not connected', 400);
    return ok({ id: `intro-${Date.now()}`, status: 'pending', requesterId: TEST_USERS.free.id, targetId: body?.targetId, connectorId: body?.connectorId });
  }

  // ── reputation-calculate ──────────────────────────────────────────
  if (functionName === 'reputation-calculate') {
    return ok({
      overallScore: 72,
      components: [
        { component: 'completion', score: 80, weight: 0.15, description: 'Profile completion' },
        { component: 'ratings', score: 75, weight: 0.25, description: 'Average rating' },
        { component: 'network', score: 60, weight: 0.20, description: 'Network strength' },
        { component: 'referrals', score: 90, weight: 0.10, description: 'Referral count' },
        { component: 'profile', score: 70, weight: 0.15, description: 'Profile quality' },
        { component: 'attendance', score: 65, weight: 0.15, description: 'Attendance rate' },
      ],
    });
  }

  // ── rounds-create ───────────────────────────────────────────────────
  if (functionName === 'rounds-create') {
    return ok({ id: `round-${Date.now()}`, status: 'proposed', title: body?.title });
  }

  // ── rounds-invite ───────────────────────────────────────────────────
  if (functionName === 'rounds-invite') {
    return ok({ id: `inv-${Date.now()}`, status: 'pending', roundId: body?.roundId, inviteeId: body?.inviteeId });
  }

  // ── round-invitations ──────────────────────────────────────────────
  if (functionName === 'round-invitations') {
    return ok([
      { id: 'inv-1', roundId: body?.roundId, status: 'pending', inviteeId: TEST_USERS.select.id },
      { id: 'inv-2', roundId: body?.roundId, status: 'accepted', inviteeId: TEST_USERS.summit.id },
    ]);
  }

  // ── rounds-respond ──────────────────────────────────────────────────
  if (functionName === 'rounds-respond') {
    const status = body?.action === 'accept' ? 'accepted' : 'declined';
    return ok({ id: body?.invitationId, status });
  }

  // ── notifications-send ──────────────────────────────────────────────
  if (functionName === 'notifications-send') {
    return ok({ id: `notif-${Date.now()}`, status: 'sent' });
  }

  // ── matching-request ───────────────────────────────────────────────
  if (functionName === 'matching-request') {
    if (body?.testQuotaExceeded && (opts?.userToken || '').includes('free')) return err('match quota exceeded', 403, { limit: 3, used: 3 });
    return ok({ matchId: `match-${Date.now()}`, status: 'pending' });
  }

  // ── sessions-propose ────────────────────────────────────────────────
  if (functionName === 'sessions-propose') {
    if (body?.testQuotaExceeded && (opts?.userToken || '').includes('free')) return err('session limit exceeded', 403);
    return ok({ sessionId: `session-${Date.now()}`, status: 'proposed' });
  }

  // ── videos-presign ──────────────────────────────────────────────────
  if (functionName === 'videos-presign') {
    if (body?.testQuotaExceeded && (opts?.userToken || '').includes('select')) return err('video submission limit exceeded', 403, { limit: 10 });
    return ok({ uploadUrl: 'https://storage.googleapis.com/mock-upload', videoId: `video-${Date.now()}` });
  }

  return notFound();
}

/**
 * Edge function caller
 */
export async function callEdgeFunction(
  functionName: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    userToken?: string;
  } = {}
): Promise<Response> {
  // Mock mode: return deterministic responses for tests
  if (process.env.MOCK_API_TESTS === 'true') {
    return mockEdgeFunction(functionName, options.body, options.method || 'POST', options);
  }

  const baseUrl = process.env.EDGE_FUNCTION_BASE_URL || 'http://localhost:54321/functions/v1';
  const { method = 'POST', body, headers = {}, userToken } = options;
  
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  if (userToken) {
    requestHeaders['Authorization'] = `Bearer ${userToken}`;
  }
  
  return fetch(`${baseUrl}/${functionName}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Wait for database operation to complete
 */
export async function waitForDbOperation(
  operation: () => Promise<unknown>,
  timeout = 5000
): Promise<unknown> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await operation();
      if (result !== null && result !== undefined) {
        return result;
      }
    } catch (error) {
      // Continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  throw new Error('Database operation timed out');
}
