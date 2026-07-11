// intent: single shared Neon client for the bridge process
// status: done
// confidence: high

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cachedSql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (cachedSql) return cachedSql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — ut-bridge needs the UltraThink Neon connection string");
  }
  cachedSql = neon(url);
  return cachedSql;
}
