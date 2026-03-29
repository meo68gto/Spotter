import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Check what the /organizer/members actually shows (it returned 200)
const pages = [
  '/organizer',
  '/organizer/members',
  '/organizer/analytics',
  '/organizer/settings',
];

for (const path of pages) {
  await page.goto(`http://localhost:3000${path}`, { timeout: 15000, waitUntil: 'networkidle' });
  const bodyText = await page.locator('body').innerText();
  const h1s = await page.locator('h1').allInnerTexts();
  const bodySnippet = bodyText.slice(0, 300).replace(/\n+/g, ' | ');
  console.log(`\n=== ${path} ===`);
  console.log(`H1s: ${JSON.stringify(h1s)}`);
  console.log(`Body: ${bodySnippet}`);
}

await browser.close();
