import type { ExecutionContext, MessageBatch } from "@cloudflare/workers-types";
import homeHtml from "./src/resources/home.html";
import { Hono } from "hono";
import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { resolveEnv } from "./src/config/env";
import { freeeApp } from "./src/handlers/freee";
import { createSlackApp } from "./src/handlers/slack";
import { githubApp } from "./src/handlers/webhook";

import type { AppBindings } from "./src/types/bindings";

const app = new Hono<{ Bindings: AppBindings }>();

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
	const htmlContent = typeof homeHtml === "string" ? homeHtml : (homeHtml as any).default || String(homeHtml);
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
	async queue(
		batch: MessageBatch<import("./src/jobs/github/queue").ReviewQueueMessage>,
		env: Record<string, string | undefined>,
	): Promise<void> {
		const appEnv = resolveEnv(env);
		await queueHandler(batch, appEnv as Record<string, string | undefined>);
	},
};
