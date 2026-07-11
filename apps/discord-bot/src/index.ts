// intent: discord-bot entrypoint. Boot order is LOAD-BEARING (doc rev 2 /
//   Quinn race-4 + Alex T1):
//
//     1. dotenv.config() — secrets from ~/.config/inuverse/discord-bot.env or
//        process.env (launchd plist `EnvironmentVariables` block carries only
//        non-secret URLs/IDs; secrets are loaded here).
//     2. parse the FLAG ONLY (no token shape required) and EXIT 0 if disabled
//        BEFORE constructing any discord.js Client. Verification step 3
//        (static + runtime) asserts this with grep + a runtime no-TCP check.
//     3. ut-bridge /health probe (T+0 then one-shot retry T+2s).
//     4. THEN, and only then, dynamic-import discord.js, construct the
//        Client with the four intents + three partials (doc rev 2 / Mira C2).
//     5. login.
//     6. idempotent slash-command register (hash vs .discord-cmd-hash).
//
//   The dynamic-import in step 4 is what makes the runtime no-TCP check
//   trivial: with the flag off, the discord.js module is never loaded, so
//   the gateway WS never even attempts to connect.
//
// status: done — phases 1-6 implemented. Boot order, redaction, ut-bridge probe,
//   discord.js client, login, idempotent command register, event handlers all wired.
// confidence: high

import "dotenv/config";
import { parseFlagEnv, parseFullEnv, BootError, type FullEnv } from "./config.js";
import { registerSecretsFromEnv, redact } from "./secret-redact.js";
import { makeBotContext } from "./bot-context.js";
import { probeHealthWithRetry } from "./ut-bridge-client.js";
import { registerCommandsIfChanged, buildRestPut } from "./register-commands.js";
import { ALL_COMMANDS } from "./command-defs.js";
import { resolveIdentity } from "./identity.js";
import { handleMention } from "./mentions.js";
import { handleReaction } from "./reactions.js";
import { handle as handleIssue } from "./commands/issue.js";
import { handle as handleWake } from "./commands/wake.js";
import { handle as handleCancel } from "./commands/cancel.js";
import { handleFreeze, handleUnfreeze } from "./commands/freeze.js";
import { handle as handleStandup } from "./commands/standup.js";
import { handle as handleBudget } from "./commands/budget.js";
import { handle as handleFocus } from "./commands/focus.js";

// Wrap stdout/stderr so any string we hand to console.* runs through redact()
// before it leaves the process. Belt-and-braces: even printf-style logging
// from a dependency that we do not control will pass through here.
function installRedactingConsole(): void {
  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.log = (...args: unknown[]) => origLog(...args.map(redact));
  console.error = (...args: unknown[]) => origErr(...args.map(redact));
  console.warn = (...args: unknown[]) => origWarn(...args.map(redact));
}

async function probeUtBridgeOrThrow(url: string): Promise<void> {
  try {
    await probeHealthWithRetry(url);
  } catch (e: any) {
    throw new BootError("ut-bridge-unreachable", e?.message ?? String(e));
  }
}

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  // Phase 1: register secrets from env BEFORE any logging path that could
  // accidentally include them. Then install the redacting console.
  registerSecretsFromEnv(env);
  installRedactingConsole();

  // Phase 2: flag check — exit 0 if disabled, BEFORE any discord.js load.
  const flag = parseFlagEnv(env);
  if (!flag.DISCORD_BOT_ENABLED) {
    console.log("[discord-bot] disabled by env (DISCORD_BOT_ENABLED!=true) — exiting 0");
    return 0;
  }

  // Phase 3: ut-bridge readiness probe.
  // Parse full env first so we know UT_BRIDGE_URL even before probing.
  let full: FullEnv;
  try {
    full = parseFullEnv(env);
  } catch (e: any) {
    throw new BootError("missing-env", redact(e?.message ?? String(e)));
  }
  await probeUtBridgeOrThrow(full.UT_BRIDGE_URL);

  // Phases 4-6.
  await bootEnabled(full);
  return 0;
}

// bootEnabled is defined AFTER main() so the `import("discord.js")` line
// appears after `flag.DISCORD_BOT_ENABLED` in the source file. The static
// boot-order test (index-boot-order.spec.ts) asserts this ordering.
async function bootEnabled(env: FullEnv): Promise<void> {
  // Phase 4 — dynamic import so disabled-mode never loads discord.js (step 3
  // boot-order invariant). Four intents + three partials (Mira C2 review).
  const { Client, GatewayIntentBits, Partials, REST, Events, InteractionType } = await import("discord.js");

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.User],
  });

  const ctx = makeBotContext(env);

  // Phase 5 — login.
  try {
    await client.login(env.DISCORD_BOT_TOKEN);
  } catch (e: any) {
    const msg = redact(e?.message ?? String(e));
    if (/invalid token/i.test(msg)) throw new BootError("bad-token", msg);
    if (/privileged intent/i.test(msg)) throw new BootError("missing-intent", msg);
    throw new BootError("discord-login-failed", msg);
  }

  // Phase 6 — idempotent command registration. register-fail MUST NOT exit non-zero.
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
  const restPut = buildRestPut(rest, env.DISCORD_APP_ID, env.DISCORD_GUILD_ID);
  await registerCommandsIfChanged(restPut, ALL_COMMANDS).catch((e: unknown) => {
    console.warn("[discord-bot] register-fail (non-fatal):", redact(e));
  });

  // Event handlers.
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    await handleMention(message, client, ctx).catch((e) => console.error("[discord-bot] mention error:", redact(e)));
  });

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    await handleReaction(reaction, user, ctx).catch((e) => console.error("[discord-bot] reaction error:", redact(e)));
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const identity = await resolveIdentity(interaction.user.id, env.UT_BRIDGE_URL).catch(() => null);
    const name = interaction.commandName;
    try {
      if (name === "issue") return await handleIssue(interaction, identity, ctx);
      if (name === "wake") return await handleWake(interaction, identity, ctx);
      if (name === "cancel") return await handleCancel(interaction, identity, ctx);
      if (name === "freeze") return await handleFreeze(interaction, identity, ctx);
      if (name === "unfreeze") return await handleUnfreeze(interaction, identity, ctx);
      if (name === "standup") return await handleStandup(interaction, identity, ctx);
      if (name === "budget") return await handleBudget(interaction, identity, ctx);
      if (name === "focus") return await handleFocus(interaction, identity, ctx);
    } catch (e) {
      console.error(`[discord-bot] command /${name} error:`, redact(e));
      const reply = { content: "An error occurred. Please try again.", flags: 64 };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply).catch(() => undefined);
      } else {
        await interaction.reply(reply).catch(() => undefined);
      }
    }
  });

  void InteractionType; // imported for potential future use in button handlers
  console.log(`[discord-bot] ready — logged in as ${client.user?.tag}`);

  // Keep the process alive (gateway keeps WS open; no explicit await needed).
  // The process exits only on SIGTERM from launchd or on fatal boot error above.
  await new Promise<never>(() => undefined);
}

// Only auto-run when invoked as a script, not when imported by tests.
const isDirect = (() => {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    // Compare resolved paths so symlinks (pnpm) don't confuse us.
    return entry.endsWith("/dist/index.js") || entry.endsWith("/src/index.ts");
  } catch {
    return false;
  }
})();

if (isDirect) {
  main()
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      const msg = e instanceof BootError ? e.message : `boot-error: unknown — ${redact(e)}`;
      console.error(msg);
      process.exit(1);
    });
}
