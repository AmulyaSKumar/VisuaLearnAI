import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import "dotenv/config";
import { SHOW_WIDGET_TOOL, SYSTEM_PROMPT } from "./tools.js";

const client = new AnthropicFoundry({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    apiVersion: "2023-06-01"
});

const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

async function main() {
    console.log("Starting identical stream test...");
    try {
        const stream = client.messages.stream({
            model,
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [
                { role: "user", content: "Tell me a joke" }
            ],
            tools: [SHOW_WIDGET_TOOL],
        });

        stream.on("text", (text) => process.stdout.write(text));
        
        stream.on("contentBlock", (block) => {
            console.log("contentBlock", block.type);
        });

        stream.on("message", (msg) => {
            console.log("\nmessage event", msg.stop_reason);
        });

        stream.on("error", (e) => {
            console.error("\nStream error event!", e);
        });

        stream.on("end", () => {
            console.log("\nStream ended naturally");
        });

        await stream.done();
        console.log("\nDone promise resolved");
    } catch (e) {
        console.error("Outer catch:", e);
    }
}
main();
