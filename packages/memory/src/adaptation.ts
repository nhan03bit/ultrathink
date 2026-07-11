/**
 * Tekiō — Cycle of Nova (適応)
 *
 * Inspired by Mahoraga's wheel of adaptation: "If the General is hit by
 * a particular attack, the wheel turns once the attack is analyzed,
 * and Mahoraga adapts."
 *
 * Unlike Mahoraga's limited 8 wheel spins, Tekiō has NO limit.
 * Every failure triggers a nova — an explosion of insight.
 * The wheel turns, a new adaptation is forged, and the same mistake
 * never happens twice. Infinite cycles. Infinite growth.
 *
 * Four adaptation types (evolved beyond Mahoraga):
 *   defensive  — become immune to a known failure pattern
 *   auxiliary   — improve perception (detect issues before they happen)
 *   offensive   — modify approach to bypass obstacles
 *   learning    — absorb successful new patterns (first-time approaches that worked)
 *
 * Evaluation logic: EVERY interaction is evaluated.
 *   - New pattern → turn the wheel (learn)
 *   - Already known → skip (no duplicate)
 *   - Failure → always turn the wheel (counter-strategy)
 *   - Success confirmation → turn the wheel (reinforce)
 */

import type { SqlClient } from "./client.js";

export interface Adaptation {
  id: string;
  trigger_pattern: string;
  adaptation_rule: string;
  source_failure: string | null;
  category: "defensive" | "auxiliary" | "offensive" | "learning";
  severity: number;
  scope: string | null;
  times_applied: number;
  times_prevented: number;
  created_at: string;
  last_applied_at: string | null;
  is_active: boolean;
  tags: string[];
}

export interface FailureEvent {
  error: string;
  context: string;
  tool?: string;
  scope?: string;
  exitCode?: number;
}

// ── Failure Fingerprinting ──────────────────────────────────────────
// Normalize errors to find patterns (strip paths, IDs, timestamps)

function normalizeError(error: string): string {
  return error
    .replace(/\/Users\/[^\s]+/g, "<PATH>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<UUID>")
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<TIMESTAMP>")
    .replace(/:\d{4,5}/g, ":<PORT>")
    .replace(/line \d+/gi, "line <N>")
    .replace(/column \d+/gi, "column <N>")
    .replace(/\d+\.\d+\.\d+/g, "<VERSION>")
    .trim()
    .slice(0, 300);
}

function extractTriggerPattern(failure: FailureEvent): string {
  const normalized = normalizeError(failure.error);

  // Known pattern categories → specific, reusable triggers
  if (normalized.includes("Top-level await") && normalized.includes("cjs")) {
    return "top-level await in tsx -e inline execution";
  }
  if (normalized.includes("is not a function")) {
    const match = normalized.match(/(\w+) is not a function/);
    return match ? `calling non-existent method: ${match[1]}` : "calling non-existent method";
  }
  if (normalized.includes("Cannot find module")) {
    const modMatch = normalized.match(/Cannot find module '([^']+)'/);
    return modMatch ? `module not found: ${modMatch[1]}` : "module not found";
  }
  if (normalized.includes("does not exist") && !normalized.includes("relation")) {
    return `file or path does not exist`;
  }
  if (normalized.includes("EISDIR")) {
    return "attempting to read a directory as a file";
  }
  if (normalized.includes("permission denied") || normalized.includes("EACCES")) {
    return "file permission denied";
  }
  if (normalized.includes("relation") && normalized.includes("does not exist")) {
    const relMatch = normalized.match(/relation "([^"]+)"/);
    return relMatch ? `querying non-existent table: ${relMatch[1]}` : "querying non-existent database table or column";
  }
  if (normalized.includes("syntax error")) {
    // Extract the language/context for specificity
    const lang = failure.tool === "Bash" ? "shell" : "code";
    return `${lang} syntax error in ${failure.tool || "unknown"}`;
  }
  if (normalized.includes("type") && normalized.includes("not assignable")) {
    return `TypeScript type mismatch: ${normalized.slice(0, 120)}`;
  }
  if (normalized.includes("ENOENT")) {
    return "path does not exist (ENOENT)";
  }
  if (normalized.includes("ECONNREFUSED")) {
    return "connection refused — service not running";
  }
  if (normalized.includes("timeout") || normalized.includes("ETIMEDOUT")) {
    return "operation timed out";
  }

  // Build a trigger from the first meaningful line — but cap at 80 chars
  // to prevent full error messages from becoming triggers (they never match again)
  const firstLine = normalized.split("\n")[0].slice(0, 80);

  // If the first line is too generic (< 20 useful chars), return tool-prefixed
  const stripped = firstLine.replace(/[^a-zA-Z ]/g, "").trim();
  if (stripped.length < 20) {
    return `${failure.tool || "unknown"}: ${firstLine}`;
  }

  // Extract the core error pattern (strip paths, UUIDs, specific values)
  const cleanTrigger = firstLine
    .replace(/<PATH>/g, "")
    .replace(/<UUID>/g, "")
    .replace(/<PORT>/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return `${failure.tool || "unknown"}: ${cleanTrigger}`;
}

/**
 * Check if a failure is worth learning from.
 * Returns false for noise that would pollute the adaptation database.
 */
function isWorthLearning(failure: FailureEvent): boolean {
  const err = failure.error.toLowerCase();

  // Too short to be meaningful
  if (err.length < 15) return false;

  // Generic exit codes with no context
  if (err === "exit code 1" || err === "unknown error") return false;

  // Inline script parse errors (user experimentation)
  if (err.includes('file "<string>"') || err.includes('file "<stdin>"')) return false;

  // Transient network issues — not learnable
  if (/econnrefused|etimedout|enotfound|503|502|504/.test(err)) return false;

  // JSON parse failures from piped commands — too context-dependent
  if (err.includes("expecting value: line 1") && err.includes("char 0")) return false;

  // MCP tool errors — usually transient or tool-specific, not generalizable
  if (/mcp error -\d+|ipc server was disposed/.test(err)) return false;

  // Full error messages that are too specific to ever match again (>200 chars of raw output)
  const firstLine = err.split("\n")[0];
  if (firstLine.length > 200) return false;

  return true;
}

// ── Adaptation Classification ───────────────────────────────────────

function classifyAdaptation(failure: FailureEvent): "defensive" | "auxiliary" | "offensive" {
  const err = failure.error.toLowerCase();

  // Defensive: prevent the failure from happening
  if (
    err.includes("not a function") ||
    err.includes("does not exist") ||
    err.includes("permission denied") ||
    err.includes("top-level await") ||
    err.includes("syntax error")
  ) {
    return "defensive";
  }

  // Auxiliary: improve detection/perception
  if (
    err.includes("cannot find") ||
    err.includes("no such file") ||
    err.includes("eisdir") ||
    err.includes("unknown")
  ) {
    return "auxiliary";
  }

  // Offensive: change approach to overcome
  return "offensive";
}

function generateAdaptationRule(trigger: string, failure: FailureEvent): string {
  // Known failure → known solution mappings
  const knownRules: Record<string, string> = {
    "top-level await in tsx -e inline execution":
      "NEVER use `npx tsx -e` with top-level await. Always create a separate .ts script file in memory/scripts/ and run it with `npx tsx <file>`.",
    "attempting to read a directory as a file":
      "Before reading a path, verify it's a file not a directory. Use `ls` or check the path ends with a file extension.",
    "file permission denied":
      "Check file permissions before writing. Use `ls -la` to verify. If needed, use chmod but confirm with user first.",
    "path does not exist (ENOENT)":
      "Verify the file/directory exists before operating on it. Use `ls` or `test -f` to check first.",
    "connection refused — service not running":
      "Check if the required service is running before connecting. Use `lsof -i :<port>` to verify.",
    "operation timed out":
      "Add timeout handling and retry logic. Consider if the target service is healthy before retrying.",
  };

  if (knownRules[trigger]) return knownRules[trigger];

  // Pattern-based rule generation — extract actionable advice from the error
  const tool = failure.tool || "unknown";
  const err = normalizeError(failure.error);

  // Module not found → check imports
  if (trigger.startsWith("module not found:")) {
    const mod = trigger.replace("module not found: ", "");
    return `Module "${mod}" not found. Verify the package is installed (check package.json) and the import path is correct before using it.`;
  }

  // Non-existent method → check API
  if (trigger.startsWith("calling non-existent method:")) {
    const method = trigger.replace("calling non-existent method: ", "");
    return `Method "${method}" does not exist on the target object. Check the API docs or source to find the correct method name.`;
  }

  // Table not found → check schema
  if (trigger.startsWith("querying non-existent table:")) {
    const table = trigger.replace("querying non-existent table: ", "");
    return `Table "${table}" does not exist. Check the database schema before querying. Run migrations if needed.`;
  }

  // Type mismatch → check types
  if (trigger.includes("TypeScript type mismatch")) {
    return `Type mismatch in ${tool}. Read the type definitions before assigning values. Use the existing types from the codebase rather than casting.`;
  }

  // Syntax error → check language
  if (trigger.includes("syntax error")) {
    return `Syntax error when using ${tool}. Double-check the command/code syntax. For shell commands, test with a simpler version first.`;
  }

  // Contextual fallback — build a specific instruction from the trigger
  if (trigger.includes("not found") || trigger.includes("does not exist")) {
    return `[${tool}] Verify the target exists before this operation. Check paths, table names, or module names.`;
  }
  if (trigger.includes("timeout") || trigger.includes("timed out")) {
    return `[${tool}] Operation timed out. Use a simpler or more targeted approach, or check if the service is running.`;
  }
  if (trigger.includes("permission") || trigger.includes("denied") || trigger.includes("EACCES")) {
    return `[${tool}] Permission denied. Check file permissions with ls -la before retrying.`;
  }
  // Last resort — but make it actionable, not template-soup
  return `[${tool}] Failed: "${trigger}". Read the error output, identify the root cause, and fix the specific issue before retrying.`;
}

// ── Core Operations ─────────────────────────────────────────────────

/**
 * Find adaptations that match a failure pattern.
 * Uses tsvector + trigram for fuzzy matching.
 */
export async function findMatchingAdaptations(sql: SqlClient, failure: FailureEvent): Promise<Adaptation[]> {
  const trigger = extractTriggerPattern(failure);

  // Tier 1: exact trigger match (most reliable)
  const exactResults = await sql`
    SELECT * FROM adaptations
    WHERE is_active = true
      AND trigger_pattern = ${trigger}
    LIMIT 1
  `;

  if (exactResults.length > 0) return exactResults as unknown as Adaptation[];

  // Tier 2: tsvector full-text match
  const tsResults = await sql`
    SELECT *, ts_rank(to_tsvector('english', trigger_pattern), plainto_tsquery('english', ${trigger})) as rank
    FROM adaptations
    WHERE is_active = true
      AND to_tsvector('english', trigger_pattern) @@ plainto_tsquery('english', ${trigger})
    ORDER BY rank DESC, times_applied DESC
    LIMIT 3
  `;

  if (tsResults.length > 0) return tsResults as unknown as Adaptation[];

  // Tier 3: trigram fuzzy match — threshold 0.5 (strict, prevents false positives)
  const trgmResults = await sql`
    SELECT *, similarity(trigger_pattern, ${trigger}) as sim
    FROM adaptations
    WHERE is_active = true
      AND similarity(trigger_pattern, ${trigger}) > 0.5
    ORDER BY sim DESC
    LIMIT 2
  `;

  return trgmResults as unknown as Adaptation[];
}

/**
 * Nova Ignites — analyze a failure and create/apply an adaptation.
 * Returns the adaptation that was created or applied.
 */
export async function wheelTurn(
  sql: SqlClient,
  failure: FailureEvent
): Promise<{ adaptation: Adaptation; isNew: boolean; wheelSpin: number } | null> {
  // Quality gate: skip noise that would produce useless adaptations
  if (!isWorthLearning(failure)) {
    return null;
  }

  const trigger = extractTriggerPattern(failure);

  // Second quality gate: trigger too short/generic to be useful
  const triggerWords = trigger
    .replace(/[^a-zA-Z ]/g, "")
    .trim()
    .split(/\s+/);
  if (triggerWords.length < 3) {
    return null;
  }

  const existing = await findMatchingAdaptations(sql, failure);

  if (existing.length > 0) {
    // Adaptation exists — apply it (increment counter)
    const adaptation = existing[0];
    await sql`
      UPDATE adaptations
      SET times_applied = times_applied + 1,
          last_applied_at = NOW()
      WHERE id = ${adaptation.id}
    `;

    const [{ count }] = await sql`SELECT COUNT(*) as count FROM adaptations`;

    return {
      adaptation: { ...adaptation, times_applied: adaptation.times_applied + 1 },
      isNew: false,
      wheelSpin: Number(count),
    };
  }

  // No adaptation exists — the wheel turns, a nova ignites
  const category = classifyAdaptation(failure);
  const rule = generateAdaptationRule(trigger, failure);
  const severity =
    failure.exitCode === undefined
      ? 5
      : failure.exitCode === 127
        ? 8
        : failure.exitCode === 126
          ? 7
          : failure.exitCode >= 2
            ? 6
            : 5;

  const [created] = await sql`
    INSERT INTO adaptations (trigger_pattern, adaptation_rule, source_failure, category, severity, scope, tags)
    VALUES (
      ${trigger},
      ${rule},
      ${failure.error.slice(0, 500)},
      ${category},
      ${severity},
      ${failure.scope || null},
      ${[failure.tool || "unknown", category]}
    )
    RETURNING *
  `;

  const [{ count }] = await sql`SELECT COUNT(*) as count FROM adaptations`;

  return {
    adaptation: created as unknown as Adaptation,
    isNew: true,
    wheelSpin: Number(count),
  };
}

/**
 * Record a prevented failure — the adaptation successfully stopped a repeat.
 */
export async function recordPrevention(sql: SqlClient, adaptationId: string): Promise<void> {
  await sql`
    UPDATE adaptations
    SET times_prevented = times_prevented + 1,
        last_applied_at = NOW()
    WHERE id = ${adaptationId}
  `;
}

/**
 * Get all active adaptations for injection into session context.
 * These are the hard-earned lessons — rules that must be followed.
 */
export async function getActiveAdaptations(sql: SqlClient, scope?: string): Promise<Adaptation[]> {
  // When scope is provided: return global (NULL) + project-scoped adaptations
  // When scope is omitted: return ALL active adaptations (global + all scopes)
  const adaptations = scope
    ? await sql`
        SELECT * FROM adaptations
        WHERE is_active = true
          AND (scope IS NULL OR scope = ${scope})
        ORDER BY severity DESC, times_applied DESC
        LIMIT 30
      `
    : await sql`
        SELECT * FROM adaptations
        WHERE is_active = true
        ORDER BY severity DESC, times_applied DESC
        LIMIT 30
      `;
  return adaptations as unknown as Adaptation[];
}

/**
 * Format adaptations for context injection.
 * This is the "wheel state" — visible to Claude as hard rules.
 */
export function formatAdaptations(adaptations: Adaptation[]): string {
  if (adaptations.length === 0) return "";

  const lines: string[] = [
    `\n## ☸ Tekiō — Cycle of Nova (${adaptations.length} adaptations | wheel spins: ∞)`,
    "The wheel evaluates EVERY interaction. New → learn. Known → skip. Failure → counter.",
    "These are hard rules forged from experience. The wheel has turned — follow these:\n",
  ];

  // Group by category
  const defensive = adaptations.filter((a) => a.category === "defensive");
  const auxiliary = adaptations.filter((a) => a.category === "auxiliary");
  const offensive = adaptations.filter((a) => a.category === "offensive");
  const learning = adaptations.filter((a) => a.category === "learning");

  if (defensive.length > 0) {
    lines.push("**Defensive (immunity) — NEVER repeat these:**");
    for (const a of defensive) {
      const applied = a.times_applied > 0 ? ` [applied ${a.times_applied}x]` : "";
      const prevented = a.times_prevented > 0 ? ` [prevented ${a.times_prevented}x]` : "";
      lines.push(`- ${a.adaptation_rule}${applied}${prevented}`);
    }
  }

  if (auxiliary.length > 0) {
    lines.push("\n**Auxiliary (perception) — detect before they happen:**");
    for (const a of auxiliary) {
      const applied = a.times_applied > 0 ? ` [applied ${a.times_applied}x]` : "";
      lines.push(`- ${a.adaptation_rule}${applied}`);
    }
  }

  if (offensive.length > 0) {
    lines.push("\n**Offensive (approach) — preferred strategies:**");
    for (const a of offensive) {
      const applied = a.times_applied > 0 ? ` [applied ${a.times_applied}x]` : "";
      lines.push(`- ${a.adaptation_rule}${applied}`);
    }
  }

  if (learning.length > 0) {
    lines.push("\n**Learning (absorbed patterns) — reuse what works:**");
    for (const a of learning) {
      const applied = a.times_applied > 0 ? ` [${a.times_applied}x]` : "";
      lines.push(`- ${a.adaptation_rule}${applied}`);
    }
  }

  return lines.join("\n");
}

/**
 * Create an adaptation from a user correction.
 * When the user says "no, not that — do this instead", that's a wheel turn.
 */
export async function adaptFromCorrection(
  sql: SqlClient,
  wrongApproach: string,
  correctApproach: string,
  scope?: string
): Promise<Adaptation> {
  // Normalize trigger — extract the core mistake pattern, not raw user text
  const trigger = wrongApproach
    .replace(/^(bro |dude |no |nah |stop |don't |dont )/i, "")
    .replace(/[!?.]+$/g, "")
    .trim()
    .slice(0, 120);

  // Normalize rule — ensure it's an actionable instruction
  const rule = correctApproach
    .replace(/^(instead |use |do |try )/i, (m) => m.charAt(0).toUpperCase() + m.slice(1))
    .trim()
    .slice(0, 300);

  // Dedup check — don't create duplicate corrections
  const existing = await sql`
    SELECT id FROM adaptations
    WHERE is_active = true
      AND category = 'defensive'
      AND (trigger_pattern = ${trigger} OR similarity(trigger_pattern, ${trigger}) > 0.6)
    LIMIT 1
  `;

  if (existing.length > 0) {
    // Update existing instead of creating duplicate
    await sql`
      UPDATE adaptations SET
        adaptation_rule = ${rule},
        times_applied = times_applied + 1,
        last_applied_at = NOW()
      WHERE id = ${existing[0].id}
    `;
    const [updated] = await sql`SELECT * FROM adaptations WHERE id = ${existing[0].id}`;
    return updated as unknown as Adaptation;
  }

  const [created] = await sql`
    INSERT INTO adaptations (
      trigger_pattern, adaptation_rule, source_failure,
      category, severity, scope, tags
    )
    VALUES (
      ${trigger},
      ${rule},
      ${"User correction: " + trigger},
      'defensive',
      7,
      ${scope || null},
      ${["user-correction", "defensive"]}
    )
    RETURNING *
  `;
  return created as unknown as Adaptation;
}

/**
 * Learn from a successful new pattern.
 * When something works and it's novel, the wheel turns — absorbing the approach.
 */
export async function wheelLearn(
  sql: SqlClient,
  learning: {
    pattern: string;
    insight: string;
    scope?: string;
    tags?: string[];
  }
): Promise<{ adaptation: Adaptation; isNew: boolean; wheelSpin: number }> {
  const normalized = learning.pattern.slice(0, 300).trim();

  // Check if we already know this pattern (dedup)
  const existing = await sql`
    SELECT * FROM adaptations
    WHERE is_active = true
    AND (
      trigger_pattern = ${normalized}
      OR similarity(trigger_pattern, ${normalized}) > 0.5
    )
    LIMIT 1
  `;

  if (existing.length > 0) {
    // Already known — increment applied, skip
    const adapt = existing[0] as unknown as Adaptation;
    await sql`
      UPDATE adaptations
      SET times_applied = times_applied + 1, last_applied_at = NOW()
      WHERE id = ${adapt.id}
    `;
    const [{ count }] = await sql`SELECT COUNT(*) as count FROM adaptations`;
    return { adaptation: adapt, isNew: false, wheelSpin: Number(count) };
  }

  // New learning — wheel turns
  const [created] = await sql`
    INSERT INTO adaptations (
      trigger_pattern, adaptation_rule, source_failure,
      category, severity, scope, tags
    )
    VALUES (
      ${normalized},
      ${learning.insight.slice(0, 500)},
      ${"Success pattern: " + normalized},
      'learning',
      4,
      ${learning.scope || null},
      ${learning.tags || ["learning", "success-pattern"]}
    )
    RETURNING *
  `;

  const [{ count }] = await sql`SELECT COUNT(*) as count FROM adaptations`;
  return { adaptation: created as unknown as Adaptation, isNew: true, wheelSpin: Number(count) };
}

/**
 * Evaluate an interaction and decide: is this worth learning from?
 * Returns true if the wheel turned, false if skipped.
 *
 * This is the "always-on" evaluator:
 *   - New? → learn
 *   - Known? → skip
 *   - Failure? → handled by wheelTurn (separate path)
 *   - Correction? → handled by adaptFromCorrection (separate path)
 */
export async function evaluateInteraction(
  sql: SqlClient,
  interaction: {
    type: "success" | "novel-approach" | "skill-combo" | "preference";
    pattern: string;
    insight: string;
    scope?: string;
  }
): Promise<{ learned: boolean; wheelSpin: number }> {
  // Check if this is genuinely novel
  const existing = await sql`
    SELECT id FROM adaptations
    WHERE is_active = true
    AND similarity(trigger_pattern, ${interaction.pattern.slice(0, 300)}) > 0.4
    LIMIT 1
  `;

  if (existing.length > 0) {
    // Already known — skip
    const [{ count }] = await sql`SELECT COUNT(*) as count FROM adaptations`;
    return { learned: false, wheelSpin: Number(count) };
  }

  // Novel — turn the wheel
  const result = await wheelLearn(sql, {
    pattern: interaction.pattern,
    insight: interaction.insight,
    scope: interaction.scope,
    tags: [interaction.type, "auto-learned"],
  });

  return { learned: result.isNew, wheelSpin: result.wheelSpin };
}

/**
 * Get wheel stats for display.
 */
export async function getWheelStats(sql: SqlClient): Promise<{
  total: number;
  defensive: number;
  auxiliary: number;
  offensive: number;
  learning: number;
  totalPrevented: number;
  totalApplied: number;
}> {
  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE is_active) as total,
      COUNT(*) FILTER (WHERE is_active AND category = 'defensive') as defensive,
      COUNT(*) FILTER (WHERE is_active AND category = 'auxiliary') as auxiliary,
      COUNT(*) FILTER (WHERE is_active AND category = 'offensive') as offensive,
      COUNT(*) FILTER (WHERE is_active AND category = 'learning') as learning,
      COALESCE(SUM(times_prevented) FILTER (WHERE is_active), 0) as total_prevented,
      COALESCE(SUM(times_applied) FILTER (WHERE is_active), 0) as total_applied
    FROM adaptations
  `;
  return {
    total: Number(stats.total),
    defensive: Number(stats.defensive),
    auxiliary: Number(stats.auxiliary),
    offensive: Number(stats.offensive),
    learning: Number(stats.learning),
    totalPrevented: Number(stats.total_prevented),
    totalApplied: Number(stats.total_applied),
  };
}
