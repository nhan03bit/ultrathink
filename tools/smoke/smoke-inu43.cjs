// INU-43 QA smoke — fixed navigation strategy
// - domcontentloaded (not networkidle) everywhere; SPA keeps WS open so networkidle never fires
// - waitForSelector to confirm content before asserting
// - exact a[href="/INU/humans"] for sidebar nav (avoids matching issue titles)
"use strict";

const { chromium } = require("./node_modules/playwright");
const { execSync, spawn } = require("child_process");

const BASE = "http://127.0.0.1:3100";
const PREFIX = "INU";
const DANNY_ID = "d23ab23e-0587-4fae-9dc8-159ba248dcd5";

const TIMEOUT = { timeout: 20000 };

async function bootSpa(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 });
  // Wait for React root to mount — any element inside #root
  await page.waitForSelector("#root > *", { timeout: 15000 });
  // Give router a beat to resolve the redirect
  await page.waitForTimeout(1500);
}

async function navigateTo(page, href) {
  // Click the exact nav link; if not visible, fall back to evaluate pushState
  const link = page.locator(`a[href="${href}"]`).first();
  try {
    await link.waitFor({ state: "visible", timeout: 5000 });
    await link.click();
  } catch (_) {
    // Sidebar may not be ready yet; use client-side navigate
    await page.evaluate((u) => window.history.pushState({}, "", u), href);
    await page.dispatchEvent("body", "popstate");
  }
  await page.waitForTimeout(2000);
}

async function runAxe(page, label) {
  try {
    await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js" });
    await page.waitForTimeout(600);
    const results = await page.evaluate(async () =>
      axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })
    );
    const sc = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    console.log(
      `[axe] ${label}: ${results.violations.length} total, ${sc.length} serious/critical ${sc.length === 0 ? "PASS" : "FAIL"}`
    );
    sc.forEach((v) => console.log(`  [${v.impact}] ${v.id}: ${v.description}`));
    return sc.length;
  } catch (e) {
    console.log(`[axe] ${label}: ERROR ${e.message}`);
    return -1;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── PHASE 1: /humans list ──────────────────────────────────────────────────
  console.log("\n=== PHASE 1: /humans list ===");
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p1 = await ctx1.newPage();

  await p1.addInitScript(() => {
    window.__lcp = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch (_) {}
  });

  const t0 = Date.now();
  await bootSpa(p1);
  console.log(`[boot] URL after boot: ${p1.url()}`);

  // Navigate via sidebar link
  await navigateTo(p1, `/${PREFIX}/humans`);
  console.log(`[nav]  URL after nav:  ${p1.url()}`);

  // Wait for Danny to appear
  let dannyVisible = false;
  try {
    await p1.waitForSelector("text=Danny", { timeout: 8000 });
    dannyVisible = true;
  } catch (_) {
    const body = await p1.innerText("body").catch(() => "");
    console.log(`[warn] Danny not found, body snippet: ${body.slice(0, 400)}`);
  }

  const lcp1 = (await p1.evaluate(() => window.__lcp)) || Date.now() - t0;
  console.log(`[LCP]  ${Math.round(lcp1)}ms ${lcp1 < 2500 ? "PASS" : "FAIL"}`);
  console.log(`[Danny row] ${dannyVisible ? "PASS" : "FAIL"}`);

  // GitHub link (in the row)
  const ghLink = await p1
    .locator('a[href*="github"]')
    .first()
    .isVisible()
    .catch(() => false);
  console.log(`[GitHub link] ${ghLink ? "PASS" : "FAIL"}`);

  // People sidebar link visible
  const peopleSidebar = await p1
    .locator(`a[href="/${PREFIX}/humans"]`)
    .first()
    .isVisible()
    .catch(() => false);
  console.log(`[People sidebar] ${peopleSidebar ? "PASS" : "FAIL"}`);

  await p1.screenshot({ path: "/tmp/inu43-list.png", fullPage: false });
  const axe1 = await runAxe(p1, "/humans");
  await ctx1.close();

  // ── PHASE 2: /humans/:id — Overview + Activity tabs ───────────────────────
  console.log("\n=== PHASE 2: /humans/:id ===");
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await ctx2.newPage();

  await p2.addInitScript(() => {
    window.__lcp = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch (_) {}
  });

  const t1 = Date.now();
  await bootSpa(p2);
  await navigateTo(p2, `/${PREFIX}/humans/${DANNY_ID}`);
  console.log(`[nav]  URL: ${p2.url()}`);

  let detailLoaded = false;
  try {
    await p2.waitForSelector('[role="tab"]', { timeout: 8000 });
    detailLoaded = true;
  } catch (_) {
    const body = await p2.innerText("body").catch(() => "");
    console.log(`[warn] tabs not found, body: ${body.slice(0, 400)}`);
  }

  const lcp2 = (await p2.evaluate(() => window.__lcp)) || Date.now() - t1;
  console.log(`[LCP]  ${Math.round(lcp2)}ms ${lcp2 < 2500 ? "PASS" : "FAIL"}`);

  const overviewTab = await p2
    .locator('[role="tab"]')
    .filter({ hasText: "Overview" })
    .first()
    .isVisible()
    .catch(() => false);
  const activityTab = await p2
    .locator('[role="tab"]')
    .filter({ hasText: "Activity" })
    .first()
    .isVisible()
    .catch(() => false);
  console.log(`[Overview tab] ${overviewTab ? "PASS" : "FAIL"}`);
  console.log(`[Activity tab] ${activityTab ? "PASS" : "FAIL"}`);

  await p2.screenshot({ path: "/tmp/inu43-detail-overview.png", fullPage: false });

  // Click Activity tab
  if (activityTab) {
    await p2.locator('[role="tab"]').filter({ hasText: "Activity" }).first().click();
    await p2.waitForTimeout(2500);
    console.log("[ui] Activity tab clicked");
  }

  const actRows = await p2
    .locator('ul[class*="timeline"] li, [data-activity] li, ul > li')
    .count()
    .catch(() => 0);
  console.log(`[Activity rows] ${actRows} rows`);

  // chip should NOT appear in normal mode
  const chipNormal = await p2
    .locator('[role="status"]')
    .first()
    .isVisible()
    .catch(() => false);
  console.log(
    `[Chip (normal mode, should be hidden)] visible=${chipNormal} ${!chipNormal ? "PASS" : "UNEXPECTED VISIBLE"}`
  );

  await p2.screenshot({ path: "/tmp/inu43-detail-activity.png", fullPage: false });
  const axe2 = await runAxe(p2, "/humans/:id");
  await ctx2.close();

  // ── PHASE 3: Degraded mode chip ───────────────────────────────────────────
  console.log("\n=== PHASE 3: Degraded-mode chip ===");
  // Kill bridge and restart with dead Paperclip URL
  try {
    const bpid = execSync("lsof -nP -iTCP:3201 -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}'").toString().trim();
    if (bpid) {
      process.kill(parseInt(bpid));
      console.log(`[bridge] killed PID ${bpid}`);
    }
  } catch (_) {}
  await new Promise((r) => setTimeout(r, 600));

  const bridgeDead = spawn("node", ["--env-file=../../.env", "dist/index.js"], {
    cwd: "/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge",
    env: { ...process.env, PAPERCLIP_BASE_URL: "http://127.0.0.1:9999" },
    stdio: "pipe",
  });
  await new Promise((r) => setTimeout(r, 2000)); // wait for bridge to bind

  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p3 = await ctx3.newPage();
  await bootSpa(p3);
  await navigateTo(p3, `/${PREFIX}/humans/${DANNY_ID}`);
  console.log(`[nav] URL: ${p3.url()}`);

  // Click Activity tab
  try {
    const at = p3.locator('[role="tab"]').filter({ hasText: "Activity" }).first();
    await at.waitFor({ state: "visible", timeout: 8000 });
    await at.click();
    await p3.waitForTimeout(3500); // bridge will race-timeout (3s) before returning unavailable
  } catch (e) {
    console.log(`[warn] Activity tab not found in degraded mode: ${e.message}`);
  }

  const chipDeg = await p3
    .locator('[role="status"]')
    .first()
    .isVisible()
    .catch(() => false);
  const chipText = await p3
    .locator('[role="status"]')
    .first()
    .innerText()
    .catch(() => "");
  console.log(`[Degraded chip] visible=${chipDeg} ${chipDeg ? "PASS" : "FAIL"}`);
  if (chipText) console.log(`[Chip text] "${chipText.trim()}"`);

  await p3.screenshot({ path: "/tmp/inu43-degraded-chip.png", fullPage: false });
  await ctx3.close();

  // Restore real bridge
  bridgeDead.kill();
  spawn("node", ["--env-file=../../.env", "dist/index.js"], {
    cwd: "/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge",
    stdio: "pipe",
    detached: true,
  }).unref();

  await browser.close();

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log("\n========== SUMMARY ==========");
  console.log(`LCP /humans:         ${Math.round(lcp1)}ms   ${lcp1 < 2500 ? "PASS" : "FAIL"}`);
  console.log(`LCP /humans/:id:     ${Math.round(lcp2)}ms   ${lcp2 < 2500 ? "PASS" : "FAIL"}`);
  console.log(`Danny row:           ${dannyVisible ? "PASS" : "FAIL"}`);
  console.log(`GitHub link:         ${ghLink ? "PASS" : "FAIL"}`);
  console.log(`Tabs present:        ${detailLoaded ? "PASS" : "FAIL"}`);
  console.log(`axe /humans:         ${axe1 === 0 ? "PASS" : axe1 + " violations FAIL"}`);
  console.log(`axe /humans/:id:     ${axe2 === 0 ? "PASS" : axe2 + " violations FAIL"}`);
  console.log(`Degraded chip:       ${chipDeg ? "PASS" : "FAIL"}`);
})();
