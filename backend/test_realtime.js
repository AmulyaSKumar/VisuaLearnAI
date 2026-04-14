// Test gpt-realtime-1.5 — Manual WebSocket using exact Azure URL from user
import WebSocket from "ws";

// Exact URL user provided
const WS_URL = "wss://amuly-mmrmispt-swedencentral.cognitiveservices.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-realtime-1.5";
const API_KEY = "6VTVSOtTpq3O3i3FDGyYa73em7XVQqHNN5naiRsmFJt8XYRVxg12JQQJ99CCACfhMk5XJ3w3AAAAACOGqv4v";

console.log("=== gpt-realtime-1.5 Manual WebSocket Test ===");
console.log("URL:", WS_URL);

// Try with api-key as header (standard Azure pattern)
const ws = new WebSocket(WS_URL, {
  headers: {
    "api-key": API_KEY,
    "OpenAI-Beta": "realtime=v1",
  },
});

let sessionCreated = false;
let responseDone = false;

ws.on("open", () => {
  console.log("✅ WebSocket connected!");
});

ws.on("message", (raw) => {
  let event;
  try { event = JSON.parse(raw.toString()); } catch { return; }
  
  switch (event.type) {
    case "error":
      console.error("❌ Server error:", JSON.stringify(event.error));
      break;

    case "session.created":
      console.log("✅ session.created! ID:", event.session?.id, "| Model:", event.session?.model);
      sessionCreated = true;

      // Configure session
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          voice: "alloy",
          instructions: "You are VisuaLearn AI, a helpful tutor. Keep answers very short.",
          modalities: ["text", "audio"],
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200,
            create_response: true,
          },
        },
      }));
      break;

    case "session.updated":
      console.log("✅ session.updated!");
      // Send a text message
      ws.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Hello! Introduce yourself in one sentence." }],
        },
      }));
      ws.send(JSON.stringify({ type: "response.create" }));
      break;

    case "response.audio_transcript.delta":
      process.stdout.write(event.delta || "");
      break;

    case "response.audio.delta": {
      const buf = Buffer.from(event.delta || "", "base64");
      process.stdout.write(` [🔊${buf.length}B] `);
      break;
    }

    case "response.done":
      const transcript = event.response?.output?.[0]?.content?.[0]?.transcript;
      console.log("\n✅ response.done!");
      console.log("Transcript:", transcript ?? "(none)");
      responseDone = true;
      ws.close();
      break;

    default:
      console.log("  →", event.type);
  }
});

ws.on("error", (err) => {
  console.error("❌ WebSocket error:", err.message);
  
  // If 302 redirect, try following it
  if (err.message.includes("302")) {
    console.log("Got 302 — maybe try with Ocp-Apim-Subscription-Key header instead?");
  }
});

ws.on("unexpected-response", (req, res) => {
  console.error(`❌ Unexpected response: ${res.statusCode} ${res.statusMessage}`);
  let body = "";
  res.on("data", d => body += d);
  res.on("end", () => {
    console.error("Response body:", body);
    process.exit(1);
  });
});

ws.on("close", (code, reason) => {
  console.log(`Closed: ${code} — ${reason?.toString() || "(no reason)"}`);
  process.exit(responseDone ? 0 : 1);
});

setTimeout(() => {
  console.error("❌ 30s timeout");
  ws.close();
  process.exit(1);
}, 30000);
