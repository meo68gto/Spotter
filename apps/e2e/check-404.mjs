import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3000/nonexistent', { timeout: 10000, waitUntil: 'networkidle' });
await page.screenshot({ path: 'test-results/screenshot-404-nonexistent.png', fullPage: false });
const bodyText = await page.locator('body').innerText();
console.log('404 page text:', bodyText.slice(0, 200));
await browser.close();
