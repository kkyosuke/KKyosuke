import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import type { AppBindings } from "../../types/bindings";
import * as schema from "./schema";

export * from "./schema";

export type DBClient = ReturnType<typeof getDatabaseClient>;

export function getDatabaseClient(env: Partial<AppBindings>) {
	if (env.AI_KYOSUKE_DB) {
		return drizzleD1(env.AI_KYOSUKE_DB, { schema });
	}

	// ローカル環境等でD1がバインドされていない場合、Bun SQLite実装を動的に利用する
	const mod = "./sqlite";
	const { getLocalDbClient } = require(mod);
	return getLocalDbClient();
}
