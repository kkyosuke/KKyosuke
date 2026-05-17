import type { D1Database, KVNamespace, Queue } from "@cloudflare/workers-types";

export interface AppBindings {
	// Variables & Secrets
	APP_URL: string;
	FREEE_CLIENT_ID: string;
	FREEE_CLIENT_SECRET?: string;
	GITHUB_WEBHOOK_SECRET?: string;

	// KV Namespaces
	GITHUB_KV: KVNamespace;

	// D1 Databases
	AI_KYOSUKE_DB: D1Database;

	// Queues
	GITHUB_QUEUE: Queue<unknown>;
}
