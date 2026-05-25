import type { D1Database, KVNamespace, Queue } from "@cloudflare/workers-types";

export interface AppBindings {
	// Variables & Secrets
	APP_URL: string;
	GITHUB_WEBHOOK_SECRET?: string;
	BOT_NAME?: string;
	GITHUB_APP_ID?: string;
	GITHUB_PRIVATE_KEY?: string;
	ANTHROPIC_API_KEY?: string;

	// KV Namespaces
	AI_KYOSUKE_KV: KVNamespace;

	// D1 Databases
	AI_KYOSUKE_DB: D1Database;

	// Queues
	GITHUB_QUEUE: Queue<unknown>;
}
