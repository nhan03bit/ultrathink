const { chromium } = require('./node_modules/playwright');
const BASE = 'http://127.0.0.1:3100';
const PREFIX = 'INU';
const DANNY_ID = 'd23ab23e-0587-4fae-9dc8-159ba248dcd5';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Exactly match the working smoke-check-ui approach
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  const url1 = page.url();
  const text1 = await page.innerText('body').catch(() => '');
  console.log(`After root nav: ${url1}`);
  console.log(`Text: ${text1.slice(0, 200)}`);
  await page.screenshot({ path: '/tmp/s1.png' });
  
  // Now SPA navigate to /INU/humans
  // Use page.click on People link if exists, else direct goto
  const peopleEl = await page.locator('text=People').first();
  const hasPeople = await peopleEl.isVisible().catch(() => false);
  console.log(`Has People nav: ${hasPeople}`);
  
  if (hasPeople) {
    await peopleEl.click();
    await page.waitForTimeout(2000);
  } else {
    // Navigate using client-side routing
    await page.evaluate((url) => { history.pushState({}, '', url); window.dispatchEvent(new Event('popstate')); }, `/${PREFIX}/humans`);
    await page.waitForTimeout(2000);
  }
  console.log(`After nav: ${page.url()}`);
  const text2 = await page.innerText('body').catch(() => '');
  console.log(`/humans text: ${text2.slice(0, 400)}`);
  await page.screenshot({ path: '/tmp/s2.png' });

  await browser.close();
})();
