import { test as setup, expect } from '@playwright/test';

/**
 * Authentication setup for E2E tests — NO UI login, direct Supabase REST API
 *
 * Replaces the slow UI login flow (5+ browser configs × login time) with
 * a direct Supabase Auth API call. This cuts E2E time by ~60%.
 *
 * Approach:
 * 1. Sign in via Supabase REST API (signInWithPassword) — no UI involved
 * 2. Inject the session tokens into the browser context via addInitScript
 * 3. Navigate to app to trigger Supabase session restore
 * 4. Save storageState for dependent test projects
 *
 * Supabase browser client reads from localStorage:
 *   - `sb-access-token`
 *   - `sb-refresh-token`
 */

interface TestUser {
  email: string;
  password: string;
  tier: string;
  type: 'member' | 'organizer';
  storageState: string;
}

const testUsers: TestUser[] = [
  // Member tiers
  {
    email: process.env.TEST_USER_FREE_EMAIL || 'free@spotter.test',
    password: process.env.TEST_USER_FREE_PASSWORD || 'SpotterTest123!',
    tier: 'free',
    type: 'member',
    storageState: 'playwright/.auth/member-free.json',
  },
  {
    email: process.env.TEST_USER_SELECT_EMAIL || 'test-select@spotter.local',
    password: process.env.TEST_USER_SELECT_PASSWORD || 'TestSelect123!',
    tier: 'select',
    type: 'member',
    storageState: 'playwright/.auth/member-select.json',
  },
  {
    email: process.env.TEST_USER_SUMMIT_EMAIL || 'test-summit@spotter.local',
    password: process.env.TEST_USER_SUMMIT_PASSWORD || 'TestSummit123!',
    tier: 'summit',
    type: 'member',
    storageState: 'playwright/.auth/member-summit.json',
  },
  // Organizer tiers
  {
    email: process.env.TEST_ORG_BRONZE_EMAIL || 'org-bronze@spotter.local',
    password: process.env.TEST_ORG_BRONZE_PASSWORD || 'OrgBronze123!',
    tier: 'bronze',
    type: 'organizer',
    storageState: 'playwright/.auth/organizer-bronze.json',
  },
  {
    email: process.env.TEST_ORG_SILVER_EMAIL || 'org-silver@spotter.local',
    password: process.env.TEST_ORG_SILVER_PASSWORD || 'OrgSilver123!',
    tier: 'silver',
    type: 'organizer',
    storageState: 'playwright/.auth/organizer-silver.json',
  },
  {
    email: process.env.TEST_ORG_GOLD_EMAIL || 'org-gold@spotter.local',
    password: process.env.TEST_ORG_GOLD_PASSWORD || 'OrgGold123!',
    tier: 'gold',
    type: 'organizer',
    storageState: 'playwright/.auth/organizer-gold.json',
  },
];

/**
 * Validate required environment variables before running auth tests.
 * Fails fast with a clear message rather than cryptic fetch errors.
 */
function validateEnv(): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const baseUrl = process.env.TEST_BASE_URL;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!baseUrl) missing.push('TEST_BASE_URL');

  if (missing.length > 0) {
    throw new Error(
      `[auth.setup] Missing required env vars: ${missing.join(', ')}. ` +
        `Check apps/e2e/.env.test — all Supabase test credentials must be configured.`
    );
  }

  // Warn if using localhost (likely Docker not running)
  if (supabaseUrl?.includes('localhost')) {
    console.warn(
      `[auth.setup] WARNING: NEXT_PUBLIC_SUPABASE_URL uses localhost (${supabaseUrl}). ` +
        `Ensure Supabase Docker is running (\`pnpm supabase:start\`). ` +
        `Otherwise set NEXT_PUBLIC_SUPABASE_URL to your cloud Supabase instance in .env.test.`
    );
  }
}

/**
 * Wait for the app base URL to be reachable before running tests.
 * Uses a short timeout — if the dev server isn't up, fail fast.
 */
async function waitForApp(baseUrl: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl, { method: 'HEAD' });
      if (res.ok || res.status === 404) return; // server is up
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(
    `[auth.setup] App not reachable at ${baseUrl} after ${timeoutMs}ms. ` +
      `Start the dev server with \`pnpm --filter=web dev\` before running e2e tests.`
  );
}

/**
 * Sign in via Supabase REST API — same auth as UI login, but no browser needed.
 * Uses Node's built-in fetch to call the Supabase Auth endpoint.
 */
async function getSession(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string
): Promise<{ access_token: string; refresh_token: string }> {
  const url = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    let hint = '';
    if (res.status === 400) {
      hint = ' — Check TEST_USER_* credentials in .env.test match your Supabase project.';
    } else if (res.status === 0 || res.status > 500) {
      hint = ' — Supabase unreachable. Check NEXT_PUBLIC_SUPABASE_URL in .env.test.';
    }
    throw new Error(
      `[auth.setup] Supabase signIn failed for ${email}: HTTP ${res.status}${hint} Response: ${body.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
}

setup.describe('Authentication Setup', () => {
  // Validate env once before all auth tests
  setup.beforeAll(async () => {
    validateEnv();
  });

  // Ensure app is reachable before trying to authenticate
  setup.beforeEach(async () => {
    const baseUrl = process.env.TEST_BASE_URL!;
    await waitForApp(baseUrl);
  });

  for (const user of testUsers) {
    setup(`authenticate ${user.type} - ${user.tier}`, async ({ page, context }) => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      // 1. Get session tokens from Supabase API (no UI)
      const session = await getSession(supabaseUrl, anonKey, user.email, user.password);

      // 2. Inject tokens into localStorage before any page JS runs.
      //    Supabase browser client reads 'sb-access-token' and 'sb-refresh-token'.
      const injectScript = `
        try {
          localStorage.setItem('sb-access-token', ${JSON.stringify(session.access_token)});
          localStorage.setItem('sb-refresh-token', ${JSON.stringify(session.refresh_token)});
        } catch (e) {
          console.error('[auth.setup] localStorage inject failed:', e);
        }
      `;
      await context.addInitScript(injectScript);

      // 3. Navigate to app — Supabase client finds tokens and restores session.
      //    waitUntil: 'networkidle' ensures session fetch completes before saving state.
      await page.goto('/', { waitUntil: 'networkidle' });

      // 4. Save authenticated storage state for dependent test projects
      await context.storageState({ path: user.storageState });
    });
  }
});

// Default auth — FREE tier, used by chromium/firefox/webkit projects via storageState
setup('authenticate default user', async ({ page, context }) => {
  const defaultUser = testUsers[0];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const session = await getSession(supabaseUrl, anonKey, defaultUser.email, defaultUser.password);

  const injectScript = `
    try {
      localStorage.setItem('sb-access-token', ${JSON.stringify(session.access_token)});
      localStorage.setItem('sb-refresh-token', ${JSON.stringify(session.refresh_token)});
    } catch (e) {
      console.error('[auth.setup] localStorage inject failed:', e);
    }
  `;
  await context.addInitScript(injectScript);

  await page.goto('/', { waitUntil: 'networkidle' });

  await context.storageState({ path: 'playwright/.auth/user.json' });
});
