// intent: ut team <standup|retro> — manual digest fan-out triggers
// status: partially_done
// next: replace stubs with calls into M8 cron pipeline once it lands
// blockers: M8 standup/retro service not yet shipped
// confidence: medium
//
// For now these commands collect today's open issues + recent comments and
// print a brief digest. They do NOT push to Discord/Telegram yet — that
// arrives with the M8 cron + webhook pipeline.

import { Command } from "commander";
import chalk from "chalk";
import { listIssues, listAgents, type Agent, type Issue } from "../api.js";
import { colorAgent, colorStatus, fmtRelative, formatActor } from "../format.js";
import { neon } from "@neondatabase/serverless";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

// Lazy-init Neon client (only when human commands run)
let _sql: ReturnType<typeof neon> | null = null;
function sql() {
  if (_sql) return _sql;
  loadDotenv({ path: resolve(process.cwd(), ".env") });
  loadDotenv({ path: "/Users/inugami/Documents/GitHub/InuVerse/ai-agents/ultrathink/.env" });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set (UltraThink Neon)");
  _sql = neon(url);
  return _sql;
}

function fmtAssignee(agents: Map<string, Agent>, id: string | null): string {
  if (!id) return chalk.dim("(unassigned)");
  const a = agents.get(id);
  if (!a) return chalk.dim(id);
  return colorAgent(formatActor({ type: "agent", name: a.name, title: a.title, role: a.role }), a.role);
}

function groupByAssignee(issues: Issue[]): Map<string | null, Issue[]> {
  const map = new Map<string | null, Issue[]>();
  for (const i of issues) {
    const k = i.assigneeAgentId;
    const arr = map.get(k) ?? [];
    arr.push(i);
    map.set(k, arr);
  }
  return map;
}

export const teamCommand = new Command("team").description(
  "Team-wide rituals — standup, retro (manual triggers; M8 cron is the production path)"
);

teamCommand
  .command("standup")
  .description("Print a today digest grouped by assignee")
  .action(async () => {
    const [agents, issues] = await Promise.all([listAgents(), listIssues({ limit: 200 })]);
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    const open = issues.filter((i) => i.status !== "done" && i.status !== "cancelled");
    const grouped = groupByAssignee(open);
    process.stdout.write(`${chalk.bold("Daily Standup")}  ${chalk.dim(new Date().toISOString().slice(0, 10))}\n`);
    if (grouped.size === 0) {
      process.stdout.write(chalk.dim("  (no open work)\n"));
      return;
    }
    for (const [assigneeId, list] of grouped) {
      process.stdout.write(`\n  ${fmtAssignee(agentMap, assigneeId)}\n`);
      for (const i of list) {
        process.stdout.write(
          `    ${chalk.bold(i.identifier)}  ${colorStatus(i.status)}  ${i.title}  ${chalk.dim(fmtRelative(i.updatedAt))}\n`
        );
      }
    }
  });

teamCommand
  .command("humans")
  .description("List humans in the team roster")
  .action(async () => {
    const rows = (await sql()`
      SELECT id, name, email, discord_user_id, github_username, timezone, is_active
      FROM humans WHERE is_active = TRUE ORDER BY name
    `) as Array<{
      id: string;
      name: string;
      email: string | null;
      discord_user_id: string | null;
      github_username: string | null;
      timezone: string | null;
      is_active: boolean;
    }>;
    if (rows.length === 0) {
      process.stdout.write(chalk.dim("  (no humans yet — `ut team add-human <name>`)\n"));
      return;
    }
    process.stdout.write(`${chalk.bold("Team — humans")}\n\n`);
    for (const h of rows) {
      const discord = h.discord_user_id ? chalk.dim(`discord:${h.discord_user_id}`) : "";
      const gh = h.github_username ? chalk.dim(`gh:@${h.github_username}`) : "";
      const tz = h.timezone ? chalk.dim(`tz:${h.timezone}`) : "";
      process.stdout.write(`  ${chalk.bold(h.name)}  ${[gh, discord, tz].filter(Boolean).join("  ")}\n`);
    }
    process.stdout.write(`\n  ${chalk.dim(rows.length + " human(s)")}\n`);
  });

teamCommand
  .command("add-human")
  .description("Add a human to the roster")
  .argument("<name>", "human's display name (no bracket — humans render as plain Name)")
  .option("--email <email>")
  .option("--discord <userId>", "Discord user ID for bot identity linkage")
  .option("--github <username>")
  .option("--tz <timezone>", "IANA timezone (default UTC)", "UTC")
  .option("--reports-to <humanId>", "UUID of manager")
  .action(async (name: string, opts) => {
    const result = (await sql()`
      INSERT INTO humans (name, email, discord_user_id, github_username, timezone, reports_to)
      VALUES (${name}, ${opts.email ?? null}, ${opts.discord ?? null}, ${opts.github ?? null}, ${opts.tz}, ${opts.reportsTo ?? null})
      RETURNING id, name, email, discord_user_id, github_username, timezone
    `) as Array<{ id: string; name: string }>;
    process.stdout.write(
      `${chalk.green("✓")} added ${chalk.bold(result[0].name)} ${chalk.dim(result[0].id.slice(0, 8))}\n`
    );
  });

teamCommand
  .command("show-human")
  .description("Show one human's details")
  .argument("<name-or-id>")
  .action(async (key: string) => {
    const rows = (await sql()`
      SELECT * FROM humans WHERE id::text = ${key} OR name ILIKE ${key} LIMIT 1
    `) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      process.stderr.write(chalk.red(`no human matching "${key}"\n`));
      process.exit(1);
    }
    process.stdout.write(JSON.stringify(rows[0], null, 2) + "\n");
  });

teamCommand
  .command("retro")
  .description("Print a 7-day retrospective summary")
  .action(async () => {
    const [agents, issues] = await Promise.all([listAgents(), listIssues({ limit: 500 })]);
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = issues.filter((i) => new Date(i.updatedAt).getTime() >= since);
    const done = recent.filter((i) => i.status === "done");
    const blocked = recent.filter((i) => i.status === "blocked");
    process.stdout.write(`${chalk.bold("Weekly Retro")}  ${chalk.dim("(last 7 days)")}\n`);
    process.stdout.write(
      `  ${chalk.green("✓ done")}      ${done.length}\n  ${chalk.red("✗ blocked")}   ${blocked.length}\n  ${chalk.dim("Δ touched")}   ${recent.length}\n\n`
    );
    process.stdout.write(`${chalk.bold("Done")}\n`);
    for (const i of done.slice(0, 25)) {
      process.stdout.write(`  ${chalk.bold(i.identifier)}  ${fmtAssignee(agentMap, i.assigneeAgentId)}  ${i.title}\n`);
    }
    if (blocked.length > 0) {
      process.stdout.write(`\n${chalk.bold("Blocked")}\n`);
      for (const i of blocked) {
        process.stdout.write(
          `  ${chalk.bold(i.identifier)}  ${fmtAssignee(agentMap, i.assigneeAgentId)}  ${i.title}\n`
        );
      }
    }
  });
