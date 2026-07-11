import { NextResponse } from "next/server";
import { readFileSync, readdirSync, existsSync } from "fs";

const SCREENSHOTS_DIR = "/tmp/ultrathink-screenshots";

interface TestResult {
  id: string;
  page: string;
  viewport: string;
  status: "pass" | "fail" | "pending";
  screenshotPath?: string;
  timestamp: string;
  durationMs?: number;
  error?: string;
}

export async function GET() {
  const results: TestResult[] = [];

  if (existsSync(SCREENSHOTS_DIR)) {
    const files = readdirSync(SCREENSHOTS_DIR).filter((f) => f.endsWith(".json"));

    for (const file of files.slice(-50)) {
      try {
        const raw = readFileSync(`${SCREENSHOTS_DIR}/${file}`, "utf-8");
        const data = JSON.parse(raw);
        results.push({
          id: data.id ?? file.replace(".json", ""),
          page: data.page ?? data.url ?? "/",
          viewport: data.viewport ?? "desktop",
          status: data.status ?? "pass",
          screenshotPath: data.screenshotPath,
          timestamp: data.timestamp ?? new Date().toISOString(),
          durationMs: data.durationMs,
          error: data.error,
        });
      } catch {
        // skip malformed files
      }
    }
  }

  // Group by page
  const byPage = new Map<string, TestResult[]>();
  for (const r of results) {
    const arr = byPage.get(r.page) || [];
    arr.push(r);
    byPage.set(r.page, arr);
  }

  const pages = Array.from(byPage.entries()).map(([page, tests]) => ({
    page,
    tests,
    status: tests.some((t) => t.status === "fail")
      ? "fail"
      : tests.some((t) => t.status === "pending")
        ? "pending"
        : "pass",
    lastRun: tests.reduce((latest, t) => (t.timestamp > latest ? t.timestamp : latest), ""),
  }));

  return NextResponse.json({
    pages,
    totalTests: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    screenshotsDir: SCREENSHOTS_DIR,
    hasData: results.length > 0,
  });
}
