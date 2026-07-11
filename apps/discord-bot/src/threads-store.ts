// intent: thin CRUD wrapper around the discord_issue_threads table (migration
//   026). Used by the mention handler to look up or create the thread record
//   that links a Paperclip issue to a Discord thread. Calls ut-bridge rather
//   than Neon directly — the bridge owns the DB connection.
// status: done
// confidence: high

export interface ThreadRecord {
  threadId: string;
  issueId: string;
  channelId: string;
  createdByHumanId: string | null;
}

export async function getThreadByIssue(issueId: string, utBridgeUrl: string): Promise<ThreadRecord | null> {
  const res = await fetch(`${utBridgeUrl}/threads/by-issue/${encodeURIComponent(issueId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`threads-store: GET by-issue ${issueId} → ${res.status}`);
  return res.json() as Promise<ThreadRecord>;
}

export async function upsertThread(record: ThreadRecord, utBridgeUrl: string): Promise<void> {
  const res = await fetch(`${utBridgeUrl}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`threads-store: upsert thread ${record.threadId} → ${res.status}`);
}
