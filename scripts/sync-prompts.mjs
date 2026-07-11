#!/usr/bin/env node
// intent: generate runtime prompt artifacts from one canonical UltraThink core prompt
// status: done
// next: run with --write after edits to prompts/core.md or prompts/runtimes/*.md
// blockers: none
// confidence: high

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));

const outputs = [
  {
    name: "Claude",
    title: "# UltraThink - Claude Workflow OS",
    runtime: "prompts/runtimes/claude.md",
    output: "prompts/generated/CLAUDE.md",
  },
  {
    name: "Codex",
    title: "# UltraThink - Codex Agent Instructions",
    runtime: "prompts/runtimes/codex.md",
    output: "prompts/generated/AGENTS.md",
  },
  {
    name: "OpenAI",
    title: "# UltraThink - OpenAI-Compatible System Prompt",
    runtime: "prompts/runtimes/openai.md",
    output: "prompts/openai-system.md",
  },
];

function usage() {
  return "Usage: node scripts/sync-prompts.mjs [--write | --check]";
}

async function readRel(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function render(output) {
  const core = (await readRel("prompts/core.md")).trim();
  const runtime = (await readRel(output.runtime)).trim();
  return `${output.title}\n\n<!-- generated-from: prompts/core.md + ${output.runtime}; do not edit generated output directly -->\n\n${core}\n\n${runtime}\n`;
}

async function writeOutputs() {
  for (const output of outputs) {
    const body = await render(output);
    const target = path.join(root, output.output);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body, "utf8");
    console.log(`wrote ${output.output}`);
  }
}

async function checkOutputs() {
  let failed = false;

  for (const output of outputs) {
    const expected = await render(output);
    const target = path.join(root, output.output);
    let actual = "";
    try {
      actual = await readFile(target, "utf8");
    } catch {
      failed = true;
      console.error(`missing ${output.output}; run npm run prompts:sync`);
      continue;
    }

    if (actual !== expected) {
      failed = true;
      console.error(`stale ${output.output}; run npm run prompts:sync`);
    } else {
      console.log(`ok ${output.output}`);
    }
  }

  const sourceMarker = "prompt-source: prompts/core.md";
  for (const rootFile of ["CLAUDE.md", "AGENTS.md"]) {
    const body = await readRel(rootFile);
    if (!body.includes(sourceMarker)) {
      failed = true;
      console.error(`missing ${sourceMarker} marker in ${rootFile}`);
    } else {
      console.log(`ok ${rootFile} source marker`);
    }
  }

  if (failed) process.exit(1);
}

if (args.has("--write")) {
  await writeOutputs();
} else if (args.has("--check")) {
  await checkOutputs();
} else {
  console.error(usage());
  process.exit(1);
}
