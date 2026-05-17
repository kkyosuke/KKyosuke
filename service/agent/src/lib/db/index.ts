import type { D1Database } from "@cloudflare/workers-types";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import * as schema from "./schema";

export * from "./schema";

export type DBClient = ReturnType<typeof getDatabaseClient>;

export function getDatabaseClient(env: {
	DATABASE?: D1Database;
}) {
	if (env.DATABASE) {
		return drizzleD1(env.DATABASE, { schema });
	}

	// ローカル環境等でD1がバインドされていない場合、Bun SQLite実装を動的に利用する
	const mod = "./sqlite";
	const { getLocalDbClient } = require(mod);
	return getLocalDbClient();
}
