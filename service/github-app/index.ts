import { Hono } from "hono";
import { githubWebhookHandler } from "./src/handlers/webhook";

const app = new Hono();

app.get("/", (c) => {
	return c.text("Hello Hono! PR Review Agent is running.");
});

// GitHub Webhook のエンドポイント
app.post("/webhook/github", githubWebhookHandler);

export default app;
