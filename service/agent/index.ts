import { Hono } from "hono";
import { githubWebhookHandler } from "./src/handlers/webhook";
import { SlackApp } from "slack-cloudflare-workers";
import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import type { ExecutionContext } from "@cloudflare/workers-types";

const app = new Hono();

// APIの実行時間を測定しログに出力するミドルウェア
app.use("*", async (c, next) => {
	const start = Date.now();
	await next();
	const ms = Date.now() - start;
	const seconds = ms / 1000;
	console.log(
		`[Execution Time] ${c.req.method} ${c.req.url} - ${seconds}s (${ms}ms)`,
	);
});

app.get("/", (c) => {
	return c.text("Hello Hono! PR Review Agent is running.");
});

// GitHub Webhook のエンドポイント
app.post("/webhook/github", githubWebhookHandler);

// 開発環境用の smee-client 起動 (Node/Bun 環境のみ)
if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
	import("smee-client")
		.then((SmeeClientModule) => {
			const SmeeClient = SmeeClientModule.default || SmeeClientModule;

			// GitHub Webhook 用のSmee
			const smeeSourceUrl =
				process.env.SMEE_SOURCE_URL_GITHUB || "https://smee.io/mIMVWFjE10f5eUgC";
			const smee = new SmeeClient({
				source: smeeSourceUrl,
				target: "http://localhost:3000/webhook/github",
				logger: console,
			});
			smee.start();
			console.log(`[Dev] GitHub Smee client started forwarding from ${smeeSourceUrl}`);

			// Slack用のSmee
			const slackSmeeSourceUrl = process.env.SMEE_SOURCE_URL_SLACK;
			if (slackSmeeSourceUrl) {
				const slackSmee = new SmeeClient({
					source: slackSmeeSourceUrl,
					target: "http://localhost:3000/slack/events",
					logger: console,
				});
				slackSmee.start();
				console.log(`[Dev] Slack Smee client started forwarding from ${slackSmeeSourceUrl}`);
			} else {
				console.log("[Dev] SLACK_SMEE_SOURCE_URL is not set. Slack Smee client will not start.");
			}
		})
		.catch((_e) => {
			console.warn("[Dev] smee-client is not installed or failed to start.");
		});
}

export default {
	async fetch(
		request: Request,
		env: SlackEdgeAppEnv,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// SlackからのリクエストはSlackAppで処理する
		if (url.pathname.startsWith("/slack")) {
			const slackApp = new SlackApp({ env });
			return await slackApp.run(request, ctx);
		}

		// それ以外はHonoで処理する
		return await app.fetch(request, env as any, ctx);
	},
};
