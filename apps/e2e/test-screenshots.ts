import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results: Record<string, { status: number; title: string; hasContent: boolean }> = {};
  
  const pages = [
    { url: '/login', name: 'Login Page' },
    { url: '/dashboard', name: 'Dashboard' },
    { url: '/discovery', name: 'Discovery' },
    { url: '/connections', name: 'Connections' },
    { url: '/rounds', name: 'Rounds' },
    { url: '/profile', name: 'Profile' },
    { url: '/coaching', name: 'Coaching' },
    { url: '/settings', name: 'Settings' },
    { url: '/organizer', name: 'Operator Portal' },
    { url: '/organizer/dashboard', name: 'Operator Dashboard' },
    { url: '/organizer/members', name: 'Operator Members' },
    { url: '/organizer/sponsors', name: 'Operator Sponsors' },
    { url: '/organizer/tournaments', name: 'Operator Tournaments' },
    { url: '/organizer/analytics', name: 'Operator Analytics' },
    { url: '/organizer/settings', name: 'Operator Settings' },
    { url: '/nonexistent', name: '404 Page' },
  ];
  
  for (const { url, name } of pages) {
    try {
      const response = await page.goto(`http://localhost:3000${url}`, { timeout: 10000 });
      await page.waitForLoadState('domcontentloaded');
      const title = await page.title();
      const bodyText = await page.locator('body').innerText();
      results[name] = {
        status: response?.status() || 0,
        title,
        hasContent: bodyText.length > 50,
      };
      await page.screenshot({ path: `test-results/${name.replace(/\s+/g, '-').toLowerCase()}.png`, fullPage: true });
    } catch (e: any) {
      results[name] = { status: 0, title: e.message, hasContent: false };
      await page.screenshot({ path: `test-results/${name.replace(/\s+/g, '-').toLowerCase()}.png`, fullPage: true }).catch(() => {});
    }
  }
  
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch(console.error);
