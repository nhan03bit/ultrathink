// intent: actor-formatting + table rendering helpers
// status: done
// next: dim system actor; unicode badges for status
// confidence: high
//
// formatActor mirrors dashboard/lib/actor.ts so all surfaces print
// `Name [Title]` for agents and `Name` for humans/system.

import chalk from "chalk";
import Table from "cli-table3";

export type ActorLike =
  | { type: "agent"; name: string; title?: string | null; role?: string | null }
  | { type: "human"; name: string }
  | { type: "system" };

export function formatActor(actor: ActorLike): string {
  if (actor.type === "agent") {
    const t = actor.title?.trim();
    return t ? `${actor.name} [${t}]` : actor.name;
  }
  if (actor.type === "human") return actor.name;
  return "system";
}

const ROLE_COLORS: Record<string, (s: string) => string> = {
  ceo: chalk.bold.magenta,
  cto: chalk.bold.cyan,
  qa: chalk.bold.yellow,
  devops: chalk.bold.green,
  engineer: chalk.bold.blue,
};

export function colorAgent(name: string, role: string | null | undefined): string {
  if (!role) return name;
  const colorFn = ROLE_COLORS[role.toLowerCase()];
  return colorFn ? colorFn(name) : name;
}

const STATUS_COLORS: Record<string, (s: string) => string> = {
  // agent statuses
  idle: chalk.gray,
  running: chalk.green,
  paused: chalk.yellow,
  error: chalk.red,
  // issue statuses
  backlog: chalk.gray,
  todo: chalk.cyan,
  in_progress: chalk.blue,
  in_review: chalk.magenta,
  done: chalk.green,
  blocked: chalk.red,
  cancelled: chalk.dim,
};

export function colorStatus(status: string): string {
  const fn = STATUS_COLORS[status.toLowerCase()];
  return fn ? fn(status) : status;
}

export function trunc(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function fmtCents(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function makeTable(headers: string[]): Table.Table {
  return new Table({
    head: headers.map((h) => chalk.bold(h)),
    style: { head: [], border: ["gray"] },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "╭",
      "top-right": "╮",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "╰",
      "bottom-right": "╯",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  });
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function printError(msg: string): void {
  process.stderr.write(chalk.red(`error: ${msg}`) + "\n");
}
