#!/usr/bin/env npx tsx
import { config } from "dotenv";
import { resolve, join } from "path";
config({ path: join(resolve(import.meta.dirname || ".", ".."), "..", ".env") });
import { getClient } from "../src/client.js";
const sql = getClient();

// Archive tool failure logs (low importance)
const [c1] = await sql`
  SELECT COUNT(*) as c FROM memories
  WHERE is_archived = false
    AND content LIKE ${"Tool 'Bash' failed%"}
    AND importance <= 6
`;
console.log(`Tool failures (imp<=6): ${c1.c} found`);
if (Number(c1.c) > 0) {
  await sql`
    UPDATE memories SET is_archived = true, updated_at = NOW()
    WHERE is_archived = false
      AND content LIKE ${"Tool 'Bash' failed%"}
      AND importance <= 6
  `;
  console.log(`  Archived`);
}

// Archive "Ran command:" noise
const [c2] = await sql`
  SELECT COUNT(*) as c FROM memories
  WHERE is_archived = false
    AND content LIKE ${"Ran command:%"}
    AND importance <= 5
`;
console.log(`Ran command logs (imp<=5): ${c2.c} found`);
if (Number(c2.c) > 0) {
  await sql`
    UPDATE memories SET is_archived = true, updated_at = NOW()
    WHERE is_archived = false
      AND content LIKE ${"Ran command:%"}
      AND importance <= 5
  `;
  console.log(`  Archived`);
}

const [a] = await sql`SELECT COUNT(*) as c FROM memories WHERE is_archived = false`;
const [ar] = await sql`SELECT COUNT(*) as c FROM memories WHERE is_archived = true`;
console.log(`\nFinal: ${a.c} active, ${ar.c} archived`);
process.exit(0);
