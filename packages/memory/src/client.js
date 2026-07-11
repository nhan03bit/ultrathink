/* global process */
import { neon } from "@neondatabase/serverless";
let sqlClient = null;
export function getClient() {
  if (!sqlClient) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    sqlClient = neon(databaseUrl);
  }
  return sqlClient;
}
