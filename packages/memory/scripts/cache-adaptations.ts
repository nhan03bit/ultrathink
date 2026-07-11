#!/usr/bin/env npx tsx
/**
 * Cache active Tekiō adaptations to a JSON file for fast PreToolUse lookups.
 * Output: JSON array of {id, trigger, rule}
 */

import { config } from "dotenv";
import { join, resolve } from "path";
config({ path: join(resolve(import.meta.dirname, "../.."), ".env") });

import { getClient } from "../src/client.js";
import { getActiveAdaptations } from "../src/adaptation.js";

async function main() {
  const sql = getClient();
  const adaptations = await getActiveAdaptations(sql);
  const cache = adaptations.map((a) => ({
    id: a.id,
    trigger: a.trigger_pattern,
    rule: a.adaptation_rule,
  }));
  process.stdout.write(JSON.stringify(cache));
}

main().catch(() => process.stdout.write("[]"));
