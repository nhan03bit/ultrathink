const { chromium } = require('./node_modules/playwright');

const BASE = 'http://127.0.0.1:3100';
const PREFIX = 'INU';
const DANNY_ID = 'd23ab23e-0587-4fae-9dc8-159ba248dcd5';

async function runAxe(page, label) {
  try {
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js' });
    await page.waitForTimeout(800);
    const results = await page.evaluate(async () => {
      return await axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    });
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    console.log(`[axe] ${label}: ${results.violations.length} total, ${serious.length} serious/critical ${serious.length===0?'PASS':'FAIL'}`);
    if (serious.length > 0) serious.forEach(v => console.log(`  [${v.impact}] ${v.id}: ${v.description}`));
    return { total: results.violations.length, sc: serious.length };
  } catch(e) {
    console.log(`[axe] ${label}: ERROR ${e.message}`);
    return { total: -1, sc: -1 };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ===== /humans list page =====
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await p1.addInitScript(() => {
    window.__lcp = null;
    try { new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true}); }catch(_){}
  });
  const t0 = Date.now();
  await p1.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await p1.waitForTimeout(1500);
  await p1.goto(`${BASE}/${PREFIX}/humans`, { waitUntil: 'networkidle', timeout: 15000 });
  await p1.waitForTimeout(2000);
  const lcp1 = await p1.evaluate(() => window.__lcp) || (Date.now() - t0);

  const text1 = await p1.innerText('body').catch(() => '');
  console.log('\n=== /humans (list) ===');
  console.log(`[LCP] ${Math.round(lcp1)}ms ${lcp1 < 2500 ? 'PASS' : 'FAIL'}`);
  
  // Look for People in sidebar
  const peopleLink = await p1.locator('a[href*="humans"], text=People').first().isVisible().catch(() => false);
  console.log(`[People sidebar] ${peopleLink ? 'PASS' : 'FAIL'}`);
  
  const dannyVisible = await p1.locator('text=Danny').first().isVisible().catch(() => false);
  console.log(`[Danny row] ${dannyVisible ? 'PASS' : 'FAIL — checking body...'}`);
  if (!dannyVisible) console.log(`  body snippet: ${text1.slice(0, 300)}`);
  
  const githubLink = await p1.locator('a[href*="github"]').first().isVisible().catch(() => false);
  console.log(`[GitHub link] ${githubLink ? 'PASS' : 'FAIL'}`);
  
  await p1.screenshot({ path: '/tmp/smoke-3100-list.png', fullPage: false });
  const axe1 = await runAxe(p1, '/humans');
  await ctx1.close();

  // ===== /humans/:id detail =====
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.addInitScript(() => {
    window.__lcp = null;
    try { new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true}); }catch(_){}
  });
  const t1 = Date.now();
  await p2.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await p2.waitForTimeout(1500);
  await p2.goto(`${BASE}/${PREFIX}/humans/${DANNY_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
  await p2.waitForTimeout(2000);
  const lcp2 = await p2.evaluate(() => window.__lcp) || (Date.now() - t1);

  console.log(`\n=== /humans/:id (detail) ===`);
  console.log(`[LCP] ${Math.round(lcp2)}ms ${lcp2 < 2500 ? 'PASS' : 'FAIL'}`);

  const overviewTab = await p2.locator('[role="tab"]').filter({hasText:'Overview'}).first().isVisible().catch(() => false);
  console.log(`[Overview tab] ${overviewTab ? 'PASS' : 'FAIL'}`);
  await p2.screenshot({ path: '/tmp/smoke-3100-detail-overview.png', fullPage: false });

  // Click Activity
  const actTab = p2.locator('[role="tab"]').filter({hasText:'Activity'}).first();
  if (await actTab.isVisible().catch(() => false)) {
    await actTab.click();
    await p2.waitForTimeout(2000);
    console.log('[ui] Clicked Activity tab');
  }
  const liCount = await p2.locator('ul > li').count().catch(() => 0);
  const chipNormal = await p2.locator('[role="status"]').first().isVisible().catch(() => false);
  console.log(`[Activity events] ${liCount} rows ${liCount > 0 ? 'PASS' : 'WARN'}`);
  console.log(`[Chip normal mode] visible=${chipNormal} ${!chipNormal ? 'PASS hidden' : 'UNEXPECTED'}`);
  await p2.screenshot({ path: '/tmp/smoke-3100-activity.png', fullPage: false });
  const axe2 = await runAxe(p2, '/humans/:id');
  await ctx2.close();

  // ===== Degraded mode chip (dead bridge) =====
  const { execSync, spawn } = require('child_process');
  const bpid = execSync("lsof -nP -iTCP:3201 -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}'").toString().trim();
  if (bpid) try { process.kill(parseInt(bpid)); } catch(_) {}
  await new Promise(r => setTimeout(r, 500));
  const bc = spawn('node', ['--env-file=../../.env', 'dist/index.js'],
    { cwd: '/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge',
      env: { ...process.env, PAPERCLIP_BASE_URL: 'http://127.0.0.1:9999' }, stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 1800));

  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  await p3.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await p3.waitForTimeout(1500);
  await p3.goto(`${BASE}/${PREFIX}/humans/${DANNY_ID}`, { waitUntil: 'networkidle', timeout: 15000 });
  await p3.waitForTimeout(1500);
  const at3 = p3.locator('[role="tab"]').filter({hasText:'Activity'}).first();
  if (await at3.isVisible().catch(()=>false)) {
    await at3.click();
    await p3.waitForTimeout(2500);
  }
  const chipDeg = await p3.locator('[role="status"]').first().isVisible().catch(() => false);
  const chipText = await p3.locator('[role="status"]').first().innerText().catch(() => '');
  console.log(`\n[Degraded chip] visible=${chipDeg} ${chipDeg ? 'PASS' : 'FAIL'}`);
  if (chipText) console.log(`[Chip text] "${chipText.trim()}"`);
  await p3.screenshot({ path: '/tmp/smoke-3100-degraded.png', fullPage: false });
  await ctx3.close();
  bc.kill();
  spawn('node', ['--env-file=../../.env', 'dist/index.js'],
    { cwd: '/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge',
      stdio: 'pipe', detached: true }).unref();

  console.log('\n========== FINAL SUMMARY ==========');
  console.log(`LCP /humans:     ${Math.round(lcp1)}ms ${lcp1<2500?'PASS':'FAIL'}`);
  console.log(`LCP /humans/:id: ${Math.round(lcp2)}ms ${lcp2<2500?'PASS':'FAIL'}`);
  console.log(`axe /humans:     ${axe1.sc} serious/critical ${axe1.sc===0?'PASS':'FAIL'}`);
  console.log(`axe /humans/:id: ${axe2.sc} serious/critical ${axe2.sc===0?'PASS':'FAIL'}`);
  console.log(`Degraded chip:   ${chipDeg?'PASS':'FAIL'}`);
  await browser.close();
})();
