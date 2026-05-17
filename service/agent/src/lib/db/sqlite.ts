import * as schema from "./schema";

export function getLocalDbClient() {
	const mod = "drizzle-orm/bun-sqlite";
	const sqliteMod = "bun:sqlite";
	const { drizzle: drizzleBun } = require(mod);
	const { Database } = require(sqliteMod);

	const sqlite = new Database("local.db");

	initLocalDb(sqlite);

	return drizzleBun(sqlite, { schema });
}

// biome-ignore lint/suspicious/noExplicitAny: Any is used dynamically to avoid importing bun modules in worker
export function initLocalDb(sqlite: any) {
	try {
		const fsMod = "node:fs";
		const pathMod = "node:path";
		// biome-ignore lint/suspicious/noExplicitAny: bypass require
		const fs = require(fsMod) as any;
		// biome-ignore lint/suspicious/noExplicitAny: bypass require
		const path = require(pathMod) as any;

		const migrationsDir = path.resolve(process.cwd(), "migrations");
		if (fs.existsSync(migrationsDir)) {
			const files = fs
				.readdirSync(migrationsDir)
				.filter((f: string) => f.endsWith(".sql"))
				.sort();

			let hasError = false;
			for (const file of files) {
				try {
					const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
					if (typeof sqlite.exec === "function") {
						sqlite.exec(sql);
					} else {
						sqlite.run(sql);
					}
				} catch (fileError) {
					console.warn(
						`Failed to apply migration ${file} to local db:`,
						fileError,
					);
					hasError = true;
				}
			}
			if (!hasError) {
				console.log("Local SQLite migrations applied successfully.");
			}
		}
	} catch (error) {
		console.warn("Error reading migrations directory:", error);
	}
}
