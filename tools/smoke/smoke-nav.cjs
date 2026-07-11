const { chromium } = require('./node_modules/playwright');

const BASE = 'http://127.0.0.1:3100';
const PREFIX = 'INU';
const DANNY_ID = 'd23ab23e-0587-4fae-9dc8-159ba248dcd5';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Start at dashboard to warm up the app
  await page.goto(`${BASE}/${PREFIX}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  console.log(`Dashboard body: ${(await page.innerText('body').catch(() => '')).slice(0, 200)}`);

  // Check People nav item exists
  const peopleNav = page.locator('a[href*="humans"], text=People, [aria-label*="People"]').first();
  const peopleVisible = await peopleNav.isVisible().catch(() => false);
  console.log(`People nav item visible: ${peopleVisible}`);
  
  // Click People
  if (peopleVisible) {
    await peopleNav.click();
    await page.waitForTimeout(1500);
  } else {
    await page.goto(`${BASE}/${PREFIX}/humans`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
  }
  
  console.log(`Current URL: ${page.url()}`);
  const humanBodyText = await page.innerText('body').catch(() => '');
  console.log(`/humans body text: ${humanBodyText.slice(0, 600)}`);
  
  await page.screenshot({ path: '/tmp/smoke-humans-list2.png', fullPage: false });
  console.log('[screenshot] /tmp/smoke-humans-list2.png');
  
  // Check Danny
  const dannyEl = await page.locator('text=Danny').first().isVisible().catch(() => false);
  console.log(`Danny visible: ${dannyEl}`);
  
  // Click Danny row
  if (dannyEl) {
    await page.locator('text=Danny').first().click();
    await page.waitForTimeout(1500);
    console.log(`After click URL: ${page.url()}`);
    const detailText = await page.innerText('body').catch(() => '');
    console.log(`Detail body: ${detailText.slice(0, 600)}`);
    await page.screenshot({ path: '/tmp/smoke-humans-detail2.png', fullPage: false });
    console.log('[screenshot] /tmp/smoke-humans-detail2.png');
  }
  
  await browser.close();
})();
