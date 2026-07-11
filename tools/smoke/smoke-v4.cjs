'use strict';
// Boot from root, pushState to /INU/humans (works), click Danny for detail
const { chromium } = require('./node_modules/playwright');
const { execSync, spawn } = require('child_process');
const BASE   = 'http://127.0.0.1:3100';
const PREFIX = 'INU';

async function bootAndNavigate(page, targetPath) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#root > *', { timeout: 15000 });
  await page.waitForTimeout(1500); // let router settle on /INU/dashboard
  // Client-side navigate: pushState + dispatch popstate on window
  await page.evaluate((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, targetPath);
  await page.waitForTimeout(2500);
  return page.url();
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── Part 1: list page + Danny detail ─────────────────────────────────────
  console.log('=== list → detail ===');
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await c2.newPage();
  p2.addInitScript(() => {
    window.__lcp=0;
    try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})}catch(_){}
  });
  const t0 = Date.now();
  const listUrl = await bootAndNavigate(p2, `/${PREFIX}/humans`);
  console.log('list URL:', listUrl);
  let lcpList, dannyOk=false;
  try {
    await p2.waitForSelector('text=Danny', { timeout: 8000 });
    dannyOk = true;
    lcpList = await p2.evaluate(() => window.__lcp) || (Date.now()-t0);
    console.log('Danny:', 'PASS');
    console.log('LCP list:', Math.round(lcpList)+'ms', lcpList<2500?'PASS':'FAIL');
  } catch(e) {
    const body = await p2.innerText('body').catch(()=>'');
    console.log('Danny: FAIL, body:', body.slice(0,200));
  }
  const ghLink = await p2.locator('a[href*="github"]').first().isVisible().catch(()=>false);
  console.log('GitHub link:', ghLink?'PASS':'FAIL');
  await p2.screenshot({ path: '/tmp/smoke-v4-list.png' });

  // Click Danny → detail page
  if (dannyOk) {
    const t1 = Date.now();
    await p2.locator('text=Danny').first().click();
    await p2.waitForTimeout(2500);
    const detailUrl = p2.url();
    console.log('detail URL:', detailUrl);
    const lcpDetail = await p2.evaluate(() => window.__lcp) || (Date.now()-t1);
    console.log('LCP detail:', Math.round(lcpDetail)+'ms', lcpDetail<2500?'PASS':'FAIL');
    const ov = await p2.locator('[role="tab"]').filter({hasText:'Overview'}).first().isVisible().catch(()=>false);
    const ac = await p2.locator('[role="tab"]').filter({hasText:'Activity'}).first().isVisible().catch(()=>false);
    console.log('Overview tab:', ov?'PASS':'FAIL');
    console.log('Activity tab:', ac?'PASS':'FAIL');
    await p2.screenshot({ path: '/tmp/smoke-v4-detail-ov.png' });
    if (ac) {
      await p2.locator('[role="tab"]').filter({hasText:'Activity'}).first().click();
      await p2.waitForTimeout(2500);
      const rows = await p2.locator('ul > li').count().catch(()=>0);
      const chipN = await p2.locator('[role="status"]').first().isVisible().catch(()=>false);
      console.log('Activity rows:', rows, rows>0?'PASS':'WARN');
      console.log('Chip normal mode:', chipN?'UNEXPECTED visible':'PASS hidden');
      await p2.screenshot({ path: '/tmp/smoke-v4-detail-ac.png' });
    }
  }
  await c2.close();

  // ── Part 2: degraded chip ─────────────────────────────────────────────────
  console.log('\n=== degraded chip ===');
  try { const p=execSync("lsof -nP -iTCP:3201 -sTCP:LISTEN 2>/dev/null|awk 'NR>1{print $2}'").toString().trim(); if(p){process.kill(parseInt(p));console.log('killed bridge',p);} } catch(_){}
  await new Promise(r=>setTimeout(r,500));
  const bd = spawn('node',['--env-file=../../.env','dist/index.js'],{
    cwd:'/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge',
    env:{...process.env,PAPERCLIP_BASE_URL:'http://127.0.0.1:9999'},stdio:'pipe'});
  await new Promise(r=>setTimeout(r,2000));

  const c3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p3 = await c3.newPage();
  const listUrl3 = await bootAndNavigate(p3, `/${PREFIX}/humans`);
  console.log('deg list URL:', listUrl3);
  try {
    await p3.waitForSelector('text=Danny', { timeout: 8000 });
    await p3.locator('text=Danny').first().click();
    await p3.waitForTimeout(1500);
    console.log('deg detail URL:', p3.url());
  } catch(e) { console.log('Danny fail:', e.message); }
  try {
    await p3.locator('[role="tab"]').filter({hasText:'Activity'}).first().waitFor({state:'visible',timeout:8000});
    await p3.locator('[role="tab"]').filter({hasText:'Activity'}).first().click();
    await p3.waitForTimeout(4500); // 3s race + 1.5s buffer
  } catch(e) { console.log('Activity tab:', e.message); }
  const chipD = await p3.locator('[role="status"]').first().isVisible().catch(()=>false);
  const chipT = await p3.locator('[role="status"]').first().innerText().catch(()=>'');
  console.log('Degraded chip:', chipD?'PASS':'FAIL');
  if(chipT) console.log('Chip text:', JSON.stringify(chipT.trim()));
  await p3.screenshot({ path: '/tmp/smoke-v4-degraded.png' });
  await c3.close();
  bd.kill();
  spawn('node',['--env-file=../../.env','dist/index.js'],{cwd:'/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge',stdio:'pipe',detached:true}).unref();
  await browser.close();
  console.log('done');
})();
