const { chromium } = require('./node_modules/playwright');

const BASE = 'http://127.0.0.1:3100';
const DANNY_ID = 'd23ab23e-0587-4fae-9dc8-159ba248dcd5';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  
  // Go to root first, wait for app to load
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  const rootTitle = await page.title();
  const rootUrl = page.url();
  console.log(`Root loaded: ${rootUrl} - title: ${rootTitle}`);
  
  // Check if redirected to login
  const loginVisible = await page.locator('input[type=password], input[name=password], text=Sign in, text=Login').first().isVisible().catch(() => false);
  console.log(`Login visible: ${loginVisible}`);
  
  // Get all visible text
  const bodyText = await page.innerText('body').catch(() => '');
  console.log(`Body text (first 500): ${bodyText.slice(0, 500)}`);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/smoke-root.png' });
  
  // Now try /humans
  await page.goto(`${BASE}/humans`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2000);
  const humansUrl = page.url();
  const humansText = await page.innerText('body').catch(() => '');
  console.log(`\n/humans url: ${humansUrl}`);
  console.log(`/humans body text (first 500): ${humansText.slice(0, 500)}`);
  await page.screenshot({ path: '/tmp/smoke-humans-check.png' });
  
  await browser.close();
})();
