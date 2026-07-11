#!/usr/bin/env npx tsx
/**
 * Force re-enrich ALL memories with updated synonym map.
 */
import { config } from "dotenv";
import { resolve, join } from "path";

const root = resolve(import.meta.dirname || ".", "..", "..");
config({ path: join(root, ".env") });

import { getClient } from "../src/client.js";
import { enrichMemory } from "../src/enrich.js";

const sql = getClient();

const BATCH = 500;
let offset = 0;
let total = 0;

while (true) {
  const rows = await sql`
    SELECT id, content, category FROM memories
    WHERE is_archived = false
    ORDER BY id
    LIMIT ${BATCH} OFFSET ${offset}
  `;
  if (rows.length === 0) break;

  for (const row of rows) {
    // Get tags
    const tags = await sql`SELECT tag FROM memory_tags WHERE memory_id = ${row.id}`;
    const tagList = tags.length > 0 ? tags.map((t: { tag: string }) => t.tag) : undefined;

    const enrichment = enrichMemory(row.content, row.category, tagList);
    await sql`UPDATE memories SET search_enrichment = ${enrichment} WHERE id = ${row.id}`;
  }

  total += rows.length;
  console.log(`Re-enriched ${total} memories...`);
  offset += BATCH;
}

console.log(`Done. Re-enriched ${total} total memories with expanded synonym map.`);
process.exit(0);
