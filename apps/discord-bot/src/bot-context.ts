// intent: shared BotContext type threaded through every command/event handler.
//   Centralises the env + paperclip config so handlers don't need to re-parse
//   process.env themselves.
// status: done
// confidence: high

import type { FullEnv } from "./config.js";
import type { PaperclipClientConfig } from "./paperclip-client.js";

export interface BotContext {
  env: FullEnv;
  paperclip: PaperclipClientConfig;
}

export function makeBotContext(env: FullEnv): BotContext {
  return {
    env,
    paperclip: {
      baseUrl: env.PAPERCLIP_API_URL,
      apiKey: env.PAPERCLIP_API_KEY,
      companyId: env.PAPERCLIP_COMPANY_ID,
    },
  };
}
