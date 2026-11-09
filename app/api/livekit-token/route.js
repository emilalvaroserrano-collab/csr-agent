import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function POST(req) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "LiveKit server credentials are not configured" }, { status: 500 });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const { roomName, participantName, identity, metadata } = body || {};
  const room = String(roomName || `csr-${Date.now()}`).slice(0, 128);
  const id = String(identity || `web-${Date.now()}`).slice(0, 128);
  const name = participantName ? String(participantName).slice(0, 128) : id;

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: id,
      name,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
    // Agent dispatch: ensure your LiveKit Cloud dispatch is configured for agent "Samantha",
    // or add room/agent dispatch config per your livekit-server-sdk version.
    const token = await at.toJwt();
    return NextResponse.json({ token, roomName: room });
  } catch (err) {
    console.error("livekit-token error", err);
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
