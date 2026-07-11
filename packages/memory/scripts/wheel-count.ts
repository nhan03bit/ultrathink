#!/usr/bin/env npx tsx
import { config } from "dotenv";
import { resolve, join } from "path";
config({ path: join(resolve(import.meta.dirname || ".", ".."), "..", ".env") });
import { getClient } from "../src/client.js";
const sql = getClient();
const [r] = await sql`SELECT COUNT(*) as c FROM adaptations WHERE is_active = true`;
process.stdout.write(String(r.c));
process.exit(0);
