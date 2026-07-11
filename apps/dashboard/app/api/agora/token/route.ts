import { NextRequest, NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-token";

export const dynamic = "force-dynamic";

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const TOKEN_EXPIRY_SECONDS = 3600;

function generateChannelName(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `ut-voice-${ts}-${rand}`;
}

export async function GET(req: NextRequest) {
  if (!APP_ID || !APP_CERTIFICATE) {
    return NextResponse.json(
      { error: "Agora credentials not configured. Add AGORA_APP_ID and AGORA_APP_CERTIFICATE to .env.local" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const uidStr = searchParams.get("uid") || "0";
  const uid = parseInt(uidStr, 10);
  const channel = searchParams.get("channel") || generateChannelName();

  const expiry = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channel,
      uid,
      RtcRole.PUBLISHER,
      expiry,
      expiry
    );

    return NextResponse.json({ token, uid: uid.toString(), channel });
  } catch (err) {
    console.error("Agora token generation error:", err);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
