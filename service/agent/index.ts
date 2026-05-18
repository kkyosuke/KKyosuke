import type { ExecutionContext, MessageBatch } from "@cloudflare/workers-types";
import homeHtml from "./src/resources/home.html";
import { Hono } from "hono";
import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { resolveEnv } from "./src/config/env";
import { freeeApp } from "./src/handlers/freee";
import { createSlackApp } from "./src/handlers/slack";
import { githubApp } from "./src/handlers/webhook";

import type { CustomAppEnv } from "./src/config/env";

const app = new Hono<{ Bindings: CustomAppEnv }>();

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
	const htmlContent =
		typeof homeHtml === "string"
			? homeHtml
			: (homeHtml as { default?: string }).default || String(homeHtml);
	return c.html(htmlContent as string);
});

// GitHub関連のエンドポイント
app.route("/github", githubApp);

// Freee関連のエンドポイント
app.route("/freee", freeeApp);

import { queueHandler } from "./src/handlers/queue";

export default {
	async fetch(
		request: Request,
		env: SlackEdgeAppEnv,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		const appEnv = resolveEnv(env);

		// SlackからのリクエストはSlackAppで処理する
		if (url.pathname.startsWith("/slack")) {
			const slackApp = createSlackApp(appEnv);
			return await slackApp.run(request, ctx);
		}

		// それ以外はHonoで処理する
		return await app.fetch(
			request,
			appEnv,
			ctx,
		);
	},
	async queue(
		batch: MessageBatch<import("./src/jobs/github/queue").ReviewQueueMessage>,
		env: Partial<CustomAppEnv>,
	): Promise<void> {
		const appEnv = resolveEnv(env);
		await queueHandler(batch, appEnv);
	},
};
