import { config } from "dotenv";
config();
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

async function main() {
    try {
        const { text } = await generateText({
            model: anthropic("claude-3-5-sonnet-20241022"),
            prompt: "Hello",
        });
        console.log(text);
    } catch (e: any) {
        console.error("Full error:", e.message);
    }
}
main();
