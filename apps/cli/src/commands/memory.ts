// intent: ut memory <search|recall|save>
// status: done
// next: wire AAAK encoding for `ut memory recall --aaak`
// confidence: high
//
// Talks directly to UltraThink Neon (option (b) in spec). We avoid importing
// from `memory/src/*` because the workspace publishes private package paths;
// inlining a tiny query keeps the CLI standalone-buildable.

import { Command } from "commander";
import chalk from "chalk";
import { neon } from "@neondatabase/serverless";
import { DATABASE_URL } from "../config.js";
import { fmtRelative, makeTable, printJson, trunc } from "../format.js";

function sql() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — cannot reach UltraThink Neon");
  }
  return neon(DATABASE_URL);
}

export const memoryCommand = new Command("memory").description("UltraThink memory — search, recall, save");

memoryCommand
  .command("search <query...>")
  .description("Hybrid tsvector + ILIKE search across the memory store")
  .option("--limit <n>", "max rows", "10")
  .option("--scope <scope>", "filter by scope (e.g. agent/core)")
  .option("--category <cat>", "filter by category")
  .option("--json", "machine-readable output")
  .action(async (queryParts: string[], opts) => {
    const query = queryParts.join(" ").trim();
    if (!query) throw new Error("query cannot be empty");
    const dbsql = sql();
    const limit = Number(opts.limit) || 10;
    const escaped = query.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const like = `%${escaped}%`;
    const rows = (await dbsql`
      SELECT id, scope, category, content, importance, created_at, accessed_at
      FROM memories
      WHERE (
        content ILIKE ${like}
        OR search_vector @@ plainto_tsquery('english', ${query})
      )
      AND (${opts.scope ?? null}::text IS NULL OR scope = ${opts.scope ?? null})
      AND (${opts.category ?? null}::text IS NULL OR category = ${opts.category ?? null})
      AND COALESCE(is_archived, FALSE) = FALSE
      ORDER BY importance DESC, created_at DESC
      LIMIT ${limit}
    `) as Array<{
      id: string;
      scope: string;
      category: string;
      content: string;
      importance: number;
      created_at: string;
      accessed_at: string | null;
    }>;
    if (opts.json) {
      printJson(rows);
      return;
    }
    if (rows.length === 0) {
      process.stdout.write(chalk.dim("(no matches)\n"));
      return;
    }
    const table = makeTable(["Scope", "Category", "Imp", "Content", "Created"]);
    for (const r of rows) {
      table.push([r.scope, r.category, String(r.importance), trunc(r.content, 80), fmtRelative(r.created_at)]);
    }
    process.stdout.write(table.toString() + "\n");
  });

memoryCommand
  .command("recall")
  .description("4-layer recall: L0 core + L1 essential + L2 context")
  .option("--scope <scope>", "narrow to wing or hall (e.g. agent or knowledge/decisions)")
  .option("--limit <n>", "rows per layer", "5")
  .option("--json", "machine-readable output")
  .action(async (opts) => {
    const dbsql = sql();
    const limit = Number(opts.limit) || 5;
    const layers = [0, 1, 2];
    const result: Record<string, unknown[]> = {};
    for (const layer of layers) {
      const rows = (await dbsql`
        SELECT id, scope, category, content, importance, created_at
        FROM memories
        WHERE layer = ${layer}
          AND COALESCE(is_archived, FALSE) = FALSE
          AND (${opts.scope ?? null}::text IS NULL OR scope LIKE ${opts.scope ? `${opts.scope}%` : null})
        ORDER BY importance DESC, accessed_at DESC NULLS LAST, created_at DESC
        LIMIT ${limit}
      `) as Array<{
        id: string;
        scope: string;
        category: string;
        content: string;
        importance: number;
        created_at: string;
      }>;
      result[`L${layer}`] = rows;
    }
    if (opts.json) {
      printJson(result);
      return;
    }
    const labels: Record<number, string> = {
      0: "L0 Core",
      1: "L1 Essential",
      2: "L2 Context",
    };
    for (const layer of layers) {
      const rows = result[`L${layer}`] as Array<{
        scope: string;
        category: string;
        content: string;
        importance: number;
      }>;
      process.stdout.write(`\n${chalk.bold(labels[layer])}\n`);
      if (rows.length === 0) {
        process.stdout.write(chalk.dim("  (empty)\n"));
        continue;
      }
      for (const r of rows) {
        process.stdout.write(
          `  ${chalk.dim(`[${r.scope}/${r.category} i${r.importance}]`)} ${trunc(r.content, 120)}\n`
        );
      }
    }
  });

memoryCommand
  .command("save <content...>")
  .description("Save a memory")
  .requiredOption("--scope <scope>", "wing/hall (e.g. knowledge/decisions)")
  .requiredOption("--category <cat>", "category (e.g. decision)")
  .option("--importance <n>", "1-10", "5")
  .option("--layer <l>", "0|1|2|3", "2")
  .action(async (contentParts: string[], opts) => {
    const content = contentParts.join(" ").trim();
    if (!content) throw new Error("content cannot be empty");
    const dbsql = sql();
    const rows = (await dbsql`
      INSERT INTO memories (scope, category, content, importance, layer)
      VALUES (${opts.scope}, ${opts.category}, ${content},
              ${Number(opts.importance)}, ${Number(opts.layer)})
      RETURNING id, created_at
    `) as Array<{ id: string; created_at: string }>;
    process.stdout.write(`saved ${rows[0].id}\n`);
  });
