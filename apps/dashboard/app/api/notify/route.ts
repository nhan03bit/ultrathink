import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { title, description, color, fields } = await request.json();

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ error: "DISCORD_WEBHOOK_URL not configured" }, { status: 503 });
    }

    const embed = {
      title: title ?? "UltraThink Notification",
      description: description ?? "",
      color: color ?? 0xf59e0b,
      timestamp: new Date().toISOString(),
      footer: { text: "UltraThink Memory Brain" },
      fields: fields ?? [],
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Discord API error:", text);
      return NextResponse.json({ error: "Discord API error" }, { status: res.status });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
