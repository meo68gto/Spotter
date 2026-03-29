import { chromium } from 'playwright';

const PAGES = [
  ['/(operator)/dashboard', '(Op) Dashboard'],
  ['/(operator)/members', '(Op) Members'],
  ['/(operator)/sponsors', '(Op) Sponsors'],
  ['/(operator)/sponsors/new', '(Op) Sponsor New'],
  ['/(operator)/tournaments', '(Op) Tournaments'],
  ['/(operator)/analytics', '(Op) Analytics'],
  ['/(operator)/settings', '(Op) Settings'],
  ['/(operator)/settings/stripe', '(Op) Stripe Settings'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

for (const [path, label] of PAGES) {
  try {
    const resp = await page.goto(`http://localhost:3000${path}`, { timeout: 15000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const title = await page.title();
    const h1 = await page.locator('h1').first().innerText().catch(() => '(no h1)');
    const status = resp?.status() || 0;
    const filename = `test-results/screenshot-${label.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`✓ ${label} (${status}) h1="${h1}"`);
  } catch(e) {
    console.log(`✗ ${label}: ${e.message.slice(0, 80)}`);
    const filename = `test-results/screenshot-${label.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.png`;
    await page.screenshot({ path: filename, fullPage: false }).catch(() => {});
  }
}

await browser.close();
