#!/usr/bin/env node

/**
 * UltraThink Agora MCP Server
 *
 * Exposes Agora Conversational AI operations as MCP tools:
 * - generate_token: Create RTC tokens for channel access
 * - start_agent: Start a voice AI agent in a channel
 * - stop_agent: Stop a running voice AI agent
 * - list_agents: Query agent status (future)
 *
 * Required env vars:
 *   AGORA_APP_ID, AGORA_APP_CERTIFICATE, AGORA_CUSTOMER_ID, AGORA_CUSTOMER_SECRET
 * Optional:
 *   AGORA_LLM_URL, AGORA_LLM_API_KEY, AGORA_LLM_MODEL
 *   AGORA_TTS_VENDOR, AGORA_MICROSOFT_TTS_KEY, AGORA_MICROSOFT_TTS_REGION
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// agora-token is CJS; import default and destructure for ESM compatibility
import agoraToken from "agora-token";
const { RtcTokenBuilder, RtcRole } = agoraToken;

const BASE_URL = process.env.AGORA_CONVO_AI_BASE_URL || "https://api.agora.io/api/conversational-ai-agent/v2/projects";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function getAuthHeader(): string {
  const id = requireEnv("AGORA_CUSTOMER_ID");
  const secret = requireEnv("AGORA_CUSTOMER_SECRET");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

function generateChannelName(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `ut-voice-${ts}-${rand}`;
}

/* ─── Server ──────────────────────────────────────────────────────── */

const server = new McpServer({
  name: "agora",
  version: "1.0.0",
});

/* ─── Tool: generate_token ────────────────────────────────────────── */

server.tool(
  "generate_token",
  "Generate an Agora RTC token for joining a voice channel. Returns token, uid, and channel name.",
  {
    channel: z.string().optional().describe("Channel name (auto-generated if omitted)"),
    uid: z.number().optional().default(0).describe("User UID (0 for auto-assign)"),
    expiry_seconds: z.number().optional().default(3600).describe("Token validity in seconds"),
  },
  async ({ channel, uid, expiry_seconds }) => {
    const appId = requireEnv("AGORA_APP_ID");
    const cert = requireEnv("AGORA_APP_CERTIFICATE");
    const ch = channel || generateChannelName();
    const expiry = Math.floor(Date.now() / 1000) + expiry_seconds;

    const token = RtcTokenBuilder.buildTokenWithUid(appId, cert, ch, uid, RtcRole.PUBLISHER, expiry, expiry);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { token, uid: uid.toString(), channel: ch, expires_at: new Date(expiry * 1000).toISOString() },
            null,
            2
          ),
        },
      ],
    };
  }
);

/* ─── Tool: start_agent ───────────────────────────────────────────── */

server.tool(
  "start_agent",
  "Start an Agora Conversational AI voice agent in a channel. The agent will listen for speech, process it through an LLM, and respond with synthesized voice.",
  {
    channel: z.string().describe("RTC channel name to join"),
    user_uid: z.string().describe("The user's UID in the channel"),
    system_prompt: z.string().optional().describe("Custom system prompt for the LLM agent"),
    greeting: z.string().optional().describe("Agent's greeting message when it joins"),
    language: z.string().optional().default("en-US").describe("ASR language code"),
    llm_model: z.string().optional().describe("LLM model name (default: from env)"),
    max_tokens: z.number().optional().default(1024).describe("Max LLM response tokens"),
  },
  async ({ channel, user_uid, system_prompt, greeting, language, llm_model, max_tokens }) => {
    const appId = requireEnv("AGORA_APP_ID");
    const cert = requireEnv("AGORA_APP_CERTIFICATE");
    const agentUid = process.env.AGORA_AGENT_UID || "333";

    // Generate agent token
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const agentToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      cert,
      channel,
      agentUid,
      RtcRole.PUBLISHER,
      expiry,
      expiry
    );

    const isStringUID = /[a-zA-Z]/.test(agentUid);

    // Build TTS config
    const ttsVendor = process.env.AGORA_TTS_VENDOR || "microsoft";
    let ttsParams: Record<string, string | number>;
    if (ttsVendor === "elevenlabs") {
      ttsParams = {
        key: process.env.AGORA_ELEVENLABS_API_KEY || "",
        voice_id: process.env.AGORA_ELEVENLABS_VOICE_ID || "XrExE9yKIg1WjnnlVkGX",
        model_id: process.env.AGORA_ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
      };
    } else {
      ttsParams = {
        key: process.env.AGORA_MICROSOFT_TTS_KEY || "",
        region: process.env.AGORA_MICROSOFT_TTS_REGION || "eastus",
        voice_name: process.env.AGORA_MICROSOFT_TTS_VOICE_NAME || "en-US-AndrewMultilingualNeural",
        rate: parseFloat(process.env.AGORA_MICROSOFT_TTS_RATE || "1.1"),
        volume: parseFloat(process.env.AGORA_MICROSOFT_TTS_VOLUME || "70"),
      };
    }

    const ts = Date.now();
    const uniqueName = `ut-convo-${ts}-${Math.random().toString(36).substring(2, 8)}`;

    const requestBody = {
      name: uniqueName,
      properties: {
        channel,
        token: agentToken,
        agent_rtc_uid: agentUid,
        remote_rtc_uids: [user_uid],
        enable_string_uid: isStringUID,
        idle_timeout: 30,
        asr: { language, task: "conversation" },
        llm: {
          url: process.env.AGORA_LLM_URL || "https://api.groq.com/openai/v1/chat/completions",
          api_key: process.env.AGORA_LLM_API_KEY || process.env.GROQ_API_KEY || "",
          system_messages: [
            {
              role: "system",
              content:
                system_prompt ||
                "You are a helpful AI voice assistant. Be concise, clear, and natural. Respond as if speaking — no markdown or bullet points. Keep responses under 3 sentences unless asked for detail.",
            },
          ],
          greeting_message: greeting || "Hey! How can I help you?",
          failure_message: "Give me a moment to think about that.",
          max_history: 10,
          params: {
            model: llm_model || process.env.AGORA_LLM_MODEL || "llama-3.3-70b-versatile",
            max_tokens,
            temperature: 0.7,
            top_p: 0.95,
          },
          input_modalities: ["text"],
          output_modalities: ["text", "audio"],
        },
        vad: {
          silence_duration_ms: 480,
          speech_duration_ms: 15000,
          threshold: 0.5,
          interrupt_duration_ms: 160,
          prefix_padding_ms: 300,
        },
        tts: { vendor: ttsVendor, params: ttsParams },
        advanced_features: { enable_aivad: false, enable_bhvs: false },
      },
    };

    const response = await fetch(`${BASE_URL}/${appId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [{ type: "text" as const, text: `Error starting agent: ${response.status} ${errorText}` }],
        isError: true,
      };
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              agent_id: data.agent_id,
              state: data.state,
              channel,
              agent_uid: agentUid,
              created: new Date(data.create_ts * 1000).toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

/* ─── Tool: stop_agent ────────────────────────────────────────────── */

server.tool(
  "stop_agent",
  "Stop a running Agora Conversational AI agent by its agent_id.",
  {
    agent_id: z.string().describe("The agent_id returned from start_agent"),
  },
  async ({ agent_id }) => {
    const appId = requireEnv("AGORA_APP_ID");

    const response = await fetch(`${BASE_URL}/${appId}/agents/${agent_id}/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [{ type: "text" as const, text: `Error stopping agent: ${response.status} ${errorText}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: `Agent ${agent_id} stopped successfully.` }],
    };
  }
);

/* ─── Tool: check_config ──────────────────────────────────────────── */

server.tool(
  "check_config",
  "Check which Agora environment variables are configured. Does not reveal secrets.",
  {},
  async () => {
    const vars = [
      "AGORA_APP_ID",
      "AGORA_APP_CERTIFICATE",
      "AGORA_CUSTOMER_ID",
      "AGORA_CUSTOMER_SECRET",
      "AGORA_LLM_URL",
      "AGORA_LLM_API_KEY",
      "AGORA_LLM_MODEL",
      "AGORA_TTS_VENDOR",
      "AGORA_MICROSOFT_TTS_KEY",
      "AGORA_MICROSOFT_TTS_REGION",
      "GROQ_API_KEY",
    ];

    const status = vars.map((v) => ({
      name: v,
      configured: !!process.env[v],
    }));

    const configured = status.filter((s) => s.configured).length;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              summary: `${configured}/${vars.length} vars configured`,
              required_missing: status
                .filter(
                  (s) =>
                    !s.configured &&
                    ["AGORA_APP_ID", "AGORA_APP_CERTIFICATE", "AGORA_CUSTOMER_ID", "AGORA_CUSTOMER_SECRET"].includes(
                      s.name
                    )
                )
                .map((s) => s.name),
              all: status,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

/* ─── Start ───────────────────────────────────────────────────────── */

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Agora MCP server error:", err);
  process.exit(1);
});
