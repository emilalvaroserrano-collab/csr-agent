window.ABITECH_CONFIG = Object.freeze({
  firebase: {
    apiKey: "AIzaSyAXEAwg0nLMl5cTD0td7t15HaCJ1nL0eH4",
    authDomain: "orbit-1cf1c.firebaseapp.com",
    databaseURL: "https://orbit-1cf1c-default-rtdb.firebaseio.com",
    projectId: "orbit-1cf1c",
    storageBucket: "orbit-1cf1c.firebasestorage.app",
    messagingSenderId: "737913630817",
    appId: "1:737913630817:web:5ee2c05e94b5b079f67a20",
    measurementId: "G-Q9KP8DLN00"
  },
  livekit: {
    // Browser-safe only. NEVER put LIVEKIT_API_SECRET in client code.
    url: "wss://csr-agent-19lzgbvy.livekit.cloud",
    // Your backend must generate a LiveKit access token (signed with API key+secret)
    // and return JSON: { "token": "<jwt>" } (also accepts accessToken/jwt).
    tokenEndpoint: "/api/livekit-token",
    // Agent dispatch name (matches @server.rtc_session(agent_name=...) in livekit-agent/src/agent.py)
    agentName: "Samantha",
    displayName: "Samantha"
  }
});
