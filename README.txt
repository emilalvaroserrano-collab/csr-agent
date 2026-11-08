ABI Tech — Talk to Abbie (static site)

Structure:
- index.html / calling.html
- css/styles.css
- js/config.js (browser-safe config only)
- js/index.js / js/firebase.js / js/calling.js
- livekit-agent/ (server-side LiveKit Agents worker, from Samantha.zip)

Frontend config (js/config.js):
- Firebase web configuration + Realtime Database URL
- LiveKit Cloud URL (wss://...) and tokenEndpoint
- NO secrets. NEVER put LIVEKIT_API_SECRET, server API keys, service-account JSON, or other private credentials in browser files.

LiveKit migration (replaces VAPI):
1. Deploy/run the server agent in livekit-agent/ (see livekit-agent/README.md).
   - Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in livekit-agent/.env.local (server-side only; .env.local is gitignored there).
   - Agent: Samantha (@server.rtc_session agent_name="Samantha", xai/grok-voice-3.0 realtime).
2. Deploy a secure token endpoint that the browser can POST to (js/config.js -> livekit.tokenEndpoint).
   - It must generate a LiveKit access token using LIVEKIT_API_KEY + LIVEKIT_API_SECRET on the server and return JSON: { "token": "<jwt>" }.
   - Reference implementation: livekit-agent/token-server-example.mjs (requires livekit-server-sdk). Do NOT expose this with secrets in client/static hosting.
   - Ensure your LiveKit Cloud/agent dispatch is configured so the Samantha agent joins rooms created for web callers (agent dispatch rules may be required depending on your setup).
3. The browser connects via livekit-client (ESM CDN), publishes mic audio, and plays agent audio.

Security note:
- If LIVEKIT_API_SECRET (or any key) was shared in an insecure channel, rotate it in LiveKit Cloud and update server-side env vars.

Firebase Console requirements:
1. Anonymous Authentication enabled.
2. Realtime Database created at the configured databaseURL.
3. Deployed hostname included in Authentication > Settings > Authorized domains.
4. Serve over HTTPS for microphone access.

Recommended RTDB rules:
{
  "rules": {
    "leads": {
      "$uid": {
        ".read": false,
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
