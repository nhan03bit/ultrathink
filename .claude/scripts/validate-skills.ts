/**
 * UltraThink Skill Registry Validator
 *
 * Validates consistency between _registry.json and SKILL.md files on disk.
 * Usage: npx tsx .claude/scripts/validate-skills.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SKILLS_DIR = path.join(os.homedir(), ".claude", "skills");
const REGISTRY_PATH = path.join(SKILLS_DIR, "_registry.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegistryEntry {
  name: string;
  description: string;
  layer: string;
  category: string;
  triggers: string[];
  linksTo?: string[];
  linkedFrom?: string[];
  [key: string]: unknown;
}

interface Registry {
  version: string;
  lastUpdated: string;
  skillCount: number;
  layers: Record<string, number>;
  skills: RegistryEntry[];
}

interface Frontmatter {
  name?: string;
  description?: string;
  layer?: string;
  category?: string;
  triggers?: string[];
  linksTo?: string[];
  linkedFrom?: string[];
  [key: string]: unknown;
}

interface Report {
  totalRegistry: number;
  totalDisk: number;
  phantoms: string[];
  orphans: string[];
  brokenLinksTo: { skill: string; target: string }[];
  brokenLinkedFrom: { skill: string; target: string }[];
  frontmatterErrors: { skill: string; errors: string[] }[];
  contentFlags: { skill: string; flags: string[] }[];
}

// ---------------------------------------------------------------------------
// YAML frontmatter parser (minimal, handles the subset used in SKILL.md)
// ---------------------------------------------------------------------------

function parseFrontmatter(content: string): Frontmatter | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of yaml.split("\n")) {
    // List item (indented with -)
    const listMatch = line.match(/^\s+-\s+(.+)/);
    if (listMatch && currentKey && currentList) {
      // Strip surrounding quotes
      const val = listMatch[1].replace(/^["']|["']$/g, "").trim();
      currentList.push(val);
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      // Flush previous list
      if (currentKey && currentList) {
        result[currentKey] = currentList;
        currentList = null; // eslint-disable-line no-useless-assignment
      }

      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      if (value === "" || value === "|") {
        // Might be a list or multi-line — start collecting
        currentKey = key;
        currentList = [];
      } else {
        currentKey = null;
        currentList = null;
        result[key] = value.replace(/^["']|["']$/g, "");
      }
      continue;
    }

    // Continuation of multi-line scalar (indented text that is not a list item)
    if (currentKey && currentList === null && line.match(/^\s+\S/)) {
      const existing = result[currentKey] as string | undefined;
      result[currentKey] = existing ? existing + " " + line.trim() : line.trim();
    }
  }

  // Flush trailing list
  if (currentKey && currentList) {
    result[currentKey] = currentList;
  }

  return result as Frontmatter;
}

// ---------------------------------------------------------------------------
// Disk discovery — find all skill dirs containing SKILL.md
// ---------------------------------------------------------------------------

function discoverSkillsOnDisk(): Set<string> {
  const skills = new Set<string>();
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_")) continue;
    const skillMd = path.join(SKILLS_DIR, entry.name, "SKILL.md");
    if (fs.existsSync(skillMd)) {
      skills.add(entry.name);
    }
  }
  return skills;
}

// ---------------------------------------------------------------------------
// Frontmatter validation
// ---------------------------------------------------------------------------

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const REQUIRED_FIELDS = ["name", "description", "layer", "category", "triggers"] as const;

function validateFrontmatter(skillName: string, fm: Frontmatter | null): string[] {
  const errors: string[] = [];

  if (!fm) {
    errors.push("Missing or unparseable YAML frontmatter");
    return errors;
  }

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (fm[field] === undefined || fm[field] === null || fm[field] === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Name constraints
  if (fm.name) {
    if (typeof fm.name === "string") {
      if (fm.name.length > 64) {
        errors.push(`name exceeds 64 chars (${fm.name.length})`);
      }
      if (!NAME_RE.test(fm.name)) {
        errors.push(`name must be lowercase + hyphens only: "${fm.name}"`);
      }
      if (fm.name !== skillName) {
        errors.push(`name "${fm.name}" does not match directory name "${skillName}"`);
      }
    }
  }

  // Description constraints
  if (fm.description) {
    const desc = String(fm.description);
    if (desc.length > 1024) {
      errors.push(`description exceeds 1024 chars (${desc.length})`);
    }
  }

  // Triggers should be a non-empty array
  if (fm.triggers !== undefined) {
    if (!Array.isArray(fm.triggers) || fm.triggers.length === 0) {
      errors.push("triggers must be a non-empty array");
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Content quality checks
// ---------------------------------------------------------------------------

const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/i,
  /\bFIXME\b/i,
  /\bplaceholder\b/i,
  /\blorem\s+ipsum\b/i,
  /\bTBD\b/,
  /\bXXX\b/,
];

function checkContent(skillName: string, content: string): string[] {
  const flags: string[] = [];
  const lines = content.split("\n");

  // Short file
  if (lines.length < 50) {
    flags.push(`Very short file (${lines.length} lines)`);
  }

  // Placeholder/TODO patterns
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(content)) {
      flags.push(`Contains placeholder pattern: ${pattern.source}`);
    }
  }

  // Empty sections (## Header followed by another ## or end with nothing substantial)
  const sectionPattern = /^##\s+.+$/gm;
  let sectionMatch: RegExpExecArray | null;
  const sectionStarts: number[] = [];
  while ((sectionMatch = sectionPattern.exec(content)) !== null) {
    sectionStarts.push(sectionMatch.index);
  }
  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i];
    const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1] : content.length;
    const section = content.slice(start, end);
    const bodyLines = section
      .split("\n")
      .slice(1)
      .filter((l) => l.trim().length > 0);
    if (bodyLines.length === 0) {
      const heading = section.split("\n")[0].trim();
      flags.push(`Empty section: ${heading}`);
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // Load registry
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error(`Registry not found: ${REGISTRY_PATH}`);
    process.exit(1);
  }
  const registry: Registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));

  const registryNames = new Set(registry.skills.map((s) => s.name));
  const diskNames = discoverSkillsOnDisk();

  // Build report
  const report: Report = {
    totalRegistry: registryNames.size,
    totalDisk: diskNames.size,
    phantoms: [],
    orphans: [],
    brokenLinksTo: [],
    brokenLinkedFrom: [],
    frontmatterErrors: [],
    contentFlags: [],
  };

  // All known skill names (union of registry + disk)
  const allNames = new Set([...registryNames, ...diskNames]);

  // Phantoms: in registry, no SKILL.md
  for (const name of registryNames) {
    if (!diskNames.has(name)) {
      report.phantoms.push(name);
    }
  }

  // Orphans: SKILL.md exists, not in registry
  for (const name of diskNames) {
    if (!registryNames.has(name)) {
      report.orphans.push(name);
    }
  }

  // Cross-reference validation (from registry entries)
  for (const entry of registry.skills) {
    for (const target of entry.linksTo ?? []) {
      if (!allNames.has(target)) {
        report.brokenLinksTo.push({ skill: entry.name, target });
      }
    }
    for (const target of entry.linkedFrom ?? []) {
      if (!allNames.has(target)) {
        report.brokenLinkedFrom.push({ skill: entry.name, target });
      }
    }
  }

  // Frontmatter + content checks for all SKILL.md files on disk
  for (const name of diskNames) {
    const skillPath = path.join(SKILLS_DIR, name, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf-8");
    const fm = parseFrontmatter(content);

    const fmErrors = validateFrontmatter(name, fm);
    if (fmErrors.length > 0) {
      report.frontmatterErrors.push({ skill: name, errors: fmErrors });
    }

    const flags = checkContent(name, content);
    if (flags.length > 0) {
      report.contentFlags.push({ skill: name, flags });
    }
  }

  // -----------------------------------------------------------------------
  // Output report
  // -----------------------------------------------------------------------

  const hasIssues =
    report.phantoms.length > 0 ||
    report.orphans.length > 0 ||
    report.brokenLinksTo.length > 0 ||
    report.brokenLinkedFrom.length > 0 ||
    report.frontmatterErrors.length > 0;

  console.log("=== UltraThink Skill Registry Validation ===\n");

  console.log(`Registry entries : ${report.totalRegistry}`);
  console.log(`SKILL.md on disk : ${report.totalDisk}`);
  console.log(`Declared count   : ${registry.skillCount}`);
  if (registry.skillCount !== report.totalRegistry) {
    console.log(`  WARNING: registry.skillCount (${registry.skillCount}) != actual entries (${report.totalRegistry})`);
  }
  console.log();

  // Phantoms
  printSection("Phantom Entries (in registry, no SKILL.md)", report.phantoms, (p) => `  - ${p}`);

  // Orphans
  printSection("Orphan Files (SKILL.md exists, not in registry)", report.orphans, (o) => `  - ${o}`);

  // Broken linksTo
  printSection("Broken linksTo References", report.brokenLinksTo, (b) => `  - ${b.skill} -> ${b.target}`);

  // Broken linkedFrom
  printSection("Broken linkedFrom References", report.brokenLinkedFrom, (b) => `  - ${b.skill} <- ${b.target}`);

  // Frontmatter errors
  if (report.frontmatterErrors.length > 0) {
    console.log(`Frontmatter Errors (${report.frontmatterErrors.length} skills):`);
    for (const { skill, errors } of report.frontmatterErrors) {
      console.log(`  ${skill}:`);
      for (const e of errors) {
        console.log(`    - ${e}`);
      }
    }
    console.log();
  } else {
    console.log("Frontmatter Errors: none\n");
  }

  // Content flags
  if (report.contentFlags.length > 0) {
    console.log(`Content Quality Flags (${report.contentFlags.length} skills):`);
    for (const { skill, flags } of report.contentFlags) {
      console.log(`  ${skill}:`);
      for (const f of flags) {
        console.log(`    - ${f}`);
      }
    }
    console.log();
  } else {
    console.log("Content Quality Flags: none\n");
  }

  // Summary
  const totalIssues =
    report.phantoms.length +
    report.orphans.length +
    report.brokenLinksTo.length +
    report.brokenLinkedFrom.length +
    report.frontmatterErrors.length;

  if (hasIssues) {
    console.log(`RESULT: ${totalIssues} issue(s) found.`);
    process.exit(1);
  } else {
    console.log(`RESULT: Clean. ${report.totalDisk} skills validated, ${report.contentFlags.length} quality flag(s).`);
    process.exit(0);
  }
}

function printSection<T>(title: string, items: T[], format: (item: T) => string): void {
  if (items.length > 0) {
    console.log(`${title} (${items.length}):`);
    for (const item of items) {
      console.log(format(item));
    }
    console.log();
  } else {
    console.log(`${title}: none\n`);
  }
}

main();
