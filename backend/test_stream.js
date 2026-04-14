import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import "dotenv/config";

const client = new AnthropicFoundry({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    apiVersion: "2023-06-01"
});

async function main() {
    try {
        console.log("Testing stream...");
        const stream = client.messages.stream({
            model: process.env.ANTHROPIC_MODEL,
            max_tokens: 1024,
            messages: [
                {"role": "user", "content": "Count to 5"}
            ]
        });

        stream.on("text", (text) => process.stdout.write(text));
        
        stream.on("error", (e) => {
          console.error("\nStream error event!", e);
        });

        stream.on("end", () => {
            console.log("\nStream ended naturally");
        });

        await stream.done();
        console.log("\nDone promise resolved");

    } catch (error) {
        console.error("Error:", error.status, error.message);
    }
}

main();
