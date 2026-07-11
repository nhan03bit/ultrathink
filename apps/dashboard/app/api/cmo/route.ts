import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Legacy CMO route — proxies to the shared /api/ai/chat engine.
 * Kept for backwards compatibility.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const url = new URL("/api/ai/chat", req.url);
  return fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
