const { chromium } = require('./node_modules/playwright');

const BASE = 'http://127.0.0.1:3100';
const PREFIX = 'INU';
const DANNY_ID = 'd23ab23e-0587-4fae-9dc8-159ba248dcd5';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Navigate to root first so SPA initializes properly
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  const rootUrl = page.url();
  const rootText = await page.innerText('body').catch(() => '');
  console.log(`Root URL: ${rootUrl}`);
  console.log(`Root text: ${rootText.slice(0, 300)}`);

  // Now use SPA routing (not full reload) to navigate to /humans
  await page.evaluate((url) => { window.history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); }, `/${PREFIX}/humans`);
  await page.waitForTimeout(2000);
  const humansText = await page.innerText('body').catch(() => '');
  console.log(`\n/humans (client nav) text: ${humansText.slice(0, 500)}`);
  await page.screenshot({ path: '/tmp/smoke-humans-spanav.png', fullPage: false });

  // Alternative: use React Router's navigate. Try clicking the link if it exists
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  
  // Check if People link exists anywhere in the page
  const allLinks = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href + ' | ' + a.textContent?.trim().slice(0, 30)).slice(0, 50));
  console.log('\nAll links:', allLinks.join('\n'));
  
  await browser.close();
})();
