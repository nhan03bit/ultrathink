/**
 * Gemini Browser Auth
 *
 * Two modes:
 *   1. Interactive: Opens browser → user logs in → session saved
 *   2. Cookie import: Reads a Netscape cookie file (exported from browser) → converts to Playwright session
 *
 * Usage:
 *   npx playwright install chromium                          # one-time
 *   npx tsx scripts/gemini-browser/auth.ts                   # interactive login
 *   npx tsx scripts/gemini-browser/auth.ts --cookies cookies.txt   # import cookie file
 *   npx tsx scripts/gemini-browser/auth.ts --force           # overwrite existing session
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, ".state");
const STATE_FILE = join(STATE_DIR, "gemini-session.json");

const { values: args } = parseArgs({
  options: {
    cookies: { type: "string", short: "c" },
    force: { type: "boolean", short: "f", default: false },
  },
  strict: true,
});

// ---------------------------------------------------------------------------
// Netscape cookie file → Playwright storageState converter
// ---------------------------------------------------------------------------

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

function parseNetscapeCookies(filePath: string): PlaywrightCookie[] {
  const content = readFileSync(filePath, "utf-8");
  const cookies: PlaywrightCookie[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    const parts = trimmed.split("\t");
    if (parts.length < 7) continue;

    const [domain, , path, secure, expires, name, value] = parts;

    // Determine if httpOnly based on cookie name patterns
    const isHttpOnly =
      name.startsWith("__Secure-") ||
      name === "SID" ||
      name === "HSID" ||
      name === "SSID" ||
      name === "SIDCC" ||
      name === "NID";

    cookies.push({
      name,
      value,
      domain,
      path,
      expires: parseInt(expires, 10),
      httpOnly: isHttpOnly,
      secure: secure.toUpperCase() === "TRUE",
      sameSite: "Lax",
    });
  }

  return cookies;
}

function cookiesToStorageState(cookies: PlaywrightCookie[]) {
  return {
    cookies,
    origins: [],
  };
}

// ---------------------------------------------------------------------------
// Import from cookie file
// ---------------------------------------------------------------------------

async function importCookies(cookieFile: string) {
  mkdirSync(STATE_DIR, { recursive: true });

  if (!existsSync(cookieFile)) {
    console.error(`Cookie file not found: ${cookieFile}`);
    process.exit(1);
  }

  console.log(`Parsing cookies from: ${cookieFile}`);
  const cookies = parseNetscapeCookies(cookieFile);

  if (cookies.length === 0) {
    console.error("No cookies found in file. Check the format (Netscape HTTP Cookie File).");
    process.exit(1);
  }

  // Filter to relevant domains
  const relevant = cookies.filter(
    (c) => c.domain.includes("google.com") || c.domain.includes("gemini.google.com") || c.domain.includes("youtube.com")
  );

  console.log(`Found ${cookies.length} cookies total, ${relevant.length} Google-related.`);

  const state = cookiesToStorageState(relevant);
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`\nSession saved to: ${STATE_FILE}`);

  // Verify the session works
  console.log("\nVerifying session...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    storageState: STATE_FILE,
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded", timeout: 30000 });
  // Give page time to render auth state
  await page.waitForTimeout(5000);

  const signInBtn = page.locator('a:has-text("Sign in")');
  const isSignedOut = await signInBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (isSignedOut) {
    console.error("Session verification FAILED — cookies may be expired or incomplete.");
    console.error("Try exporting fresh cookies from your browser and running again.");
    // Keep the file anyway in case it works with a page reload
  } else {
    // Refresh the session state with any new cookies from the page load
    await context.storageState({ path: STATE_FILE });
    console.log("Session verified — logged into Gemini successfully.");
  }

  await browser.close();
  console.log('\nYou can now run: npm run gemini:generate -- --prompt "..." --output image.png');
}

// ---------------------------------------------------------------------------
// Interactive browser login
// ---------------------------------------------------------------------------

async function interactiveAuth() {
  mkdirSync(STATE_DIR, { recursive: true });

  console.log("Opening browser — please log into your Google account...");
  console.log("Once you see the Gemini chat page, press Enter here to save the session.\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  await page.goto("https://gemini.google.com/app");

  console.log("Waiting for you to log in...");
  console.log("(The page should show the Gemini chat interface with your account)");

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  try {
    await page.waitForSelector('[aria-label="Enter a prompt for Gemini"]', {
      timeout: 5000,
    });
    console.log("Login verified — Gemini chat interface detected.");
  } catch {
    console.warn("Warning: Could not verify Gemini chat interface. Saving session anyway.");
  }

  await context.storageState({ path: STATE_FILE });
  console.log(`\nSession saved to: ${STATE_FILE}`);
  console.log("You can now use generate.ts to create images without logging in again.");

  await browser.close();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (existsSync(STATE_FILE) && !args.force) {
    console.log(`Existing session found at ${STATE_FILE}`);
    console.log("Use --force to overwrite, or delete it first:");
    console.log(`  rm "${STATE_FILE}"`);
    process.exit(0);
  }

  if (args.cookies) {
    await importCookies(args.cookies);
  } else {
    await interactiveAuth();
  }
}

main().catch((err) => {
  console.error("Auth failed:", err.message);
  process.exit(1);
});
