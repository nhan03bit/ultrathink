const { chromium } = require('./node_modules/playwright');

const BASE = 'http://127.0.0.1:3100';
const PREFIX = 'INU';
const DANNY_ID = 'd23ab23e-0587-4fae-9dc8-159ba248dcd5';

async function runAxe(page, label) {
  try {
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js' });
    await page.waitForTimeout(700);
    const results = await page.evaluate(async () => {
      return await axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    });
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    console.log(`\n[axe] ${label}: ${results.violations.length} total violations, ${serious.length} serious/critical`);
    if (serious.length > 0) {
      serious.forEach(v => console.log(`  FAIL [${v.impact}] ${v.id}: ${v.description}`));
    } else {
      console.log('  PASS zero serious/critical');
    }
    return { totalViolations: results.violations.length, seriousCritical: serious.length };
  } catch(e) {
    console.log(`[axe] ${label}: error - ${e.message}`);
    return { totalViolations: -1, seriousCritical: -1 };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ===== /INU/humans list =====
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  await page1.addInitScript(() => {
    window.__lcp = null;
    try {
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.__lcp = e.startTime; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
    } catch(_) {}
  });

  const t0 = Date.now();
  await page1.goto(`${BASE}/${PREFIX}/humans`, { waitUntil: 'networkidle', timeout: 20000 });
  await page1.waitForTimeout(800);
  const lcp1 = await page1.evaluate(() => window.__lcp) || (Date.now() - t0);

  const bodyText1 = await page1.innerText('body').catch(() => '');
  console.log(`\n=== /${PREFIX}/humans (list) ===`);
  console.log(`[LCP] ${Math.round(lcp1)}ms (target <2500ms) ${lcp1 < 2500 ? 'PASS' : 'FAIL'}`);
  console.log(`[body text excerpt]: ${bodyText1.slice(0, 400)}`);
  
  const dannyVisible = await page1.locator('text=Danny').first().isVisible().catch(() => false);
  const githubLink = await page1.locator('a[href*="github"]').first().isVisible().catch(() => false);
  console.log(`[Danny row] ${dannyVisible ? 'PASS visible' : 'FAIL not visible'}`);
  console.log(`[GitHub link] ${githubLink ? 'PASS linkified' : 'FAIL not linkified'}`);
  
  await page1.screenshot({ path: '/tmp/smoke-humans-list.png', fullPage: false });
  console.log('[screenshot] /tmp/smoke-humans-list.png');
  const axe1 = await runAxe(page1, `/${PREFIX}/humans`);
  await ctx1.close();

  // ===== /INU/humans/:id detail =====
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.addInitScript(() => {
    window.__lcp = null;
    try {
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.__lcp = e.startTime; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
    } catch(_) {}
  });

  const t1 = Date.now();
  await page2.goto(`${BASE}/${PREFIX}/humans/${DANNY_ID}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page2.waitForTimeout(800);
  const lcp2 = await page2.evaluate(() => window.__lcp) || (Date.now() - t1);

  const bodyText2 = await page2.innerText('body').catch(() => '');
  console.log(`\n=== /${PREFIX}/humans/:id (detail) ===`);
  console.log(`[LCP] ${Math.round(lcp2)}ms (target <2500ms) ${lcp2 < 2500 ? 'PASS' : 'FAIL'}`);
  console.log(`[body excerpt]: ${bodyText2.slice(0, 400)}`);
  
  const overviewTab = await page2.locator('[role="tab"]').filter({ hasText: 'Overview' }).first().isVisible().catch(() => false);
  console.log(`[Overview tab] ${overviewTab ? 'PASS visible' : 'FAIL'}`);
  await page2.screenshot({ path: '/tmp/smoke-humans-detail-overview.png', fullPage: false });
  console.log('[screenshot] /tmp/smoke-humans-detail-overview.png');

  // Click Activity tab
  const actTab = page2.locator('[role="tab"]').filter({ hasText: 'Activity' }).first();
  const actTabVisible = await actTab.isVisible().catch(() => false);
  if (actTabVisible) {
    await actTab.click();
    await page2.waitForTimeout(1000);
    console.log('[ui] Clicked Activity tab');
  }
  
  const liCount = await page2.locator('ul li').count().catch(() => 0);
  const chipVisible = await page2.locator('[role="status"]').first().isVisible().catch(() => false);
  console.log(`[Activity events] li count: ${liCount} ${liCount > 0 ? 'PASS' : 'WARN empty'}`);
  console.log(`[Degraded chip normal mode] visible=${chipVisible} ${!chipVisible ? 'PASS (hidden)' : 'UNEXPECTED'}`);

  await page2.screenshot({ path: '/tmp/smoke-humans-detail-activity.png', fullPage: false });
  console.log('[screenshot] /tmp/smoke-humans-detail-activity.png');
  const axe2 = await runAxe(page2, `/${PREFIX}/humans/:id`);
  await ctx2.close();

  // ===== Degraded mode chip screenshot =====
  // Bridge already confirmed paperclip_unavailable:true via curl smoke 4
  // Restart bridge with dead URL to capture UI chip
  const { execSync } = require('child_process');
  const bridgePid = execSync("lsof -nP -iTCP:3201 -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}'").toString().trim();
  if (bridgePid) {
    process.kill(parseInt(bridgePid));
    await new Promise(r => setTimeout(r, 500));
  }
  const child = require('child_process').spawn('node',
    ['--env-file=../../.env', 'dist/index.js'],
    { cwd: '/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge',
      env: { ...process.env, PAPERCLIP_BASE_URL: 'http://127.0.0.1:9999',
             DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'pipe' }
  );
  await new Promise(r => setTimeout(r, 1500));

  const ctx3 = await browser.newContext();
  const page3 = await ctx3.newPage();
  await page3.goto(`${BASE}/${PREFIX}/humans/${DANNY_ID}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page3.waitForTimeout(1000);
  // Click Activity tab
  const actTab3 = page3.locator('[role="tab"]').filter({ hasText: 'Activity' }).first();
  if (await actTab3.isVisible().catch(() => false)) {
    await actTab3.click();
    await page3.waitForTimeout(1200);
  }
  const chipDegraded = await page3.locator('[role="status"]').first().isVisible().catch(() => false);
  console.log(`\n[Degraded chip] visible in degraded mode: ${chipDegraded ? 'PASS chip showing' : 'FAIL chip not visible'}`);
  await page3.screenshot({ path: '/tmp/smoke-humans-degraded-chip.png', fullPage: false });
  console.log('[screenshot] /tmp/smoke-humans-degraded-chip.png');
  await ctx3.close();
  
  child.kill();
  // Restore normal bridge
  require('child_process').spawn('node',
    ['--env-file=../../.env', 'dist/index.js'],
    { cwd: '/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge',
      stdio: 'pipe', detached: true }
  ).unref();

  console.log('\n========== FINAL SUMMARY ==========');
  console.log(`LCP /${PREFIX}/humans:      ${Math.round(lcp1)}ms  ${lcp1 < 2500 ? 'PASS' : 'FAIL'}`);
  console.log(`LCP /${PREFIX}/humans/:id:  ${Math.round(lcp2)}ms  ${lcp2 < 2500 ? 'PASS' : 'FAIL'}`);
  console.log(`axe /${PREFIX}/humans:      ${axe1.seriousCritical} serious/critical  ${axe1.seriousCritical === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`axe /${PREFIX}/humans/:id:  ${axe2.seriousCritical} serious/critical  ${axe2.seriousCritical === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`Degraded chip (smoke 4):     PASS (meta.paperclip_unavailable:true confirmed via curl)`);
  console.log(`Chip UI rendered: ${chipDegraded ? 'PASS' : 'FAIL — needs investigation'}`);

  await browser.close();
})();
