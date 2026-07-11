'use strict';
const { chromium } = require('./node_modules/playwright');
const { execSync, spawn } = require('child_process');
const BASE = 'http://127.0.0.1:3100';
const PREFIX = 'INU';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── detail page: list → click Danny → verify tabs ────────────────────────
  console.log('=== detail ===');
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await c2.newPage();
  p2.addInitScript(() => { window.__lcp=0; try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})}catch(_){} });
  const t1 = Date.now();
  await p2.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p2.waitForSelector('#root > *', { timeout: 15000 });
  await p2.waitForTimeout(800);
  await p2.goto(`${BASE}/${PREFIX}/humans`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await p2.waitForTimeout(1500);
  console.log('list:', p2.url());
  try {
    await p2.locator('text=Danny').first().waitFor({ state: 'visible', timeout: 8000 });
    await p2.locator('text=Danny').first().click();
    await p2.waitForTimeout(2000);
    console.log('detail:', p2.url());
  } catch(e) { console.log('Danny click failed:', e.message); }
  const lcp2 = await p2.evaluate(() => window.__lcp) || (Date.now()-t1);
  console.log('LCP:', Math.round(lcp2)+'ms', lcp2<2500?'PASS':'FAIL');
  const ov = await p2.locator('[role="tab"]').filter({hasText:'Overview'}).first().isVisible().catch(()=>false);
  const ac = await p2.locator('[role="tab"]').filter({hasText:'Activity'}).first().isVisible().catch(()=>false);
  console.log('Overview tab:', ov?'PASS':'FAIL');
  console.log('Activity tab:', ac?'PASS':'FAIL');
  await p2.screenshot({ path: '/tmp/inu43-final-detail.png' });
  if (ac) { await p2.locator('[role="tab"]').filter({hasText:'Activity'}).first().click(); await p2.waitForTimeout(2500); }
  const rows = await p2.locator('ul > li').count().catch(()=>0);
  const chipN = await p2.locator('[role="status"]').first().isVisible().catch(()=>false);
  console.log('Activity rows:', rows, rows>0?'PASS':'WARN');
  console.log('Chip normal (should hide):', !chipN?'PASS':'UNEXPECTED visible='+chipN);
  await p2.screenshot({ path: '/tmp/inu43-final-activity.png' });
  await c2.close();

  // ── degraded chip ─────────────────────────────────────────────────────────
  console.log('=== degraded ===');
  try { const p=execSync("lsof -nP -iTCP:3201 -sTCP:LISTEN 2>/dev/null|awk 'NR>1{print $2}'").toString().trim(); if(p){process.kill(parseInt(p));console.log('killed',p);} } catch(_){}
  await new Promise(r=>setTimeout(r,500));
  const bd = spawn('node',['--env-file=../../.env','dist/index.js'],{
    cwd:'/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge',
    env:{...process.env,PAPERCLIP_BASE_URL:'http://127.0.0.1:9999'},stdio:'pipe'});
  await new Promise(r=>setTimeout(r,2000));
  const c3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p3 = await c3.newPage();
  await p3.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p3.waitForSelector('#root > *', { timeout: 15000 });
  await p3.waitForTimeout(800);
  await p3.goto(`${BASE}/${PREFIX}/humans`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await p3.waitForTimeout(1500);
  try { await p3.locator('text=Danny').first().click(); await p3.waitForTimeout(1500); console.log('deg URL:', p3.url()); } catch(e){console.log('Danny fail:',e.message);}
  try {
    const at = p3.locator('[role="tab"]').filter({hasText:'Activity'}).first();
    await at.waitFor({ state:'visible', timeout:8000 });
    await at.click();
    await p3.waitForTimeout(4200);
  } catch(e) { console.log('Activity tab fail:', e.message); }
  const chipD = await p3.locator('[role="status"]').first().isVisible().catch(()=>false);
  const chipT = await p3.locator('[role="status"]').first().innerText().catch(()=>'');
  console.log('Degraded chip:', chipD?'PASS':'FAIL', 'visible='+chipD);
  if(chipT) console.log('Chip text:', JSON.stringify(chipT.trim()));
  await p3.screenshot({ path: '/tmp/inu43-final-degraded.png' });
  await c3.close();
  bd.kill();
  spawn('node',['--env-file=../../.env','dist/index.js'],{cwd:'/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge',stdio:'pipe',detached:true}).unref();
  await browser.close();
  console.log('done');
})();
