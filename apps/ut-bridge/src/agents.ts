// intent: resolve agent {id, name, title} by hitting the Paperclip API
// status: done — caches per-process (5min TTL) so we don't hammer Paperclip
// confidence: high

const TTL_MS = 5 * 60 * 1000;
type CachedAgent = { id: string; name: string; title: string | null };
let cache: { at: number; rows: CachedAgent[] } | null = null;

const PAPERCLIP_BASE = process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3100";

async function fetchAgents(): Promise<CachedAgent[]> {
  // 1. companies
  const companiesRes = await fetch(`${PAPERCLIP_BASE}/api/companies`);
  if (!companiesRes.ok) throw new Error(`paperclip /api/companies → ${companiesRes.status}`);
  const companies = (await companiesRes.json()) as Array<{ id: string }>;
  const all: CachedAgent[] = [];
  for (const c of companies) {
    const agentsRes = await fetch(`${PAPERCLIP_BASE}/api/companies/${c.id}/agents`);
    if (!agentsRes.ok) continue;
    const agents = (await agentsRes.json()) as Array<{
      id: string;
      name?: string | null;
      title?: string | null;
    }>;
    for (const a of agents) {
      all.push({ id: a.id, name: a.name ?? "", title: a.title ?? null });
    }
  }
  return all;
}

export async function getAgents(force = false): Promise<CachedAgent[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const rows = await fetchAgents();
  cache = { at: Date.now(), rows };
  return rows;
}

export async function getAgent(idOrSlug: string): Promise<CachedAgent | null> {
  const rows = await getAgents();
  const exact = rows.find((r) => r.id === idOrSlug);
  if (exact) return exact;
  const lower = idOrSlug.toLowerCase();
  return rows.find((r) => r.name.toLowerCase() === lower || r.title?.toLowerCase() === lower) ?? null;
}
