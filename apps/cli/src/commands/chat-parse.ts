// intent: pure (no-state) line parsers for ut chat — mentions, slash command shape
// status: done
// confidence: high

export interface Mention {
  name: string;
  message: string;
}

/**
 * Parse `@name body` spans. Multiple @-mentions on one line split on the next
 * @-token, so `@a foo @b bar` becomes `[{a,"foo"},{b,"bar"}]`. Names are
 * alphanumeric + `-_`. Empty bodies are preserved (caller decides).
 */
export function parseMentions(line: string): Mention[] {
  const re = /@([A-Za-z0-9_-]+)\s*/g;
  const matches: { name: string; index: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    matches.push({ name: m[1], index: m.index, end: m.index + m[0].length });
  }
  if (matches.length === 0) return [];
  const result: Mention[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const sliceEnd = next ? next.index : line.length;
    result.push({ name: cur.name, message: line.slice(cur.end, sliceEnd).trim() });
  }
  return result;
}

export interface SlashCommand {
  cmd: string;
  arg: string;
}

/** Returns null if line isn't a slash command. */
export function parseSlash(line: string): SlashCommand | null {
  if (!line.startsWith("/")) return null;
  const [cmd, ...rest] = line.slice(1).split(/\s+/);
  return { cmd: cmd.toLowerCase(), arg: rest.join(" ").trim() };
}
