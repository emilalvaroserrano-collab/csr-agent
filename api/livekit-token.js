import { AccessToken } from "livekit-server-sdk";

export default async function handler(req, res) {
  // CORS/preflight (useful for local testing; same-origin on Vercel)
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "LiveKit server credentials are not configured" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { roomName, participantName, identity, metadata } = body;
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

    // If using explicit agent dispatch, configure your LiveKit Cloud dispatch rules
    // or extend token/room config per your livekit-server-sdk version and project setup.
    const token = await at.toJwt();
    return res.status(200).json({ token, roomName: room });
  } catch (err) {
    console.error("livekit-token error", err);
    return res.status(500).json({ error: "Failed to create token" });
  }
}
