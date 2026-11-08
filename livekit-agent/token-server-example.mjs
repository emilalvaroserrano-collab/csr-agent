/**
 * Example LiveKit token endpoint (Node.js, ESM).
 * DO NOT run this in the browser. Deploy as a server/serverless function.
 *
 * Install: npm i livekit-server-sdk express
 * Run: LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... LIVEKIT_URL=... node token-server-example.mjs
 *
 * The static frontend (js/config.js -> livekit.tokenEndpoint) should POST here:
 *   { roomName, participantName, identity, metadata }
 * Response: { token }
 */
import express from "express";
import { AccessToken } from "livekit-server-sdk";

const app = express();
app.use(express.json());

app.post("/api/livekit-token", async (req, res) => {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) return res.status(500).json({ error: "LiveKit API credentials not configured on server" });

  const { roomName, participantName, identity, metadata } = req.body || {};
  const room = String(roomName || `csr-${Date.now()}`).slice(0, 128);
  const id = String(identity || `web-${Date.now()}`).slice(0, 128);

  const at = new AccessToken(apiKey, apiSecret, {
    identity: id,
    name: participantName ? String(participantName).slice(0, 128) : id,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
  // Request the named agent to join this room (LiveKit Agents dispatch).
  // Adjust if your dispatch configuration differs.
  if (process.env.LIVEKIT_AGENT_NAME) {
    at.addGrant({ roomJoin: true, room });
  }
  const token = await at.toJwt();
  res.json({ token, roomName: room });
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Token server listening on :${port}`));
