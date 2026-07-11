import { NextResponse } from "next/server";
import type { StopConversationRequest } from "@/lib/agora/types";

export async function POST(request: Request) {
  try {
    const baseUrl =
      process.env.AGORA_CONVO_AI_BASE_URL || "https://api.agora.io/api/conversational-ai-agent/v2/projects";
    const appId = process.env.AGORA_APP_ID || "";
    const customerId = process.env.AGORA_CUSTOMER_ID || "";
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET || "";

    if (!appId || !customerId || !customerSecret) {
      throw new Error("Missing Agora credentials");
    }

    const body: StopConversationRequest = await request.json();
    if (!body.agent_id) {
      throw new Error("agent_id is required");
    }

    const authHeader = `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString("base64")}`;

    const response = await fetch(`${baseUrl}/${appId}/agents/${body.agent_id}/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Agora agent stop failed:", { status: response.status, body: errorText });
      throw new Error(`Failed to stop agent: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error stopping Agora agent:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to stop agent" }, { status: 500 });
  }
}
