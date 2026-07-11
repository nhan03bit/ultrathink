import { NextRequest, NextResponse } from "next/server";
import { getManifest, saveManifest, getBackendConfig, getOutputDir, type AssetEntry, type Backend } from "@/lib/assets";
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

// Find monorepo root with playwright installed
function findPlaywrightRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, "node_modules", "playwright"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// POST /api/assets/generate — trigger pipeline for a manifest
export async function POST(req: NextRequest) {
  try {
    const { manifestId, assetIds } = await req.json();

    const manifest = getManifest(manifestId);
    if (!manifest) return NextResponse.json({ error: "Manifest not found" }, { status: 404 });

    const config = getBackendConfig();
    const backend = manifest.backend;

    // Validate backend config
    const configError = validateBackendConfig(backend, config);
    if (configError) return NextResponse.json({ error: configError }, { status: 400 });

    // Filter assets to generate
    const targets = assetIds
      ? manifest.assets.filter((a: AssetEntry) => assetIds.includes(a.id))
      : manifest.assets.filter((a: AssetEntry) => a.status === "pending" || a.status === "failed");

    if (!targets.length) {
      return NextResponse.json({ error: "No pending/failed assets to generate" }, { status: 400 });
    }

    // Mark as generating
    for (const asset of targets) {
      asset.status = "generating";
      asset.error = undefined;
    }
    saveManifest(manifest);

    // Fire off generation in background (non-blocking response)
    runPipeline(manifest.id, targets, backend, config).catch((err) => {
      console.error("Pipeline error:", err);
    });

    return NextResponse.json({
      started: true,
      backend,
      count: targets.length,
      assetIds: targets.map((a: AssetEntry) => a.id),
    });
  } catch (err) {
    console.error("POST /api/assets/generate error:", err);
    return NextResponse.json({ error: "Failed to start generation" }, { status: 500 });
  }
}

function validateBackendConfig(backend: Backend, config: ReturnType<typeof getBackendConfig>): string | null {
  switch (backend) {
    case "puter":
      // Puter.js requires no configuration — zero setup
      break;
    case "tinyfish":
      if (!config.tinyfish.apiKey) return "TinyFish API key not configured";
      break;
    case "gemini-api":
      if (!config.geminiApi.secure1psid) return "Gemini API cookie (__Secure-1PSID) not configured";
      break;
    case "playwright":
      break;
  }
  return null;
}

// ── Pipeline Runner ──

async function runPipeline(
  manifestId: string,
  assets: AssetEntry[],
  backend: Backend,
  config: ReturnType<typeof getBackendConfig>
) {
  for (const asset of assets) {
    try {
      let result: { outputPath: string; outputUrl?: string };

      switch (backend) {
        case "puter":
          result = await generateWithPuter(asset, config.puter);
          break;
        case "tinyfish":
          result = await generateWithTinyfish(asset, config.tinyfish);
          break;
        case "gemini-api":
          result = await generateWithGeminiApi(asset, config.geminiApi);
          break;
        case "playwright":
          result = await generateWithPlaywright(asset, config.playwright);
          break;
      }

      const manifest = getManifest(manifestId);
      if (!manifest) break;
      const entry = manifest.assets.find((a: AssetEntry) => a.id === asset.id);
      if (entry) {
        entry.status = "completed";
        entry.outputPath = result.outputPath;
        entry.outputUrl = result.outputUrl;
        entry.generatedAt = new Date().toISOString();
      }
      saveManifest(manifest);
    } catch (err) {
      const manifest = getManifest(manifestId);
      if (!manifest) break;
      const entry = manifest.assets.find((a: AssetEntry) => a.id === asset.id);
      if (entry) {
        entry.status = "failed";
        entry.error = err instanceof Error ? err.message : String(err);
        entry.retries += 1;
      }
      saveManifest(manifest);
    }
  }
}

// ── Prompt Builder ──

function buildGeminiPrompt(asset: AssetEntry): string {
  let prompt = `Generate an image: ${asset.prompt}`;
  if (asset.style) prompt += `\nStyle: ${asset.style}`;
  if (asset.dimensions) prompt += `\nDimensions: ${asset.dimensions}`;
  if (asset.negativePrompt) prompt += `\nAvoid: ${asset.negativePrompt}`;
  return prompt;
}

// ── Backend: Puter.js (Zero Setup — Free, No API Key) ──
// https://github.com/nicholasgasior/puter — MIT License
// Uses Puter's public REST API for AI image generation, powered by Gemini models.

async function generateWithPuter(
  asset: AssetEntry,
  config: { model: string; testMode: boolean }
): Promise<{ outputPath: string }> {
  const prompt = buildGeminiPrompt(asset);
  const outputDir = getOutputDir();
  const outputPath = join(outputDir, `${asset.id}.png`);
  mkdirSync(outputDir, { recursive: true });

  const res = await fetch("https://api.puter.com/ai/txt2img", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      model: config.model || "gemini-3.1-flash-image-preview",
      test_mode: config.testMode || false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`Puter.js API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(outputPath, buffer);
  return { outputPath };
}

// ── Backend: TinyFish ──

async function generateWithTinyfish(
  asset: AssetEntry,
  config: { apiKey: string; browserProfile: string; targetUrl: string }
): Promise<{ outputPath: string }> {
  const prompt = buildGeminiPrompt(asset);

  const res = await fetch("https://agent.tinyfish.ai/v1/automation/run-sse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify({
      url: config.targetUrl,
      goal: [
        `1. If not logged into Google, you may need to log in first.`,
        `2. Find the prompt input area (a text editor with placeholder "Enter a prompt here").`,
        `3. Type this prompt: "${prompt}"`,
        `4. Press Enter to submit.`,
        `5. Wait for the image to finish generating (the stop icon will disappear and a send icon will reappear).`,
        `6. Click on the generated image to open the preview/lightbox.`,
        `7. Click the Download button to save the image.`,
        `8. Return the download path or confirm the image was saved.`,
      ].join("\n"),
      browser_profile: config.browserProfile,
    }),
  });

  if (!res.ok) throw new Error(`TinyFish API error: ${res.status} ${res.statusText}`);

  const text = await res.text();
  const lines = text.split("\n").filter((l: string) => l.startsWith("data:"));
  let resultData: Record<string, unknown> | null = null;

  for (const line of lines) {
    try {
      const data = JSON.parse(line.slice(5));
      if (data.type === "COMPLETE" || data.status === "COMPLETED") {
        resultData = data;
        break;
      }
    } catch {
      // skip malformed SSE lines
    }
  }

  const outputPath = join(getOutputDir(), `${asset.id}.json`);
  writeFileSync(outputPath, JSON.stringify({ asset, result: resultData }, null, 2));
  return { outputPath };
}

// ── Backend: Gemini-API (Python subprocess — execFileSync for safety) ──

async function generateWithGeminiApi(
  asset: AssetEntry,
  config: { secure1psid: string; secure1psidts: string; model: string }
): Promise<{ outputPath: string }> {
  const prompt = buildGeminiPrompt(asset);
  const outputDir = getOutputDir();
  const outputPath = join(outputDir, `${asset.id}.png`);
  mkdirSync(outputDir, { recursive: true });

  // Write a temporary Python script file (avoids shell injection via -c)
  const scriptPath = join(outputDir, `_gen_${asset.id}.py`);
  const configPath = join(outputDir, `_gen_${asset.id}_config.json`);

  // Pass config via JSON file, not shell arguments
  writeFileSync(
    configPath,
    JSON.stringify({
      secure1psid: config.secure1psid,
      secure1psidts: config.secure1psidts,
      model: config.model,
      prompt,
      outputPath,
    })
  );

  const pythonScript = `
import asyncio, json, sys
from pathlib import Path

config = json.loads(Path(sys.argv[1]).read_text())

async def main():
    from gemini_webapi import GeminiClient
    client = GeminiClient(
        secure_1psid=config["secure1psid"],
        secure_1psidts=config["secure1psidts"],
    )
    await client.init(timeout=60, auto_close=True, close_delay=10)
    response = await client.generate_content(config["prompt"], model=config["model"])
    if response.images:
        img = response.images[0]
        if hasattr(img, "url") and img.url:
            import urllib.request
            urllib.request.urlretrieve(img.url, config["outputPath"])
        elif hasattr(img, "data") and img.data:
            import base64
            Path(config["outputPath"]).write_bytes(base64.b64decode(img.data))
        else:
            print("NO_IMAGE_DATA", file=sys.stderr)
            sys.exit(1)
    else:
        print("NO_IMAGES_IN_RESPONSE", file=sys.stderr)
        sys.exit(1)

asyncio.run(main())
`.trim();

  writeFileSync(scriptPath, pythonScript);

  try {
    execFileSync("python3", [scriptPath, configPath], {
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() || "";
    throw new Error(`Gemini-API generation failed: ${stderr.slice(0, 500)}`, { cause: err });
  } finally {
    // Clean up temp files
    try {
      unlinkSync(scriptPath);
      unlinkSync(configPath);
    } catch {
      /* ignore */
    }
  }

  return { outputPath };
}

// ── Backend: Playwright (browser automation fallback) ──

async function generateWithPlaywright(
  asset: AssetEntry,
  config: { headless: boolean; timeout: number; targetUrl: string }
): Promise<{ outputPath: string }> {
  const prompt = buildGeminiPrompt(asset);
  const outputDir = getOutputDir();
  const outputPath = join(outputDir, `${asset.id}.png`);
  mkdirSync(outputDir, { recursive: true });

  // Write script and config to temp files (no shell injection)
  const scriptPath = join(outputDir, `_pw_${asset.id}.cjs`);
  const configPath = join(outputDir, `_pw_${asset.id}_config.json`);

  writeFileSync(
    configPath,
    JSON.stringify({
      headless: config.headless,
      timeout: config.timeout,
      targetUrl: config.targetUrl,
      prompt,
      outputPath,
    })
  );

  // Production-grade Gemini automation script
  // Selectors sourced from GemiPersonaPro (liewcc/GemiPersonaPro)
  const playwrightScript = `
const { chromium } = require('playwright');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));

const PROFILE_DIR = '/tmp/ultrathink-assets/auth/gemini-profile';

(async () => {
  // Must use persistent context with saved Google session
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.writeFileSync(config.outputPath + '.error', 'No browser profile. Login via dashboard first.');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: config.headless,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Stealth: hide webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Auto-dismiss agreement popup if it appears
  try {
    const agreeBtn = page.locator('button[data-test-id="upload-image-agree-button"]');
    if (await agreeBtn.isVisible({ timeout: 2000 })) await agreeBtn.click();
  } catch {}

  // Find prompt input (Quill.js editor)
  const inputSelectors = [
    "div[aria-label='Enter a prompt here']",
    "div.ql-editor[contenteditable='true']",
    "textarea[aria-label='Enter a prompt here']",
  ];

  let inputFound = false;
  for (const sel of inputSelectors) {
    const el = page.locator(sel).first();
    try {
      if (await el.isVisible({ timeout: 3000 })) {
        await el.click();
        // Clear existing text
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);
        // Type prompt
        await el.fill(config.prompt);
        inputFound = true;
        break;
      }
    } catch {}
  }

  if (!inputFound) {
    fs.writeFileSync(config.outputPath + '.error', 'Could not find Gemini prompt input. Session may have expired.');
    await context.close();
    process.exit(1);
  }

  // Submit
  await page.keyboard.press('Enter');

  // Wait for generation to complete
  // Poll: check if stop icon disappears and send icon reappears
  const maxWait = config.timeout || 60000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await page.waitForTimeout(2000);

    const isGenerating = await page.evaluate(() => {
      const stopIcon = document.querySelector('mat-icon[data-mat-icon-name="stop"]');
      const progressBar = document.querySelector('mat-progress-bar');
      return !!(stopIcon || progressBar);
    });

    if (!isGenerating) {
      // Give extra time for images to render
      await page.waitForTimeout(3000);
      break;
    }
  }

  // Find generated images in the last response
  const images = await page.evaluate(() => {
    const responses = Array.from(document.querySelectorAll('model-response'));
    if (responses.length === 0) return [];
    const lastResp = responses[responses.length - 1];
    const imgs = Array.from(lastResp.querySelectorAll('img'));
    // Filter: only large images (>250px wide), not icons
    return imgs
      .filter(img => img.getBoundingClientRect().width > 250)
      .map((img, i) => ({ index: i, src: img.src, width: img.getBoundingClientRect().width }));
  });

  if (images.length === 0) {
    // Fallback: screenshot the last response area
    const lastResp = page.locator('model-response').last();
    if (await lastResp.isVisible({ timeout: 5000 })) {
      await lastResp.screenshot({ path: config.outputPath });
    } else {
      fs.writeFileSync(config.outputPath + '.error', 'No images generated. Gemini may have refused or quota exceeded.');
      await context.close();
      process.exit(1);
    }
  } else {
    // Click the first large image to open lightbox, then download
    const targetImg = page.locator('model-response').last().locator('img').nth(images[0].index);
    await targetImg.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await targetImg.click({ force: true });
    await page.waitForTimeout(3000);

    // Try to find and click Download button
    let downloaded = false;
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
          const dlBtn = btns.find(b => {
            const label = (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '') + (b.textContent || '');
            return /download/i.test(label) && !/csv|json|code/i.test(label);
          });
          if (dlBtn) dlBtn.click();
        }),
      ]);
      const tempPath = await download.path();
      if (tempPath) {
        fs.copyFileSync(tempPath, config.outputPath);
        downloaded = true;
      }
    } catch {}

    // Fallback: screenshot the image if download didn't work
    if (!downloaded) {
      await page.keyboard.press('Escape'); // close lightbox
      await page.waitForTimeout(500);
      await targetImg.screenshot({ path: config.outputPath });
    }

    // Close lightbox
    try { await page.keyboard.press('Escape'); } catch {}
  }

  await context.close();
  console.log('Image saved to:', config.outputPath);
})().catch(err => {
  const fs = require('fs');
  try {
    fs.writeFileSync(
      JSON.parse(fs.readFileSync(process.argv[2], 'utf-8')).outputPath + '.error',
      err.message
    );
  } catch {}
  console.error('ERROR:', err.message);
  process.exit(1);
});
`.trim();

  writeFileSync(scriptPath, playwrightScript);

  const pwRoot = findPlaywrightRoot();
  try {
    execFileSync("node", [scriptPath, configPath], {
      timeout: config.timeout + 30_000,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: pwRoot,
    });
  } catch (err) {
    // Check for .error file with detailed message
    const errorFile = outputPath + ".error";
    if (existsSync(errorFile)) {
      const errorMsg = readFileSync(errorFile, "utf-8");
      try {
        unlinkSync(errorFile);
      } catch {
        /* ignore */
      }
      throw new Error(errorMsg, { cause: err });
    }
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() || "";
    throw new Error(`Playwright generation failed: ${stderr.slice(0, 500)}`, { cause: err });
  } finally {
    try {
      unlinkSync(scriptPath);
      unlinkSync(configPath);
    } catch {
      /* ignore */
    }
  }

  return { outputPath };
}
