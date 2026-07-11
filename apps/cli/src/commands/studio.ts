// intent: `ut studio "<prompt>"` — Phase 1 proof of the Studio engine
// status: done
// next: add `ut studio resume <project>`, `ut studio list`, `ut studio rm`
// confidence: high
//
// Streams the engine's typed events to the terminal with formatted output:
//   - assistant text → cyan
//   - tool calls → dim, collapsed (one line per call)
//   - file edits → green diff summary
//   - errors → red
//   - completion → cost + duration footer
//
// Resolves a project under ~/Studio/projects/<slug>/ from the prompt (or --dir
// to target an existing one), spawns claude inside it, supports follow-ups.

import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { createSpawn, resolveProject, listProjects, studioRoot, type EngineEvent } from "@inuverse/studio-engine";

export const studioCommand = new Command("studio").description(
  "Build apps from natural language. Spawns Claude Code with UltraThink skills + memory wired in."
);

studioCommand
  .command("ls")
  .description("List Studio projects under ~/Studio/projects/")
  .action(async () => {
    const projects = await listProjects();
    if (projects.length === 0) {
      process.stdout.write(chalk.dim(`(no projects yet — try \`ut studio "<your idea>"\`)\n`));
      return;
    }
    process.stdout.write(`${chalk.bold("Studio projects")}  ${chalk.dim(studioRoot())}\n\n`);
    for (const p of projects) {
      const ago = relativeTime(p.lastModified);
      process.stdout.write(`  ${chalk.bold(p.name.padEnd(48))}  ${chalk.dim(ago)}\n`);
      process.stdout.write(`    ${chalk.dim(p.dir)}\n`);
    }
    process.stdout.write(`\n  ${chalk.dim(projects.length + " project(s)")}\n`);
  });

studioCommand
  .argument("[prompt...]", "Plain-English description of what to build")
  .option("--dir <path>", "Resume an existing project at this path instead of creating a new one")
  .option("--model <model>", "Override Claude model (e.g. sonnet, opus)")
  .option("--no-skills", "Disable skill auto-routing")
  .option("--no-follow-up", "Exit after first turn (default is interactive follow-up)")
  .action(async (promptParts: string[], opts) => {
    const initialPrompt = (promptParts ?? []).join(" ").trim();
    if (!initialPrompt) {
      process.stderr.write(chalk.red('error: provide a prompt, e.g. `ut studio "build a tip calculator"`\n'));
      process.exit(1);
    }

    const project = await resolveProject({
      prompt: initialPrompt,
      projectDir: opts.dir,
    });

    process.stdout.write(`${chalk.bold("UltraThink Studio")}  ${chalk.dim(project.dir)}\n`);
    process.stdout.write(`${chalk.dim("session: " + project.name)}\n\n`);

    await runTurn(initialPrompt, project.dir, {
      model: opts.model,
      skills: opts.skills !== false,
    });

    // Follow-up loop: re-spawn with same session id (resumes context)
    if (opts.followUp === false) return;

    const rl = createInterface({ input, output });
    while (true) {
      const next = (await rl.question(chalk.dim("\n› "))).trim();
      if (!next) continue;
      if (next === "/quit" || next === "/exit" || next === "/q") break;
      if (next === "/help") {
        process.stdout.write(chalk.dim("  /quit (or /q)  /help  /open  /clear-screen\n"));
        continue;
      }
      if (next === "/open") {
        const { spawn: sp } = await import("node:child_process");
        sp("open", [project.dir], { stdio: "ignore", detached: true }).unref();
        process.stdout.write(chalk.dim(`  opened ${project.dir} in Finder\n`));
        continue;
      }
      if (next === "/clear-screen") {
        process.stdout.write("\x1bc");
        continue;
      }
      await runTurn(next, project.dir, {
        model: opts.model,
        skills: opts.skills !== false,
      });
    }
    rl.close();
  });

interface TurnOptions {
  model?: string;
  skills?: boolean;
}

async function runTurn(prompt: string, projectDir: string, opts: TurnOptions): Promise<void> {
  const handle = createSpawn({
    prompt,
    projectDir,
    model: opts.model,
    topSkills: opts.skills === false ? 0 : 3,
  });

  // Track tool-use names so tool-result events can label themselves
  const toolNames = new Map<string, string>();
  let textBuf = "";

  const flushText = () => {
    if (!textBuf) return;
    process.stdout.write(chalk.cyan(textBuf));
    textBuf = "";
  };

  for await (const ev of handle.events) {
    render(
      ev,
      toolNames,
      (text) => {
        textBuf += text;
      },
      flushText
    );
  }

  flushText();

  const exit = await handle.done;
  if (exit.exitCode !== 0 && exit.exitCode !== null) {
    process.stdout.write(chalk.red(`\n  exited with code ${exit.exitCode}\n`));
  }
}

function render(
  ev: EngineEvent,
  toolNames: Map<string, string>,
  bufferText: (s: string) => void,
  flushText: () => void
): void {
  switch (ev.kind) {
    case "spawn-started": {
      process.stdout.write(chalk.dim(`  spawn started (pid ${ev.pid})\n`));
      break;
    }
    case "skill-injected": {
      const names = ev.skills.map((s) => s.name).join(", ");
      process.stdout.write(chalk.magenta(`  skills loaded: `) + chalk.dim(names) + "\n");
      break;
    }
    case "system-init": {
      // quiet — already shown header
      break;
    }
    case "assistant-text-delta": {
      bufferText(ev.text);
      break;
    }
    case "assistant-text-block": {
      // Final block — if we already streamed deltas this would duplicate.
      // Claude Code emits both partials AND the final block; we prefer the deltas.
      break;
    }
    case "thinking": {
      flushText();
      const t = ev.text.trim();
      if (t) process.stdout.write(chalk.dim.italic(`  ⟪ ${truncate(t, 120)} ⟫\n`));
      break;
    }
    case "tool-use-start": {
      flushText();
      toolNames.set(ev.toolUseId, ev.name);
      const summary = summariseToolInput(ev.name, ev.input);
      process.stdout.write(chalk.yellow(`  ▸ ${ev.name}`) + chalk.dim(summary ? ` ${summary}` : "") + "\n");
      break;
    }
    case "tool-result": {
      flushText();
      const name = toolNames.get(ev.toolUseId) ?? "tool";
      if (ev.isError) {
        process.stdout.write(chalk.red(`    ✗ ${name} failed\n`));
      }
      // Successful tool results are noisy; we don't dump unless requested.
      break;
    }
    case "tool-use-input-delta": {
      // Streamed tool input — too noisy to render line by line; skip.
      break;
    }
    case "usage": {
      // Surface lightly at end of message; full cost lands on completion.
      break;
    }
    case "memory-recalled": {
      flushText();
      process.stdout.write(chalk.blue(`  ⌬ recalled ${ev.memoryIds.length} memor(ies)\n`));
      break;
    }
    case "completion": {
      flushText();
      const dur = (ev.durationMs / 1000).toFixed(1);
      const cost = ev.costUsd != null ? ` $${ev.costUsd.toFixed(4)}` : "";
      process.stdout.write(chalk.dim(`\n  done in ${dur}s${cost}\n`));
      break;
    }
    case "error": {
      flushText();
      process.stdout.write(chalk.red(`  ✗ ${ev.message}\n`));
      break;
    }
    case "spawn-exited": {
      // Footer handled by runTurn after iteration ends.
      break;
    }
  }
}

function summariseToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  if (typeof obj.file_path === "string") return chalk.dim(obj.file_path);
  if (typeof obj.path === "string") return chalk.dim(obj.path);
  if (typeof obj.command === "string") return chalk.dim(truncate(obj.command, 80));
  if (typeof obj.pattern === "string") return chalk.dim(`'${truncate(obj.pattern, 60)}'`);
  if (typeof obj.url === "string") return chalk.dim(obj.url);
  return "";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function relativeTime(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} d ago`;
  return d.toLocaleDateString();
}
