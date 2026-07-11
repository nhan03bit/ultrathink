import { NextRequest, NextResponse } from "next/server";
import { getSkillRegistry, invalidateCache } from "@/lib/skills";
import { writeFileSync, mkdirSync, readFileSync, existsSync, unlinkSync, openSync, closeSync, constants } from "fs";
import { join } from "path";

// Simple lockfile mechanism to prevent read-modify-write races on _registry.json
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 50;

function acquireLock(lockPath: string): boolean {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      // O_CREAT | O_EXCL: atomic create-if-not-exists — fails if lock already held
      const fd = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      closeSync(fd);
      return true;
    } catch {
      // Lock held by another request — busy-wait briefly
      const start = Date.now();
      while (Date.now() - start < LOCK_RETRY_MS) {
        /* spin */
      }
    }
  }
  return false;
}

function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // Already removed — no-op
  }
}

export async function GET() {
  try {
    const registry = getSkillRegistry();
    return NextResponse.json(registry);
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

interface CreateSkillBody {
  name: string;
  description: string;
  layer: string;
  category: string;
  triggers: string[];
  linksTo: string[];
  linkedFrom: string[];
  riskLevel: string;
  content: string;
}

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const VALID_LAYERS = ["orchestrator", "hub", "utility", "domain"];
const VALID_RISK = ["low", "medium", "high"];

/**
 * Sanitize a string for safe inclusion as a YAML scalar value.
 * Strips control characters, then quotes the value if it contains
 * characters that could break YAML structure (colons, quotes, brackets,
 * hash, ampersand, asterisk, etc.) or starts with a YAML-special char.
 */
function sanitizeYamlValue(raw: string): string {
  // Strip control characters (newlines, tabs, null bytes, etc.) except spaces
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\x00-\x08\x0a-\x1f\x7f]/g, "");

  // If the value contains characters that are problematic in unquoted YAML,
  // or starts with a special character, wrap in double quotes with internal
  // double-quotes and backslashes escaped.
  const needsQuoting =
    /[:{}[\]#&*!|>'"%@`,\\\n\r\t]/.test(cleaned) ||
    /^[\s\-?]/.test(cleaned) ||
    cleaned === "" ||
    cleaned === "null" ||
    cleaned === "true" ||
    cleaned === "false" ||
    /^[\d.]+$/.test(cleaned);

  if (needsQuoting) {
    const escaped = cleaned.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }

  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateSkillBody;

    // --- Validation ---
    const errors: string[] = [];

    if (!body.name || typeof body.name !== "string") {
      errors.push("name is required");
    } else if (!NAME_RE.test(body.name) || body.name.length > 64) {
      errors.push("name must be lowercase alphanumeric with hyphens, max 64 chars");
    }

    if (!body.description || typeof body.description !== "string") {
      errors.push("description is required");
    } else if (body.description.length > 1024) {
      errors.push("description must be 1024 chars or fewer");
    }

    if (!VALID_LAYERS.includes(body.layer)) {
      errors.push(`layer must be one of: ${VALID_LAYERS.join(", ")}`);
    }

    if (!body.category || typeof body.category !== "string") {
      errors.push("category is required");
    }

    if (!VALID_RISK.includes(body.riskLevel)) {
      errors.push(`riskLevel must be one of: ${VALID_RISK.join(", ")}`);
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

    // Check if skill already exists
    const skillsDir = join(process.cwd(), "../.claude/skills");
    const skillDir = join(skillsDir, body.name);

    if (existsSync(skillDir)) {
      return NextResponse.json({ error: `Skill "${body.name}" already exists` }, { status: 409 });
    }

    // --- Build SKILL.md ---
    const triggers = body.triggers?.filter(Boolean) ?? [];
    const linksTo = body.linksTo?.filter(Boolean) ?? [];
    const linkedFrom = body.linkedFrom?.filter(Boolean) ?? [];

    // body.name is already validated against NAME_RE (lowercase alphanum + hyphens only)
    // body.layer and body.riskLevel are validated against allowlists
    // All other values must be sanitized before YAML interpolation
    let frontmatter = `---\nname: ${body.name}\n`;
    frontmatter += `description: ${sanitizeYamlValue(body.description)}\n`;
    frontmatter += `layer: ${body.layer}\n`;
    frontmatter += `category: ${sanitizeYamlValue(body.category)}\n`;

    if (triggers.length > 0) {
      frontmatter += `triggers:\n`;
      for (const t of triggers) {
        frontmatter += `  - ${sanitizeYamlValue(t)}\n`;
      }
    } else {
      frontmatter += `triggers: []\n`;
    }

    if (linksTo.length > 0) {
      frontmatter += `linksTo:\n`;
      for (const l of linksTo) {
        frontmatter += `  - ${sanitizeYamlValue(l)}\n`;
      }
    } else {
      frontmatter += `linksTo: []\n`;
    }

    if (linkedFrom.length > 0) {
      frontmatter += `linkedFrom:\n`;
      for (const l of linkedFrom) {
        frontmatter += `  - ${sanitizeYamlValue(l)}\n`;
      }
    } else {
      frontmatter += `linkedFrom: []\n`;
    }

    frontmatter += `riskLevel: ${body.riskLevel}\n`;
    frontmatter += `---\n`;

    const skillContent = body.content?.trim()
      ? `${frontmatter}\n${body.content.trim()}\n`
      : `${frontmatter}\n# ${body.name}\n\nTODO: Add skill documentation.\n`;

    // --- Write files ---
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), skillContent, "utf-8");

    // --- Update _registry.json (with file locking) ---
    const registryPath = join(skillsDir, "_registry.json");
    const lockPath = registryPath + ".lock";

    if (!acquireLock(lockPath)) {
      return NextResponse.json({ error: "Could not acquire registry lock — try again" }, { status: 503 });
    }

    try {
      let registry: Record<string, unknown> = {};
      if (existsSync(registryPath)) {
        registry = JSON.parse(readFileSync(registryPath, "utf-8"));
      }

      registry[body.name] = {
        name: body.name,
        description: body.description,
        layer: body.layer,
        category: body.category,
        triggers,
        linksTo,
        linkedFrom,
        riskLevel: body.riskLevel,
        path: `skills/${body.name}/SKILL.md`,
      };

      writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf-8");
    } finally {
      releaseLock(lockPath);
    }

    // Invalidate in-memory cache so next GET reflects the new skill
    invalidateCache();

    const created = {
      name: body.name,
      description: body.description,
      layer: body.layer,
      category: body.category,
      triggers,
      linksTo,
      linkedFrom,
      riskLevel: body.riskLevel,
    };

    return NextResponse.json({ skill: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/skills error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
