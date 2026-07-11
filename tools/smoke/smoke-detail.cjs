"use strict";
// INU-43 QA — detail page + degraded chip + axe baseline
// Uses goto() only (no pushState) to avoid React Router confusion
const { chromium } = require("./node_modules/playwright");
const { execSync, spawn } = require("child_process");

const BASE = "http://127.0.0.1:3100";
const PREFIX = "INU";
const DANNY_ID = "d23ab23e-0587-4fae-9dc8-159ba248dcd5";

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
    // Print full violation details for attribution
    results.violations.forEach((v) => {
      const node = v.nodes[0];
      console.log(
        `  [detail] ${v.id} | selector: ${node?.target?.[0] ?? "n/a"} | html: ${(node?.html ?? "").slice(0, 120)}`
      );
    });
    return sc.length;
  } catch (e) {
    console.log(`[axe] ${label}: ERROR ${e.message}`);
    return -1;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── axe baseline on /dashboard (pre-existing violations baseline) ──────────
  console.log("\n=== axe BASELINE: /dashboard ===");
  const bctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const bp = await bctx.newPage();
  await bp.goto(`${BASE}/${PREFIX}/dashboard`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await bp.waitForSelector("#root > *", { timeout: 15000 });
  await bp.waitForTimeout(2000);
  const axeBase = await runAxe(bp, "/dashboard");
  await bctx.close();

  // ── /humans/:id detail page ───────────────────────────────────────────────
  console.log("\n=== /humans/:id (detail) ===");
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
  // Boot SPA from root first, then navigate — avoids direct 404 on :3100 for unknown paths
  await p2.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 });
  await p2.waitForSelector("#root > *", { timeout: 15000 });
  await p2.waitForTimeout(1000);
  // Now navigate via React Router using the in-page link from /humans list
  await p2.goto(`${BASE}/${PREFIX}/humans`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p2.waitForTimeout(2000);
  console.log(`[nav] list URL: ${p2.url()}`);

  // Click Danny's row to navigate to the detail page
  const dannyRow = p2.locator("text=Danny").first();
  try {
    await dannyRow.waitFor({ state: "visible", timeout: 8000 });
    await dannyRow.click();
    await p2.waitForTimeout(2500);
    console.log(`[nav] detail URL: ${p2.url()}`);
  } catch (e) {
    console.log(`[warn] Danny row click failed: ${e.message}`);
  }

  const lcp2 = (await p2.evaluate(() => window.__lcp)) || Date.now() - t1;
  console.log(`[LCP]  ${Math.round(lcp2)}ms ${lcp2 < 2500 ? "PASS" : "FAIL"}`);

  // Check tabs
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

  await p2.screenshot({ path: "/tmp/inu43-detail2-overview.png", fullPage: false });

  // Click Activity tab
  if (activityTab) {
    await p2.locator('[role="tab"]').filter({ hasText: "Activity" }).first().click();
    await p2.waitForTimeout(2500);
  }
  const actRows = await p2
    .locator("ul > li")
    .count()
    .catch(() => 0);
  const chipNormal = await p2
    .locator('[role="status"]')
    .first()
    .isVisible()
    .catch(() => false);
  console.log(`[Activity rows] ${actRows} (${actRows > 0 ? "PASS" : "WARN — 0 rows"})`);
  console.log(`[Chip normal mode (should be hidden)] visible=${chipNormal} ${!chipNormal ? "PASS" : "UNEXPECTED"}`);

  await p2.screenshot({ path: "/tmp/inu43-detail2-activity.png", fullPage: false });
  const axe2 = await runAxe(p2, "/humans/:id");
  await ctx2.close();

  // ── Degraded chip (dead Paperclip URL) ───────────────────────────────────
  console.log("\n=== Degraded chip ===");
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
  await new Promise((r) => setTimeout(r, 2000));

  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p3 = await ctx3.newPage();

  // Boot → list → detail (click Danny) to ensure company context is set
  await p3.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 });
  await p3.waitForSelector("#root > *", { timeout: 15000 });
  await p3.waitForTimeout(1000);
  await p3.goto(`${BASE}/${PREFIX}/humans`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p3.waitForTimeout(2000);

  try {
    await p3.locator("text=Danny").first().click();
    await p3.waitForTimeout(1500);
    console.log(`[nav] degraded detail URL: ${p3.url()}`);
  } catch (e) {
    console.log(`[warn] Danny click failed in degraded: ${e.message}`);
  }

  // Click Activity tab
  try {
    const at = p3.locator('[role="tab"]').filter({ hasText: "Activity" }).first();
    await at.waitFor({ state: "visible", timeout: 8000 });
    await at.click();
    await p3.waitForTimeout(4000); // 3s race budget + 1s buffer
  } catch (e) {
    console.log(`[warn] Activity tab: ${e.message}`);
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
  await p3.screenshot({ path: "/tmp/inu43-degraded2.png", fullPage: false });
  await ctx3.close();

  // Restore bridge
  bridgeDead.kill();
  spawn("node", ["--env-file=../../.env", "dist/index.js"], {
    cwd: "/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/apps/ut-bridge",
    stdio: "pipe",
    detached: true,
  }).unref();

  await browser.close();

  console.log("\n========== DETAIL SUMMARY ==========");
  console.log(`axe baseline (/dashboard): ${axeBase} serious/critical`);
  console.log(`axe /humans/:id:           ${axe2} serious/critical`);
  console.log(`Overview tab:              ${overviewTab ? "PASS" : "FAIL"}`);
  console.log(`Activity tab:              ${activityTab ? "PASS" : "FAIL"}`);
  console.log(`Degraded chip:             ${chipDeg ? "PASS" : "FAIL"}`);
})();
