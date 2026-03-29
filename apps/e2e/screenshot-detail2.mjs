import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// More operator pages that returned 200
const pages = [
  '/organizer',
  '/organizer/members',
  '/organizer/analytics',
  '/organizer/settings',
  '/organizer/tournaments',
  '/organizer/events',
  '/organizer/financials',
  '/organizer/invoices',
  '/organizer/contests',
  '/organizer/waitlist',
  '/organizer/events/create',
];

for (const path of pages) {
  try {
    const resp = await page.goto(`http://localhost:3000${path}`, { timeout: 10000, waitUntil: 'networkidle' });
    const status = resp?.status() || 0;
    const h1s = await page.locator('h1').allInnerTexts();
    const bodyText = await page.locator('body').innerText();
    const snippet = bodyText.slice(0, 150).replace(/\n+/g, ' | ');
    console.log(`\n[${status}] ${path} | h1s: ${JSON.stringify(h1s)}`);
    console.log(`  ${snippet}`);
  } catch(e) {
    console.log(`\n[ERR] ${path}: ${e.message.slice(0, 100)}`);
  }
}

await browser.close();
