// intent: numeric copies of discord.js constants used by command definitions
//   and reply handlers. Isolating them here prevents command files from
//   importing discord.js at module-load time, preserving the boot-order
//   invariant (doc rev 2 step 3 / Quinn race-4): discord.js must never be
//   loaded before the DISCORD_BOT_ENABLED flag check.
// status: done
// confidence: high

export const OPTION_STRING = 3; // ApplicationCommandOptionType.String
export const OPTION_INTEGER = 4; // ApplicationCommandOptionType.Integer
export const EPHEMERAL = 64; // MessageFlags.Ephemeral
