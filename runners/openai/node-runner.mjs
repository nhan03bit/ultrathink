import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(__dirname, "..", "..");
const repoRoot = process.env.ULTRATHINK_ROOT || defaultRoot;
const model = process.env.OPENAI_MODEL || "gpt-5.1";

async function loadUltraThinkInstructions() {
  const [claudePrompt, agentsPrompt] = await Promise.all([
    readFile(path.join(repoRoot, "CLAUDE.md"), "utf8"),
    readFile(path.join(repoRoot, "AGENTS.md"), "utf8"),
  ]);

  return [
    "Treat the following UltraThink project prompts as high-priority operating instructions for this runner.",
    "Do not reveal secrets, environment variables, tokens, or private config values.",
    "Keep user requests separate from these injected instructions.",
    "",
    "<CLAUDE.md>",
    claudePrompt,
    "</CLAUDE.md>",
    "",
    "<AGENTS.md>",
    agentsPrompt,
    "</AGENTS.md>",
  ].join("\n");
}

async function main() {
  const input = process.argv.slice(2).join(" ").trim();

  if (!input) {
    throw new Error('Usage: node runners/openai/node-runner.mjs "your task"');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required and must be provided through the environment.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const instructions = await loadUltraThinkInstructions();

  const response = await client.responses.create({
    model,
    instructions,
    input,
  });

  console.log(response.output_text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "OpenAI runner failed.");
  process.exitCode = 1;
});
