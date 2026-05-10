import { config } from "dotenv";

config();

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

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
