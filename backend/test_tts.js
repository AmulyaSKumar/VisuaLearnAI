// Test gpt-audio-1.5 — Chat Completions with audio modality
// Based on search results: uses /chat/completions with modalities: ['text', 'audio']
import OpenAI from "openai";
import fs from "fs";

// Same East US 2 endpoint where gpt-realtime-1.5 works
const endpoint = "https://amuly-mh65e9uu-eastus2.cognitiveservices.azure.com";
const apiKey = "5T4oM1jh9Mn9HD3bVhpOSx052HuDQuTODvwTVfa8JlLpLfiEUoYKJQQJ99BJACHYHv6XJ3w3AAAAACOGCbVI";
const model = "gpt-audio-1.5";

async function testAudioChatCompletions() {
  console.log("=== Testing gpt-audio-1.5 via Chat Completions ===");
  
  // Try multiple base URL formats
  const baseUrls = [
    endpoint + "/openai/v1",                // GA format
    endpoint + "/openai/deployments/" + model, // Azure deployment format
  ];

  for (const baseUrl of baseUrls) {
    console.log(`\nTrying baseURL: ${baseUrl}`);
    
    const client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    try {
      const response = await client.chat.completions.create({
        model: model,
        modalities: ["text", "audio"],
        audio: { voice: "alloy", format: "mp3" },
        messages: [
          { role: "user", content: "Say hello and introduce yourself as VisuaLearn AI tutor in one sentence." }
        ],
        max_tokens: 200,
      });

      console.log("✅ Success!");
      console.log("Text:", response.choices[0]?.message?.content);
      
      if (response.choices[0]?.message?.audio?.data) {
        const audioData = Buffer.from(response.choices[0].message.audio.data, "base64");
        fs.writeFileSync("/tmp/tts_chat_audio.mp3", audioData);
        console.log(`🔊 Audio saved! Size: ${audioData.length} bytes → /tmp/tts_chat_audio.mp3`);
      }
      
      if (response.choices[0]?.message?.audio?.transcript) {
        console.log("Transcript:", response.choices[0].message.audio.transcript);
      }
      
      console.log("Full response structure:", JSON.stringify(response.choices[0]?.message, null, 2).slice(0, 500));
      return; // Success, stop trying
    } catch (err) {
      console.log(`❌ Error: ${err.status} ${err.message?.slice(0, 150)}`);
    }
  }

  // Also try Azure-specific REST format directly
  console.log("\nTrying Azure REST directly...");
  const https = await import("https");
  const apiVersions = ["2025-01-01-preview", "2025-04-01-preview", "2024-12-01-preview"];
  
  for (const apiVersion of apiVersions) {
    const path = `/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
    console.log(`  api-version=${apiVersion}...`);
    
    await new Promise((resolve) => {
      const body = JSON.stringify({
        messages: [{ role: "user", content: "Say hello in one sentence." }],
        modalities: ["text", "audio"],
        audio: { voice: "alloy", format: "mp3" },
        max_tokens: 200,
      });

      const req = https.request({
        hostname: "amuly-mh65e9uu-eastus2.cognitiveservices.azure.com",
        path,
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
      }, res => {
        let data = "";
        res.on("data", d => data += d);
        res.on("end", () => {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            console.log(`  ✅ api-version=${apiVersion} works!`);
            if (parsed.choices?.[0]?.message?.audio?.data) {
              const audioData = Buffer.from(parsed.choices[0].message.audio.data, "base64");
              fs.writeFileSync("/tmp/tts_chat_audio.mp3", audioData);
              console.log(`  🔊 Audio saved: ${audioData.length} bytes`);
              console.log(`  Transcript: ${parsed.choices[0].message.audio.transcript}`);
            } else {
              console.log(`  Text: ${parsed.choices?.[0]?.message?.content}`);
            }
          } else {
            console.log(`  ❌ ${res.statusCode}: ${data.slice(0, 150)}`);
          }
          resolve();
        });
      });
      req.on("error", e => { console.log(`  ❌ ${e.message}`); resolve(); });
      req.write(body);
      req.end();
    });
  }
}

testAudioChatCompletions();
