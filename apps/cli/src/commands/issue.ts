// intent: ut issue <list|show|create|comment|assign|status>
// status: done
// next: support `ut issue list --me` once human-actor identity is wired in
// confidence: high

import { Command } from "commander";
import chalk from "chalk";
import {
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  listIssueComments,
  addIssueComment,
  listAgents,
  listProjects,
  getIssueDocument,
  type Agent,
} from "../api.js";
import { findAgentByName } from "./agent.js";
import { formatActor, colorAgent, colorStatus, fmtRelative, makeTable, printJson, trunc } from "../format.js";

function agentLabel(a: Agent | undefined | null): string {
  if (!a) return chalk.dim("—");
  return colorAgent(formatActor({ type: "agent", name: a.name, title: a.title, role: a.role }), a.role);
}

async function buildAgentMap(): Promise<Map<string, Agent>> {
  const all = await listAgents();
  const map = new Map<string, Agent>();
  for (const a of all) map.set(a.id, a);
  return map;
}

export const issueCommand = new Command("issue").description(
  "Issue operations — list, show, create, comment, assign, status"
);

issueCommand
  .command("list")
  .alias("ls")
  .description("List issues with filters")
  .option("--assignee <name>", "filter by agent name")
  .option("--status <status>", "filter by status (todo|in_progress|in_review|done|blocked|cancelled|backlog)")
  .option("--project <slug>", "filter by project slug or UUID")
  .option("--limit <n>", "max rows", "50")
  .option("--json", "machine-readable output")
  .action(async (opts) => {
    let assigneeAgentId: string | undefined;
    if (opts.assignee) {
      assigneeAgentId = (await findAgentByName(opts.assignee)).id;
    }
    let projectId: string | undefined;
    if (opts.project) {
      const projects = await listProjects();
      const slug = String(opts.project).toLowerCase();
      const proj = projects.find((p) => p.slug.toLowerCase() === slug || p.id === opts.project);
      if (!proj) {
        throw new Error(`no project matches "${opts.project}". Available: ${projects.map((p) => p.slug).join(", ")}`);
      }
      projectId = proj.id;
    }
    const issues = await listIssues({
      status: opts.status,
      assigneeAgentId,
      projectId,
      limit: Number(opts.limit),
    });
    if (opts.json) {
      printJson(issues);
      return;
    }
    if (issues.length === 0) {
      process.stdout.write(chalk.dim("(no issues)\n"));
      return;
    }
    const agents = await buildAgentMap();
    const table = makeTable(["ID", "Status", "Assignee", "Title", "Updated"]);
    for (const i of issues) {
      const assignee = i.assigneeAgentId ? agents.get(i.assigneeAgentId) : null;
      table.push([
        chalk.bold(i.identifier),
        colorStatus(i.status),
        agentLabel(assignee),
        trunc(i.title, 60),
        fmtRelative(i.updatedAt),
      ]);
    }
    process.stdout.write(table.toString() + "\n");
  });

issueCommand
  .command("show <identifier>")
  .description("Show full issue with thread, design-doc state, comments")
  .option("--json", "machine-readable output")
  .action(async (identifier: string, opts) => {
    const issue = await getIssue(identifier);
    const [comments, doc, agents] = await Promise.all([
      listIssueComments(issue.id).catch(() => []),
      getIssueDocument(issue.id).catch(() => null),
      buildAgentMap(),
    ]);
    if (opts.json) {
      printJson({ issue, comments, doc });
      return;
    }
    const assignee = issue.assigneeAgentId ? agents.get(issue.assigneeAgentId) : null;
    process.stdout.write(
      [
        `${chalk.bold(issue.identifier)}  ${colorStatus(issue.status)}  ${chalk.dim(`p:${issue.priority}`)}`,
        chalk.bold.white(issue.title),
        chalk.dim(issue.id),
        "",
        `${chalk.bold("Assignee:")} ${agentLabel(assignee)}`,
        `${chalk.bold("Updated:")}  ${fmtRelative(issue.updatedAt)}`,
        issue.description ? `\n${chalk.bold("Description")}\n${issue.description}` : "",
      ]
        .filter(Boolean)
        .join("\n") + "\n"
    );

    if (doc) {
      process.stdout.write(`\n${chalk.bold("Design-doc")}: revision ${doc.revision?.revisionNumber ?? "?"}\n`);
    } else {
      process.stdout.write(`\n${chalk.dim("Design-doc: (none)")}\n`);
    }

    if (comments.length > 0) {
      process.stdout.write(`\n${chalk.bold("Thread")}\n`);
      for (const c of comments) {
        const a = c.authorAgentId ? agents.get(c.authorAgentId) : null;
        const who = a ? agentLabel(a) : c.authorUserId ? `user:${c.authorUserId}` : "system";
        process.stdout.write(
          `  ${chalk.dim(fmtRelative(c.createdAt))}  ${who}\n  ${c.body.replace(/\n/g, "\n  ")}\n\n`
        );
      }
    }
  });

issueCommand
  .command("create <title>")
  .description("Create a new issue")
  .option("--assign <name>", "agent assignee")
  .option("--project <slug>", "project slug or UUID")
  .option("--description <text>", "issue body")
  .option("--status <status>", "initial status (default: backlog)")
  .option("--priority <p>", "priority (low|medium|high|urgent)")
  .option("--json", "machine-readable output")
  .action(async (title: string, opts) => {
    let assigneeAgentId: string | undefined;
    if (opts.assign) {
      assigneeAgentId = (await findAgentByName(opts.assign)).id;
    }
    let projectId: string | undefined;
    if (opts.project) {
      const projects = await listProjects();
      const slug = String(opts.project).toLowerCase();
      const proj = projects.find((p) => p.slug.toLowerCase() === slug || p.id === opts.project);
      if (!proj) throw new Error(`no project matches "${opts.project}"`);
      projectId = proj.id;
    }
    const issue = await createIssue({
      title,
      description: opts.description,
      assigneeAgentId,
      projectId,
      status: opts.status,
      priority: opts.priority,
    });
    if (opts.json) {
      printJson(issue);
      return;
    }
    process.stdout.write(`created ${chalk.bold(issue.identifier)} (${issue.id})\n`);
  });

issueCommand
  .command("comment <identifier> <body...>")
  .description("Add a comment to an issue")
  .action(async (identifier: string, bodyParts: string[]) => {
    const issue = await getIssue(identifier);
    const body = bodyParts.join(" ").trim();
    if (!body) throw new Error("comment body cannot be empty");
    const c = await addIssueComment(issue.id, body);
    process.stdout.write(`commented ${issue.identifier} (${c.id})\n`);
  });

issueCommand
  .command("assign <identifier> <name>")
  .description("Reassign issue to <name>")
  .action(async (identifier: string, name: string) => {
    const issue = await getIssue(identifier);
    const agent = await findAgentByName(name);
    await updateIssue(issue.id, { assigneeAgentId: agent.id });
    process.stdout.write(
      `assigned ${chalk.bold(issue.identifier)} → ${formatActor({ type: "agent", name: agent.name, title: agent.title, role: agent.role })}\n`
    );
  });

issueCommand
  .command("status <identifier> <status>")
  .description("Change issue status (todo|in_progress|in_review|done|blocked|cancelled|backlog)")
  .action(async (identifier: string, status: string) => {
    const issue = await getIssue(identifier);
    await updateIssue(issue.id, { status });
    process.stdout.write(`${chalk.bold(issue.identifier)} → ${colorStatus(status)}\n`);
  });
