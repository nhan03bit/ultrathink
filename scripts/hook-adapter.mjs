#!/usr/bin/env node
// intent: normalize Claude and Codex hook execution through one manifest-backed adapter
// status: done
// next: keep new hook registrations in .claude/hooks/manifest.json instead of per-runtime configs
// blockers: none
// confidence: high

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const MANIFEST_PATH = resolve(ROOT, ".claude/hooks/manifest.json");
const runtime = process.argv[2];
const event = process.argv[3];

if (!runtime || !event) {
  console.error("Usage: hook-adapter.mjs <runtime> <event>");
  process.exit(2);
}

const input = await readStdin();
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const runtimeConfig = manifest.runtimes?.[runtime];

if (!runtimeConfig?.supportedEvents?.includes(event)) {
  process.exit(0);
}

const hookInput = parseJson(input);
const tier = readTier();
const hooks = (manifest.hooks ?? []).filter((hook) => {
  if (hook.event !== event) return false;
  if (hook.tier && hook.tier !== tier) return false;
  if (hook.runtimes && !hook.runtimes.includes(runtime)) return false;
  return matchesHook(hook, hookInput);
});

const merged = {};

for (const hook of hooks) {
  const result = await runHook(hook, input);
  if (result.stderr) process.stderr.write(result.stderr);

  const output = result.stdout.trim();
  if (!output) continue;

  const parsed = parseJson(output);
  if (!parsed) {
    process.stdout.write(output);
    if (!output.endsWith("\n")) process.stdout.write("\n");
    continue;
  }

  if (parsed.hookSpecificOutput?.permissionDecision) {
    process.stdout.write(JSON.stringify(parsed));
    process.exit(0);
  }

  mergeHookOutput(merged, parsed);
}

if (Object.keys(merged).length > 0) {
  process.stdout.write(JSON.stringify(merged));
}

function readStdin() {
  return new Promise((resolveInput) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolveInput(data));
  });
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return null;
  }
}

function readTier() {
  const configPath = resolve(process.env.HOME ?? "", ".ultrathink/config.json");
  if (!existsSync(configPath)) return process.env.ULTRATHINK_TIER ?? "oss";
  try {
    return JSON.parse(readFileSync(configPath, "utf8")).tier ?? "oss";
  } catch {
    return process.env.ULTRATHINK_TIER ?? "oss";
  }
}

function matchesHook(hook, payload) {
  if (!hook.matcher) return true;
  const value = payload?.tool_name ?? payload?.source ?? payload?.hook_event_name ?? "";
  if (!value) return false;
  return new RegExp(hook.matcher).test(value);
}

function runHook(hook, stdin) {
  return new Promise((resolveRun) => {
    const child = spawn(hook.command, {
      cwd: ROOT,
      env: { ...process.env, ULTRATHINK_RUNTIME: runtime, ULTRATHINK_HOOK_EVENT: event },
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutMs = Math.max(1, hook.timeoutSec ?? 10) * 1000;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      stderr += `[hook-adapter] ${hook.id} timed out after ${hook.timeoutSec ?? 10}s\n`;
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", () => {
      settled = true;
      clearTimeout(timer);
      resolveRun({ stdout, stderr });
    });
    child.stdin.end(stdin || "{}");
  });
}

function mergeHookOutput(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (key === "additionalContext" && target.additionalContext && value) {
      target.additionalContext = `${target.additionalContext}\n\n${value}`;
    } else {
      target[key] = value;
    }
  }
}
