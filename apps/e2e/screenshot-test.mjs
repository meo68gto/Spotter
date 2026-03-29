import { chromium } from 'playwright';

const PAGES = [
  ['/', 'Root'],
  ['/organizer', 'Operator Portal'],
  ['/organizer/dashboard', 'Operator Dashboard'],
  ['/organizer/members', 'Operator Members'],
  ['/organizer/sponsors', 'Operator Sponsors'],
  ['/organizer/tournaments', 'Operator Tournaments'],
  ['/organizer/analytics', 'Operator Analytics'],
  ['/organizer/settings', 'Operator Settings'],
  ['/organizer/sponsors/new', 'Sponsor New'],
  ['/login', 'Login'],
  ['/dashboard', 'Dashboard'],
  ['/discovery', 'Discovery'],
  ['/connections', 'Connections'],
  ['/rounds', 'Rounds'],
  ['/profile', 'Profile'],
  ['/coaching', 'Coaching'],
  ['/settings', 'Settings'],
  ['/auth/callback', 'Auth Callback'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const results = {};
for (const [path, label] of PAGES) {
  try {
    const resp = await page.goto(`http://localhost:3000${path}`, { timeout: 15000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const title = await page.title();
    const h1 = await page.locator('h1').first().innerText().catch(() => '(no h1)');
    const status = resp?.status() || 0;
    results[label] = { status, title, h1, path };
    const filename = `test-results/screenshot-${label.toLowerCase().replace(/\s+/g, '-')}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`✓ ${label} (${status})`);
  } catch(e) {
    results[label] = { error: e.message, path };
    const filename = `test-results/screenshot-${label.toLowerCase().replace(/\s+/g, '-')}.png`;
    await page.screenshot({ path: filename, fullPage: false }).catch(() => {});
    console.log(`✗ ${label}: ${e.message.slice(0, 80)}`);
  }
}

console.log('\n--- SUMMARY ---');
console.log(JSON.stringify(results, null, 2));
await browser.close();
