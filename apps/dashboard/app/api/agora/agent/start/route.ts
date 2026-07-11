import { NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import type { ClientStartRequest, AgentResponse, TTSVendor } from "@/lib/agora/types";

function getConfig() {
  const agora = {
    baseUrl: process.env.AGORA_CONVO_AI_BASE_URL || "https://api.agora.io/api/conversational-ai-agent/v2/projects",
    appId: process.env.AGORA_APP_ID || "",
    appCertificate: process.env.AGORA_APP_CERTIFICATE || "",
    customerId: process.env.AGORA_CUSTOMER_ID || "",
    customerSecret: process.env.AGORA_CUSTOMER_SECRET || "",
    agentUid: process.env.AGORA_AGENT_UID || "333",
  };

  const missing = Object.entries(agora)
    .filter(([k, v]) => k !== "baseUrl" && k !== "agentUid" && !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing Agora config: ${missing.join(", ")}. Check .env.local`);
  }

  return {
    agora,
    llm: {
      url: process.env.AGORA_LLM_URL || "https://api.groq.com/openai/v1/chat/completions",
      apiKey: process.env.AGORA_LLM_API_KEY || process.env.GROQ_API_KEY || "",
      model: process.env.AGORA_LLM_MODEL || "llama-3.3-70b-versatile",
    },
    tts: {
      vendor: (process.env.AGORA_TTS_VENDOR || "microsoft") as TTSVendor,
      params: buildTTSParams(),
    },
  };
}

function buildTTSParams(): Record<string, string | number> {
  const vendor = process.env.AGORA_TTS_VENDOR || "microsoft";
  if (vendor === "elevenlabs") {
    return {
      key: process.env.AGORA_ELEVENLABS_API_KEY || "",
      voice_id: process.env.AGORA_ELEVENLABS_VOICE_ID || "XrExE9yKIg1WjnnlVkGX",
      model_id: process.env.AGORA_ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
    };
  }
  // Default: Microsoft
  return {
    key: process.env.AGORA_MICROSOFT_TTS_KEY || "",
    region: process.env.AGORA_MICROSOFT_TTS_REGION || "eastus",
    voice_name: process.env.AGORA_MICROSOFT_TTS_VOICE_NAME || "en-US-AndrewMultilingualNeural",
    rate: parseFloat(process.env.AGORA_MICROSOFT_TTS_RATE || "1.1"),
    volume: parseFloat(process.env.AGORA_MICROSOFT_TTS_VOLUME || "70"),
  };
}

export async function POST(request: Request) {
  try {
    const config = getConfig();
    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name, input_modalities, output_modalities } = body;

    const ts = Date.now();
    const expiry = Math.floor(ts / 1000) + 3600;
    const uniqueName = `ut-convo-${ts}-${Math.random().toString(36).substring(2, 8)}`;

    // Generate token for the AI agent to join the channel
    const agentToken = RtcTokenBuilder.buildTokenWithUid(
      config.agora.appId,
      config.agora.appCertificate,
      channel_name,
      config.agora.agentUid,
      RtcRole.PUBLISHER,
      expiry,
      expiry
    );

    const isStringUID = /[a-zA-Z]/.test(config.agora.agentUid);

    const requestBody = {
      name: uniqueName,
      properties: {
        channel: channel_name,
        token: agentToken,
        agent_rtc_uid: config.agora.agentUid,
        remote_rtc_uids: [requester_id],
        enable_string_uid: isStringUID,
        idle_timeout: 30,
        asr: {
          language: "en-US",
          task: "conversation",
        },
        llm: {
          url: config.llm.url,
          api_key: config.llm.apiKey,
          system_messages: [
            {
              role: "system",
              content:
                "You are a helpful AI assistant embedded in the UltraThink dashboard. " +
                "You are having a voice conversation. Be concise, clear, and natural. " +
                "Respond as if speaking — avoid markdown, bullet points, or long lists. " +
                "Keep responses under 3 sentences unless asked for detail.",
            },
          ],
          greeting_message: "Hey! I'm your UltraThink voice assistant. What can I help you with?",
          failure_message: "Give me a moment to think about that.",
          max_history: 10,
          params: {
            model: config.llm.model,
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.95,
          },
          input_modalities: input_modalities || ["text"],
          output_modalities: output_modalities || ["text", "audio"],
        },
        vad: {
          silence_duration_ms: 480,
          speech_duration_ms: 15000,
          threshold: 0.5,
          interrupt_duration_ms: 160,
          prefix_padding_ms: 300,
        },
        tts: config.tts,
        advanced_features: {
          enable_aivad: false,
          enable_bhvs: false,
        },
      },
    };

    const authHeader = `Basic ${Buffer.from(`${config.agora.customerId}:${config.agora.customerSecret}`).toString(
      "base64"
    )}`;

    const response = await fetch(`${config.agora.baseUrl}/${config.agora.appId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Agora agent start failed:", { status: response.status, body: errorText });
      throw new Error(`Agora API error: ${response.status} ${errorText}`);
    }

    const data: AgentResponse = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error starting Agora agent:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start agent" }, { status: 500 });
  }
}
