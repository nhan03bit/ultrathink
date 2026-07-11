// intent: thin Discord webhook client with awareness of 429 rate limits and
//   a soft per-channel queue so we don't fire bursts faster than Discord
//   accepts. Falls back to the supplied logger when no URL is configured.
// status: partially_done — single in-flight request per channel; full retry
//   queue + persistent backoff is deferred to the follow-up subagent.
// next: persist the queue across restarts via ctx.state, add bucket-aware
//   X-RateLimit-Remaining handling
// confidence: medium

import type { ChannelKey } from "./config.js";
import type { DiscordEmbed, DiscordWebhookPayload } from "./embed-builder.js";

export type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

export type PostResult =
  | { status: "posted"; channel: ChannelKey }
  | { status: "logged"; channel: ChannelKey; reason: string }
  | { status: "skipped"; channel: ChannelKey; reason: string }
  | { status: "error"; channel: ChannelKey; error: string };

export type WebhookClientOptions = {
  webhooks: Partial<Record<ChannelKey, string>>;
  logger: Logger;
  /** Override fetch for tests. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
};

/**
 * Per-channel serial queue keeps us under Discord's 5 req/s/channel ceiling
 * without an extra dep. It is a *minimum* spacing of 250ms between sends.
 */
const MIN_INTERVAL_MS = 250;

export class WebhookClient {
  private readonly webhooks: Partial<Record<ChannelKey, string>>;
  private readonly logger: Logger;
  private readonly fetchImpl: typeof fetch;
  private readonly nextSendAt = new Map<ChannelKey, number>();
  private readonly inFlight = new Map<ChannelKey, Promise<void>>();

  constructor(opts: WebhookClientOptions) {
    this.webhooks = opts.webhooks;
    this.logger = opts.logger;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Post `embeds` to `channel`. If no webhook URL is configured for the
   * channel, the payload is logged and we return `{ status: "logged" }`.
   */
  async post(channel: ChannelKey, embeds: DiscordEmbed[], options: { content?: string } = {}): Promise<PostResult> {
    if (!embeds.length) {
      return { status: "skipped", channel, reason: "no embeds" };
    }
    const url = this.webhooks[channel];
    const payload: DiscordWebhookPayload = { embeds };
    if (options.content) payload.content = options.content;

    if (!url) {
      this.logger.info(`[discord-transparency] no webhook for #${channel}; logging payload`, {
        channel,
        payload,
      });
      return { status: "logged", channel, reason: "no webhook configured" };
    }

    // Serialize per channel.
    const previous = this.inFlight.get(channel) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.sendNow(channel, url, payload));
    this.inFlight.set(channel, next);
    try {
      await next;
      return { status: "posted", channel };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[discord-transparency] post failed for #${channel}`, {
        channel,
        error: msg,
      });
      return { status: "error", channel, error: msg };
    }
  }

  private async sendNow(channel: ChannelKey, url: string, payload: DiscordWebhookPayload): Promise<void> {
    const now = Date.now();
    const earliest = this.nextSendAt.get(channel) ?? 0;
    if (earliest > now) {
      await delay(earliest - now);
    }
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Discord throttles via 429 + retry-after.
    if (res.status === 429) {
      const retryAfter = parseRetryAfter(res) ?? 1000;
      this.nextSendAt.set(channel, Date.now() + retryAfter);
      this.logger.warn(`[discord-transparency] 429 on #${channel}, backing off ${retryAfter}ms`);
      await delay(retryAfter);
      // Single retry — anything more is the follow-up subagent's job.
      const retry = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!retry.ok) {
        const text = await safeText(retry);
        throw new Error(`discord webhook failed after retry: ${retry.status} ${text}`);
      }
    } else if (!res.ok) {
      const text = await safeText(res);
      throw new Error(`discord webhook failed: ${res.status} ${text}`);
    }

    this.nextSendAt.set(channel, Date.now() + MIN_INTERVAL_MS);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}

function parseRetryAfter(res: Response): number | null {
  const header = res.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.ceil(seconds * 1000);
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
