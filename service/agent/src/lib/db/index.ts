import type { D1Database } from "@cloudflare/workers-types";
import type { DatabaseClient } from "./client";
import { D1DatabaseClient } from "./d1";

export * from "./client";

export function getDatabaseClient(env: {
	AI_KYOSUKE_DB?: D1Database;
}): DatabaseClient {
	if (env.AI_KYOSUKE_DB) {
		return new D1DatabaseClient(env.AI_KYOSUKE_DB);
	}

	// ローカル環境等でD1がバインドされていない場合、Bun SQLite実装を動的に利用する
	// ビルドツールの静的解析を避けるため変数経由で require する
	const mod = "./sqlite";
	const { SqliteDatabaseClient } = require(mod);
	return new SqliteDatabaseClient();
}
