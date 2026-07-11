// intent: ut chat — interactive REPL over the bipartite team
// status: done
// next: tab-complete @-names; /history INU-N; per-agent live cost meters
// confidence: high
//
// REPL contract (see apps/cli/README.md):
//   ut> @<name> <message>     -> create or continue a thread with that agent
//   ut> <message>             -> comment on the active issue
//   ut> /quit /agents /status /issue /help
//
// Agent replies arrive asynchronously. Each in-flight thread runs a poll loop
// that, on a new comment, clears the current readline line, prints the reply,
// and re-emits the prompt + buffered user input. No TUI dep — plain stdout.

import readline from "node:readline";
import { Command } from "commander";
import chalk from "chalk";
import {
  listAgents,
  getAgent,
  wakeAgent,
  createIssue,
  addIssueComment,
  listIssueComments,
  getIssue,
  type Agent,
  type Issue,
  type IssueComment,
} from "../api.js";
import { findAgentByName } from "./agent.js";
import { buildDryThread } from "./chat-dry.js";
import { parseMentions, parseSlash, type Mention } from "./chat-parse.js";
import { formatActor, colorAgent, colorStatus, fmtCents, fmtRelative, makeTable, trunc } from "../format.js";

/* ─── State types ─────────────────────────────────────────────── */

interface ChatThread {
  agent: Agent;
  issue: Issue;
  lastActivityAt: number;
  seenCommentIds: Set<string>;
  pollHandle: ReturnType<typeof setInterval> | null;
}

interface ChatState {
  threadByAgent: Map<string, ChatThread>; // key: agent.name.toLowerCase()
  threadByIssue: Map<string, ChatThread>; // key: issue.id
  activeIssueId: string | null;
  rl: readline.Interface;
  dryRun: boolean;
  pollMs: number;
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function fmtAgent(a: Agent): string {
  return formatActor({ type: "agent", name: a.name, title: a.title, role: a.role });
}

function colored(a: Agent): string {
  return colorAgent(fmtAgent(a), a.role);
}

/**
 * Tear down the readline prompt, write a line of output, then re-print
 * the prompt and any text the user has typed but not yet submitted.
 */
function printAsync(rl: readline.Interface, line: string): void {
  // rl.line is the public readline buffer of the in-progress input.
  const closed = (rl as readline.Interface & { closed?: boolean }).closed === true;
  if (closed) {
    process.stdout.write(line + "\n");
    return;
  }
  const buf = (rl as readline.Interface & { line?: string }).line ?? "";
  readline.cursorTo(process.stdout, 0);
  readline.clearLine(process.stdout, 0);
  process.stdout.write(line + "\n");
  try {
    rl.prompt(true);
  } catch {
    // readline closed mid-print — drop the prompt redraw, keep going.
    return;
  }
  if (buf) process.stdout.write(buf);
}

/**
 * Poll an issue's comments, fire callback for each new comment authored by
 * the assigned agent. Returns the interval handle.
 */
function startThreadPoll(state: ChatState, thread: ChatThread): ReturnType<typeof setInterval> {
  const handle = setInterval(async () => {
    try {
      const comments = await listIssueComments(thread.issue.id);
      const newOnes = comments.filter((c) => !thread.seenCommentIds.has(c.id) && c.authorAgentId === thread.agent.id);
      for (const c of newOnes) {
        thread.seenCommentIds.add(c.id);
        thread.lastActivityAt = Date.now();
        printReply(state, thread, c);
      }
      // also track all comments so we don't re-print across cycles
      for (const c of comments) thread.seenCommentIds.add(c.id);
    } catch {
      // swallow — poll keeps trying. Network blip is normal.
    }
  }, state.pollMs);
  return handle;
}

function printReply(state: ChatState, thread: ChatThread, c: IssueComment): void {
  const tag = chalk.bold(`[${colored(thread.agent)}]`);
  const issueTag = chalk.dim(`(${thread.issue.identifier})`);
  printAsync(state.rl, `${tag} ${issueTag} ${c.body}`);
}

/* ─── Slash command handlers ──────────────────────────────────── */

function cmdHelp(state: ChatState): void {
  const lines = [
    "",
    chalk.bold("Slash commands"),
    "  /help              Show this message",
    "  /agents            List active conversations",
    "  /status            Show all agents (idle, last run, budget)",
    "  /issue <INU-N>     Set the active issue context (for plain-text replies)",
    "  /issue             Show the active issue",
    "  /quit              Exit chat",
    "",
    chalk.bold("Mentions"),
    "  @<name> <msg>      Create new thread or comment on the existing one",
    "  @<a> ... @<b> ...  Fan out to multiple agents in parallel",
    "  <plain text>       Comment on the active issue",
    "",
    state.dryRun ? chalk.yellow("DRY-RUN MODE: nothing is sent to Paperclip.") : "",
  ];
  for (const l of lines.filter(Boolean)) printAsync(state.rl, l);
}

function cmdAgents(state: ChatState): void {
  const threads = [...state.threadByAgent.values()];
  if (threads.length === 0) {
    printAsync(state.rl, chalk.dim("  (no active conversations — use @<name> <msg> to start one)"));
    return;
  }
  printAsync(state.rl, chalk.bold("Active conversations:"));
  for (const t of threads) {
    const ago = fmtRelative(new Date(t.lastActivityAt).toISOString());
    const marker = t.issue.id === state.activeIssueId ? chalk.green(" *") : "  ";
    printAsync(
      state.rl,
      `  ${marker} ${t.issue.identifier} with ${colored(t.agent)}   ${chalk.dim(`(last activity ${ago})`)}`
    );
  }
}

async function cmdStatus(state: ChatState): Promise<void> {
  if (state.dryRun) {
    printAsync(state.rl, chalk.yellow("  [dry-run] /status would call Paperclip — skipped"));
    return;
  }
  let agents: Agent[];
  try {
    agents = await listAgents();
  } catch (e) {
    printAsync(state.rl, chalk.red(`status failed: ${(e as Error).message}`));
    return;
  }
  const t = makeTable(["Agent", "Status", "Last HB", "Spent / Budget"]);
  for (const a of agents) {
    t.push([
      colorAgent(fmtAgent(a), a.role),
      colorStatus(a.status),
      fmtRelative(a.lastHeartbeatAt),
      `${fmtCents(a.spentMonthlyCents)} / ${fmtCents(a.budgetMonthlyCents)}`,
    ]);
  }
  // table.toString() is multi-line — split so printAsync re-prompts cleanly at end.
  const rendered = t.toString();
  for (const line of rendered.split("\n")) printAsync(state.rl, line);
}

async function cmdIssue(state: ChatState, arg: string | undefined): Promise<void> {
  if (!arg) {
    if (!state.activeIssueId) {
      printAsync(state.rl, chalk.dim("  no active issue — set with /issue INU-N"));
      return;
    }
    const t = state.threadByIssue.get(state.activeIssueId);
    if (t) {
      printAsync(state.rl, `  active: ${t.issue.identifier} with ${colored(t.agent)}`);
    } else {
      printAsync(state.rl, `  active: ${state.activeIssueId}`);
    }
    return;
  }
  // Try by issue identifier (INU-N) or UUID
  if (state.dryRun) {
    printAsync(state.rl, chalk.yellow(`  [dry-run] would set active issue = ${arg}`));
    state.activeIssueId = arg;
    return;
  }
  try {
    const issue = await getIssue(arg);
    state.activeIssueId = issue.id;
    // if we don't already have a thread for this issue, attach one
    if (!state.threadByIssue.has(issue.id) && issue.assigneeAgentId) {
      try {
        const agent = await getAgent(issue.assigneeAgentId);
        await attachThread(state, agent, issue);
      } catch {
        // ignore — we still set activeIssueId
      }
    }
    printAsync(state.rl, `  active issue → ${chalk.bold(issue.identifier)}`);
  } catch (e) {
    printAsync(state.rl, chalk.red(`  /issue: ${(e as Error).message}`));
  }
}

/* ─── Thread lifecycle ────────────────────────────────────────── */

async function attachThread(state: ChatState, agent: Agent, issue: Issue): Promise<ChatThread> {
  const existing = state.threadByIssue.get(issue.id);
  if (existing) return existing;
  const seen = new Set<string>();
  try {
    const initial = await listIssueComments(issue.id);
    for (const c of initial) seen.add(c.id);
  } catch {
    // empty ok
  }
  const thread: ChatThread = {
    agent,
    issue,
    lastActivityAt: Date.now(),
    seenCommentIds: seen,
    pollHandle: null,
  };
  state.threadByAgent.set(agent.name.toLowerCase(), thread);
  state.threadByIssue.set(issue.id, thread);
  thread.pollHandle = startThreadPoll(state, thread);
  return thread;
}

async function dispatchMention(state: ChatState, mention: Mention): Promise<void> {
  if (!mention.message) {
    printAsync(state.rl, chalk.red(`  @${mention.name}: empty message — give me something to say.`));
    return;
  }

  // dry-run path: pure parse-and-echo, no network calls. Synthesize a fake
  // thread so repeat mentions of the same name look like a continuation.
  if (state.dryRun) {
    const label = `@${mention.name}`;
    const key = mention.name.toLowerCase();
    const existing = state.threadByAgent.get(key);
    if (existing) {
      printAsync(
        state.rl,
        chalk.yellow(`  [dry-run] would comment on ${existing.issue.identifier} → ${label}: ${mention.message}`)
      );
    } else {
      const { agent, issue } = buildDryThread(mention.name, mention.message, state.threadByAgent.size + 1);
      const thread: ChatThread = {
        agent,
        issue,
        lastActivityAt: Date.now(),
        seenCommentIds: new Set(),
        pollHandle: null,
      };
      state.threadByAgent.set(key, thread);
      state.threadByIssue.set(issue.id, thread);
      state.activeIssueId = issue.id;
      printAsync(
        state.rl,
        chalk.yellow(`  [dry-run] would create ${issue.identifier} → ${label}: "${trunc(mention.message, 60)}"`)
      );
    }
    return;
  }

  // resolve agent
  let agent: Agent;
  try {
    agent = await findAgentByName(mention.name);
  } catch (e) {
    printAsync(state.rl, chalk.red(`  ${(e as Error).message}`));
    return;
  }

  const key = agent.name.toLowerCase();
  const existing = state.threadByAgent.get(key);

  if (existing) {
    // continue the existing thread
    try {
      await addIssueComment(existing.issue.id, mention.message);
      existing.lastActivityAt = Date.now();
      state.activeIssueId = existing.issue.id;
      printAsync(state.rl, chalk.dim(`  → comment posted on ${existing.issue.identifier}`));
      // best-effort wake
      wakeAgent(agent.id, `comment on ${existing.issue.identifier}`).catch(() => undefined);
    } catch (e) {
      printAsync(state.rl, chalk.red(`  comment failed: ${(e as Error).message}`));
    }
    return;
  }

  // new thread: create issue, wake agent, attach poll
  try {
    const issue = await createIssue({
      title: trunc(mention.message, 60),
      description: mention.message,
      assigneeAgentId: agent.id,
      status: "todo",
    });
    const thread = await attachThread(state, agent, issue);
    state.activeIssueId = issue.id;
    printAsync(state.rl, chalk.dim(`  → created ${chalk.bold(thread.issue.identifier)} → ${colored(agent)}`));
    wakeAgent(agent.id, `assigned ${issue.identifier}`).catch(() => undefined);
  } catch (e) {
    printAsync(state.rl, chalk.red(`  create failed: ${(e as Error).message}`));
  }
}

async function dispatchPlainText(state: ChatState, line: string): Promise<void> {
  if (!state.activeIssueId) {
    printAsync(
      state.rl,
      chalk.red("  no active conversation — start one with @<name> <message> or pick one with /issue INU-N")
    );
    return;
  }
  const thread = state.threadByIssue.get(state.activeIssueId);
  if (state.dryRun) {
    const tag = thread ? colored(thread.agent) : state.activeIssueId;
    printAsync(state.rl, chalk.yellow(`  [dry-run] would comment on ${state.activeIssueId} → ${tag}: ${line}`));
    return;
  }
  if (!thread) {
    printAsync(state.rl, chalk.red("  active issue has no attached thread — use /issue <INU-N> to refresh"));
    return;
  }
  try {
    await addIssueComment(thread.issue.id, line);
    thread.lastActivityAt = Date.now();
    printAsync(state.rl, chalk.dim(`  → comment posted on ${thread.issue.identifier}`));
    wakeAgent(thread.agent.id, `comment on ${thread.issue.identifier}`).catch(() => undefined);
  } catch (e) {
    printAsync(state.rl, chalk.red(`  comment failed: ${(e as Error).message}`));
  }
}

/* ─── Line dispatcher ─────────────────────────────────────────── */

async function handleLine(state: ChatState, raw: string): Promise<boolean /* keep going */> {
  const line = raw.trim();
  if (!line) return true;

  const slash = parseSlash(line);
  if (slash) {
    switch (slash.cmd) {
      case "quit":
      case "q":
      case "exit":
        return false;
      case "help":
      case "?":
        cmdHelp(state);
        return true;
      case "agents":
        cmdAgents(state);
        return true;
      case "status":
        await cmdStatus(state);
        return true;
      case "issue":
        await cmdIssue(state, slash.arg || undefined);
        return true;
      default:
        printAsync(state.rl, chalk.red(`  unknown command /${slash.cmd} — try /help`));
        return true;
    }
  }

  // mentions
  const mentions = parseMentions(line);
  if (mentions.length > 0) {
    // fan out in parallel
    await Promise.all(mentions.map((m) => dispatchMention(state, m)));
    return true;
  }

  // plain text — comment on active issue
  await dispatchPlainText(state, line);
  return true;
}

/* ─── REPL entrypoint ─────────────────────────────────────────── */

interface ChatOptions {
  dryRun?: boolean;
  pollMs?: number;
}

async function runChat(opts: ChatOptions): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan("ut> "),
    terminal: process.stdin.isTTY === true,
  });

  const state: ChatState = {
    threadByAgent: new Map(),
    threadByIssue: new Map(),
    activeIssueId: null,
    rl,
    dryRun: opts.dryRun ?? false,
    pollMs: opts.pollMs ?? 5000,
  };

  // banner
  process.stdout.write(chalk.bold("ut chat") + chalk.dim(" — type /help for commands, /quit to exit\n"));
  if (state.dryRun) {
    process.stdout.write(chalk.yellow("dry-run mode: no API writes will occur\n"));
  }

  rl.prompt();

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const t of state.threadByIssue.values()) {
      if (t.pollHandle) clearInterval(t.pollHandle);
    }
    rl.close();
  };

  // Serialize line handling so async work (network calls) finishes before
  // we read the next line — otherwise piped input racing `/quit` produces
  // out-of-order output.
  let pending: Promise<void> = Promise.resolve();
  rl.on("line", (raw) => {
    pending = pending.then(async () => {
      if (shuttingDown) return;
      let keep = true;
      try {
        keep = await handleLine(state, raw);
      } catch (e) {
        printAsync(rl, chalk.red(`  error: ${(e as Error).message}`));
      }
      if (!keep) {
        shutdown();
        return;
      }
      if (!shuttingDown) rl.prompt();
    });
  });

  rl.on("close", () => {
    shutdown();
    process.stdout.write(chalk.dim("bye\n"));
  });

  rl.on("SIGINT", () => {
    process.stdout.write("\n");
    shutdown();
  });

  // resolve when readline closes
  await new Promise<void>((resolve) => {
    rl.once("close", () => resolve());
  });
}

/* ─── Commander wiring ────────────────────────────────────────── */

export const chatCommand = new Command("chat")
  .description("Interactive REPL for orchestrating one or many bipartite agents from the terminal.")
  .option("--dry-run", "parse & echo what would happen but don't hit Paperclip", false)
  .option("--poll-ms <ms>", "agent reply poll interval (default 5000)", "5000")
  .action(async (opts: { dryRun?: boolean; pollMs?: string }) => {
    await runChat({
      dryRun: !!opts.dryRun,
      pollMs: Number(opts.pollMs ?? 5000),
    });
  });
