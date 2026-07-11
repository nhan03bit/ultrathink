#!/usr/bin/env node
// intent: ut CLI entrypoint — wire Commander subcommands
// status: done
// confidence: high

import { Command } from "commander";
import { agentCommand } from "./commands/agent.js";
import { issueCommand } from "./commands/issue.js";
import { designDocCommand } from "./commands/design-doc.js";
import { memoryCommand } from "./commands/memory.js";
import { teamCommand } from "./commands/team.js";
import { chatCommand } from "./commands/chat.js";
import { studioCommand } from "./commands/studio.js";
import { printError } from "./format.js";

const program = new Command();

program
  .name("ut")
  .description("ut — UltraThink terminal for the bipartite team (agents, issues, design-docs, memory).")
  .version("0.1.0");

program.addCommand(agentCommand);
program.addCommand(issueCommand);
program.addCommand(designDocCommand);
program.addCommand(memoryCommand);
program.addCommand(teamCommand);
// `chat` (aliased as `talk`) — interactive REPL
chatCommand.alias("talk");
program.addCommand(chatCommand);

// `studio` — UltraThink Studio engine: build apps from natural language
program.addCommand(studioCommand);

// Map common typos / shortcuts to top-level
program
  .command("ask <name> <message...>")
  .description("Shortcut for `ut agent ask`")
  .option("--title <title>")
  .option("--no-wait")
  .option("--timeout <seconds>", "default 300", "300")
  .action((name: string, message: string[], opts) => {
    const args = [
      "agent",
      "ask",
      name,
      ...message,
      ...(opts.title ? ["--title", opts.title] : []),
      ...(opts.wait === false ? ["--no-wait"] : []),
      ...(opts.timeout ? ["--timeout", String(opts.timeout)] : []),
    ];
    program.parseAsync(["node", "ut", ...args]);
  });

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    printError((e as Error).message);
    if (process.env.UT_DEBUG) {
      process.stderr.write((e as Error).stack + "\n");
    }
    process.exitCode = 1;
  }
}

main();
