import type { ExecutionContext } from "@cloudflare/workers-types";
import { Hono } from "hono";
import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { resolveEnv } from "./src/config/env";
import { createSlackApp } from "./src/handlers/slack";
import { githubWebhookHandler } from "./src/handlers/webhook";

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

		// 実行環境（Cloudflare / ローカル）の違いを吸収して env を取得する
		const appEnv = resolveEnv(env) as unknown as SlackEdgeAppEnv;

		// SlackからのリクエストはSlackAppで処理する
		if (url.pathname.startsWith("/slack")) {
			const slackApp = createSlackApp(
				appEnv as unknown as import("./src/handlers/slack").CustomAppEnv,
			);
			return await slackApp.run(request, ctx);
		}

		// それ以外はHonoで処理する
		return await app.fetch(
			request,
			appEnv as unknown as Record<string, unknown>,
			ctx,
		);
	},
};
