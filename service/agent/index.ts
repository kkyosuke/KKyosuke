import { Hono } from "hono";
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

// 開発環境用の smee-client 起動 (Node/Bun 環境のみ)
if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
	import("smee-client")
		.then((SmeeClientModule) => {
			const SmeeClient = SmeeClientModule.default || SmeeClientModule;
			const smeeSourceUrl =
				process.env.SMEE_SOURCE_URL || "https://smee.io/mIMVWFjE10f5eUgC";
			const smee = new SmeeClient({
				source: smeeSourceUrl,
				target: "http://localhost:3000/webhook/github",
				logger: console,
			});
			smee.start();
			console.log(`[Dev] Smee client started forwarding from ${smeeSourceUrl}`);
		})
		.catch((_e) => {
			console.warn("[Dev] smee-client is not installed or failed to start.");
		});
}

export default app;
