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

export default {
	async fetch(
		request: Request,
		env: SlackEdgeAppEnv,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Bun等での実行時は env が存在しない、または別のオブジェクト(Server)の場合があるため process.env をフォールバックとして使う
		const appEnv = (env && (env as any).SLACK_BOT_TOKEN) ? env : (typeof process !== "undefined" ? process.env : env) as unknown as SlackEdgeAppEnv;

		// SlackからのリクエストはSlackAppで処理する
		if (url.pathname.startsWith("/slack")) {
			const slackApp = new SlackApp({ env: appEnv });
			return await slackApp.run(request, ctx);
		}

		// それ以外はHonoで処理する
		return await app.fetch(request, appEnv as any, ctx);
	},
};
