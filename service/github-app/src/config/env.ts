import { config } from "dotenv";

config();

export const env = {
	GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || "",
	GITHUB_APP_ID: process.env.GITHUB_APP_ID || "",
	GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
	GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
};

// バリデーション (本番環境などでは厳密に行うと良いですが、まずは警告レベルにしておきます)
if (!env.GITHUB_WEBHOOK_SECRET) {
	console.warn("Warning: GITHUB_WEBHOOK_SECRET is not set in environment variables.");
}
if (!env.GITHUB_APP_ID) {
	console.warn("Warning: GITHUB_APP_ID is not set in environment variables.");
}
if (!env.GITHUB_PRIVATE_KEY) {
	console.warn("Warning: GITHUB_PRIVATE_KEY is not set in environment variables.");
}
if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
	console.warn("Warning: GOOGLE_GENERATIVE_AI_API_KEY is not set in environment variables.");
}
