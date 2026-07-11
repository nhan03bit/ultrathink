// intent: the canonical slash-command definition array registered with Discord.
//   Imported by register-commands (for the SHA hash) and by the interaction
//   router in index.ts (for dispatch). Single source of truth for command shape.
// status: done
// confidence: high

export { definition as issueDefinition } from "./commands/issue.js";
export { definition as wakeDefinition } from "./commands/wake.js";
export { definition as cancelDefinition } from "./commands/cancel.js";
export { freezeDefinition, unfreezeDefinition } from "./commands/freeze.js";
export { definition as standupDefinition } from "./commands/standup.js";
export { definition as budgetDefinition } from "./commands/budget.js";
export { definition as focusDefinition } from "./commands/focus.js";

import { definition as issueDefinition } from "./commands/issue.js";
import { definition as wakeDefinition } from "./commands/wake.js";
import { definition as cancelDefinition } from "./commands/cancel.js";
import { freezeDefinition, unfreezeDefinition } from "./commands/freeze.js";
import { definition as standupDefinition } from "./commands/standup.js";
import { definition as budgetDefinition } from "./commands/budget.js";
import { definition as focusDefinition } from "./commands/focus.js";
import type { SlashCommandDef } from "./register-commands.js";

export const ALL_COMMANDS: SlashCommandDef[] = [
  issueDefinition,
  wakeDefinition,
  cancelDefinition,
  freezeDefinition,
  unfreezeDefinition,
  standupDefinition,
  budgetDefinition,
  focusDefinition,
];
