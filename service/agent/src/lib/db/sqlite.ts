import * as schema from "./schema";

export function getLocalDbClient() {
	const mod = "drizzle-orm/bun-sqlite";
	const sqliteMod = "bun:sqlite";
	const { drizzle: drizzleBun } = require(mod);
	const { Database } = require(sqliteMod);

	const sqlite = new Database("local.db");

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

			for (const file of files) {
				const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
				if (typeof sqlite.exec === "function") {
					sqlite.exec(sql);
				} else {
					sqlite.run(sql);
				}
			}
			console.log("Local SQLite migrations applied successfully.");
		}
	} catch (error) {
		console.warn("Failed to apply migrations to local db:", error);
	}

	return drizzleBun(sqlite, { schema });
}
