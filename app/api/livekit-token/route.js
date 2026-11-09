import * as lk from "livekit-server-sdk";
import { NextResponse } from "next/server";

const { AccessToken } = lk;

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
  const agentName = (metadata && metadata.agentName) || process.env.LIVEKIT_AGENT_NAME || "customer-support-1bda";

  // Normalize metadata so the agent can reliably read lead context.
  const md = metadata && typeof metadata === "object" ? { ...metadata } : {};
  if (md.lead && typeof md.lead === "object") {
    md.lead = {
      name: md.lead.name || name,
      company: md.lead.company || "",
      phone: md.lead.phone || "",
      email: md.lead.email || "",
      requirement: md.lead.requirement || "",
    };
  }
  md.agentName = agentName;

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: id,
      name,
      metadata: JSON.stringify(md),
    });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });

    // Explicitly request the named agent to join this room (fixes "connected but agent not speaking"
    // when dispatch depends on room config). Supported by livekit-server-sdk v2+.
    try {
      const RoomConfiguration = lk.RoomConfiguration;
      const RoomAgentDispatch = lk.RoomAgentDispatch;
      if (RoomConfiguration && RoomAgentDispatch) {
        at.roomConfig = new RoomConfiguration({
          agents: [new RoomAgentDispatch({ agentName, metadata: JSON.stringify({ lead: md.lead || null, csr: md.csr || null }) })],
        });
      } else {
        console.warn("Room agent dispatch types unavailable in livekit-server-sdk; ensure LiveKit Cloud dispatch rules are set for", agentName);
      }
    } catch (e) {
      console.warn("Room agent dispatch config failed; ensure LiveKit Cloud dispatch rules are set for", agentName, e?.message);
    }

    const token = await at.toJwt();
    return NextResponse.json({ token, roomName: room, agentName });
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
