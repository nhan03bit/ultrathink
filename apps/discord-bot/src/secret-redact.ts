// intent: redact secrets in any string the bot logs or echoes back to a
//   Discord channel. Two layers (doc rev 2 / Quinn blocker-1):
//     1. literal-string replacement — at boot we register the values of every
//        env var matching DISCORD_BOT_TOKEN | *_TOKEN | *_KEY. Any exact
//        substring of those values is replaced with `[redacted]`.
//     2. Discord-token-shape backstop regex — catches tokens that arrive at
//        runtime (e.g. via untrusted input) without false-positives on UUIDs,
//        SHAs, or JWT segments. The OLD `^[A-Za-z0-9_-]{24,}$` pattern is
//        REMOVED and must NOT be reintroduced.
// status: scaffold — registration + redact() implemented; redactor will be
//   wired into the logger and reply path in a follow-up heartbeat.
// confidence: high

const REDACTED = "[redacted]";

// Discord token shape: <base64 user-id 20+>.<base64 timestamp 6>.<base64 hmac 27+>
// JWT middles are typically >>6 chars, so {6} on the middle differentiates.
// UUIDs and SHAs lack the dot structure entirely.
const DISCORD_TOKEN_SHAPE = /\b[\w-]{20,}\.[\w-]{6}\.[\w-]{27,}\b/g;

// Literal-string registry. Boot calls registerSecretsFromEnv(); tests call
// registerSecret() directly. Sorted longest-first so that overlapping secrets
// don't leave residue (replace the longer one first).
let literals: string[] = [];

export function resetSecretRegistryForTests(): void {
  literals = [];
}

export function registerSecret(value: string | undefined | null): void {
  if (!value || typeof value !== "string") return;
  if (value.length < 8) return; // ignore short non-secrets to avoid mass false positives
  if (literals.includes(value)) return;
  literals.push(value);
  literals.sort((a, b) => b.length - a.length);
}

export function registerSecretsFromEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const [name, value] of Object.entries(env)) {
    if (!value) continue;
    if (name === "DISCORD_BOT_TOKEN" || /_TOKEN$/.test(name) || /_KEY$/.test(name)) {
      registerSecret(value);
    }
  }
}

export function redact(input: unknown): string {
  if (input === null || input === undefined) return String(input);
  let s: string;
  if (typeof input === "string") s = input;
  else if (input instanceof Error) s = `${input.message}\n${input.stack ?? ""}`;
  else {
    try {
      s = JSON.stringify(input);
    } catch {
      s = String(input);
    }
  }
  for (const lit of literals) {
    if (s.includes(lit)) s = s.split(lit).join(REDACTED);
  }
  s = s.replace(DISCORD_TOKEN_SHAPE, REDACTED);
  return s;
}

// test/diagnostic — current registered count without leaking values.
export function registeredCount(): number {
  return literals.length;
}
