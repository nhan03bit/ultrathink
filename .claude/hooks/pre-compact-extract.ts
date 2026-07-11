#!/usr/bin/env npx tsx
/**
 * pre-compact-extract.ts — Parse Claude transcript JSONL to extract session state.
 *
 * Called by pre-compact.sh before context compaction.
 * Extracts: last user prompt, files modified (from Edit/Write tool calls),
 * and a summary of the last assistant response.
 *
 * Usage: npx tsx pre-compact-extract.ts <transcript_path> <session_id>
 */

import { readFileSync } from "fs";

const transcriptPath = process.argv[2];
const sessionId = process.argv[3] || "unknown";

interface TranscriptEntry {
  type: string;
  role?: string;
  content?: unknown;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  message?: {
    role?: string;
    content?: unknown;
  };
}

interface ExtractedState {
  session_id: string;
  extracted_at: string;
  last_task: string | null;
  files_modified: string[];
  last_summary: string | null;
  decisions: string[];
  pending_work: string[];
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block?.type === "text" && typeof block.text === "string") return block.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function main() {
  if (!transcriptPath) {
    console.error("Usage: pre-compact-extract.ts <transcript_path> [session_id]");
    process.exit(1);
  }

  let raw: string;
  try {
    raw = readFileSync(transcriptPath, "utf-8");
  } catch {
    // Transcript not readable — output minimal state
    const fallback: ExtractedState = {
      session_id: sessionId,
      extracted_at: new Date().toISOString(),
      last_task: null,
      files_modified: [],
      last_summary: null,
      decisions: [],
      pending_work: [],
    };
    process.stdout.write(JSON.stringify(fallback));
    return;
  }

  const lines = raw.trim().split("\n").filter(Boolean);
  const entries: TranscriptEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }

  // Extract last user prompt
  let lastTask: string | null = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const role = entry.role || entry.message?.role;
    const content = entry.content || entry.message?.content;
    if (role === "user" && content) {
      const text = extractTextFromContent(content);
      if (text.trim()) {
        // Truncate to 500 chars — we only need the gist
        lastTask = text.trim().slice(0, 500);
        break;
      }
    }
  }

  // Extract files modified (from Edit/Write tool calls)
  const filesModified = new Set<string>();
  for (const entry of entries) {
    const toolName = entry.tool_name;
    const toolInput = entry.tool_input;
    if (toolName === "Edit" || toolName === "Write") {
      const filePath = toolInput?.file_path;
      if (typeof filePath === "string") {
        filesModified.add(filePath);
      }
    }
    // Also check nested content blocks for tool_use
    if (Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (block?.type === "tool_use" && (block.name === "Edit" || block.name === "Write")) {
          const fp = block.input?.file_path;
          if (typeof fp === "string") filesModified.add(fp);
        }
      }
    }
  }

  // Extract last assistant summary (last assistant message, truncated)
  let lastSummary: string | null = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const role = entry.role || entry.message?.role;
    const content = entry.content || entry.message?.content;
    if (role === "assistant" && content) {
      const text = extractTextFromContent(content);
      if (text.trim()) {
        lastSummary = text.trim().slice(0, 800);
        break;
      }
    }
  }

  // Extract decisions and pending work from assistant messages
  // Look for patterns: "I'll...", "decided to...", "going with...", "TODO", "still need to", "next:"
  const decisions: string[] = [];
  const pendingWork: string[] = [];
  const decisionPatterns = /(?:decided to|going with|I'll use|chose|picking|selected|approach:)\s*(.{10,120})/gi;
  const pendingPatterns = /(?:still need to|TODO|pending|next:|remaining:|haven't yet|need to)\s*(.{10,120})/gi;

  for (const entry of entries) {
    const role = entry.role || entry.message?.role;
    const content = entry.content || entry.message?.content;
    if (role === "assistant" && content) {
      const text = extractTextFromContent(content);
      for (const match of text.matchAll(decisionPatterns)) {
        if (match[1]) decisions.push(match[1].trim().replace(/\n.*/s, ""));
      }
      for (const match of text.matchAll(pendingPatterns)) {
        if (match[1]) pendingWork.push(match[1].trim().replace(/\n.*/s, ""));
      }
    }
  }

  const state: ExtractedState = {
    session_id: sessionId,
    extracted_at: new Date().toISOString(),
    last_task: lastTask,
    files_modified: [...filesModified],
    last_summary: lastSummary,
    decisions: [...new Set(decisions)].slice(0, 10),
    pending_work: [...new Set(pendingWork)].slice(0, 10),
  };

  process.stdout.write(JSON.stringify(state));
}

main();
