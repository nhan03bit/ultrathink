// intent: ut agent <list|show|ask|wake>
// status: done
// next: tail run events instead of poll-then-print last comment
// confidence: high

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { listAgents, getAgent, wakeAgent, createIssue, listIssueComments, getIssue, type Agent } from "../api.js";
import { formatActor, colorAgent, colorStatus, fmtCents, fmtRelative, makeTable, printJson, trunc } from "../format.js";

function fmtAgentName(a: Agent): string {
  return formatActor({
    type: "agent",
    name: a.name,
    title: a.title,
    role: a.role,
  });
}

export async function findAgentByName(query: string): Promise<Agent> {
  const all = await listAgents();
  const q = query.trim().toLowerCase();
  // match: name, urlKey, role, full bracketed name, or partial
  const matches = all.filter((a) => {
    const n = a.name.toLowerCase();
    const k = (a.urlKey || "").toLowerCase();
    const r = (a.role || "").toLowerCase();
    return n === q || k === q || r === q || n.startsWith(q) || k.startsWith(q);
  });
  if (matches.length === 0) {
    throw new Error(`no agent matches "${query}". Try one of: ${all.map((a) => a.name).join(", ")}`);
  }
  if (matches.length > 1) {
    throw new Error(`ambiguous agent "${query}". Matched: ${matches.map((a) => a.name).join(", ")}`);
  }
  return matches[0];
}

export const agentCommand = new Command("agent").description("Agent operations — list, show, ask, wake");

agentCommand
  .command("list")
  .alias("ls")
  .description("List all agents on the company")
  .option("--json", "machine-readable output")
  .action(async (opts) => {
    const agents = await listAgents();
    if (opts.json) {
      printJson(agents);
      return;
    }
    const table = makeTable(["Agent", "Role", "Status", "Budget", "Last HB"]);
    for (const a of agents) {
      table.push([
        colorAgent(fmtAgentName(a), a.role),
        a.role,
        colorStatus(a.status),
        `${fmtCents(a.spentMonthlyCents)} / ${fmtCents(a.budgetMonthlyCents)}`,
        fmtRelative(a.lastHeartbeatAt),
      ]);
    }
    process.stdout.write(table.toString() + "\n");
  });

agentCommand
  .command("show <name>")
  .description("Show full agent detail")
  .option("--json", "machine-readable output")
  .action(async (name: string, opts) => {
    const a = await findAgentByName(name);
    const full = await getAgent(a.id);
    if (opts.json) {
      printJson(full);
      return;
    }
    process.stdout.write(
      [
        chalk.bold(colorAgent(fmtAgentName(full), full.role)),
        chalk.dim(full.id),
        "",
        `${chalk.bold("Role:")}     ${full.role}`,
        `${chalk.bold("Status:")}   ${colorStatus(full.status)}`,
        `${chalk.bold("Title:")}    ${full.title ?? "-"}`,
        `${chalk.bold("Reports:")}  ${full.reportsTo ?? "—"}`,
        `${chalk.bold("Budget:")}   ${fmtCents(full.spentMonthlyCents)} of ${fmtCents(full.budgetMonthlyCents)} mtd`,
        `${chalk.bold("Last HB:")}  ${fmtRelative(full.lastHeartbeatAt)}`,
        full.pauseReason ? `${chalk.bold("Paused:")}   ${chalk.yellow(full.pauseReason)}` : "",
        "",
        chalk.bold("Capabilities"),
        full.capabilities ? trunc(full.capabilities, 600) : chalk.dim("(none)"),
      ]
        .filter(Boolean)
        .join("\n") + "\n"
    );
  });

agentCommand
  .command("wake <name>")
  .description("Manually trigger an agent's heartbeat")
  .option("--reason <reason>", "free-form reason string")
  .action(async (name: string, opts) => {
    const a = await findAgentByName(name);
    const spinner = ora(`waking ${fmtAgentName(a)}…`).start();
    try {
      const r = await wakeAgent(a.id, opts.reason);
      spinner.succeed(`woke ${fmtAgentName(a)}${r.runId ? ` (run ${r.runId})` : ""}`);
    } catch (e) {
      spinner.fail(`wake failed: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  });

agentCommand
  .command("ask <name> <message...>")
  .description("Open an issue addressed to <name> with <message> as description, wake them, poll for their reply.")
  .option("--title <title>", "issue title (defaults to first 60 chars of message)")
  .option("--project <project>", "project slug or UUID")
  .option("--no-wait", "don't poll for the agent's first comment")
  .option("--timeout <seconds>", "poll timeout in seconds (default 300)", "300")
  .action(async (name: string, messageParts: string[], opts) => {
    const message = messageParts.join(" ").trim();
    if (!message) {
      throw new Error("message body cannot be empty");
    }
    const a = await findAgentByName(name);
    const title = opts.title || trunc(message, 60);

    const create = ora(`creating issue → ${fmtAgentName(a)}…`).start();
    let issue;
    try {
      issue = await createIssue({
        title,
        description: message,
        assigneeAgentId: a.id,
        status: "todo",
      });
      create.succeed(`created ${chalk.bold(issue.identifier)} → ${fmtAgentName(a)}`);
    } catch (e) {
      create.fail(`create failed: ${(e as Error).message}`);
      process.exitCode = 1;
      return;
    }

    // wake (assignment wakeup is auto, but force a manual one too)
    try {
      await wakeAgent(a.id, `assigned ${issue.identifier}`);
    } catch {
      // best-effort
    }

    if (opts.wait === false) {
      process.stdout.write(
        `\n${chalk.dim(`(skipping poll — fetch comments later with 'ut issue show ${issue.identifier}')`)}\n`
      );
      return;
    }

    const timeoutMs = Number(opts.timeout) * 1000;
    const deadline = Date.now() + timeoutMs;
    const poll = ora(`waiting for reply from ${fmtAgentName(a)}…`).start();
    const seenBefore = new Set<string>();
    // grab existing comments so we only print new ones
    try {
      const initial = await listIssueComments(issue.id);
      for (const c of initial) seenBefore.add(c.id);
    } catch {
      // ignore — empty thread on a fresh issue is the normal case
    }

    let latest = null as Awaited<ReturnType<typeof listIssueComments>>[number] | null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const [issueNow, comments] = await Promise.all([getIssue(issue.id), listIssueComments(issue.id)]);
        const newOnes = comments.filter((c) => !seenBefore.has(c.id) && c.authorAgentId === a.id);
        if (newOnes.length > 0) {
          latest = newOnes[newOnes.length - 1];
          break;
        }
        if (issueNow.status === "done" || issueNow.status === "blocked" || issueNow.status === "cancelled") {
          // status moved; show whatever we have
          const all = comments.filter((c) => c.authorAgentId === a.id);
          latest = all[all.length - 1] ?? null;
          break;
        }
        poll.text = `waiting for reply from ${fmtAgentName(a)} (${issueNow.status})…`;
      } catch (e) {
        poll.text = `waiting (${(e as Error).message})…`;
      }
    }

    if (latest) {
      poll.succeed(`reply from ${fmtAgentName(a)}`);
      process.stdout.write("\n" + chalk.bold(`${fmtAgentName(a)}:`) + "\n" + latest.body + "\n");
    } else {
      poll.warn(`no reply within ${opts.timeout}s — check 'ut issue show ${issue.identifier}'`);
      process.exitCode = 2;
    }
  });
