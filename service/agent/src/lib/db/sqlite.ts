import type { DatabaseClient, ProgressSummary } from "./client";

export class SqliteDatabaseClient implements DatabaseClient {
	// biome-ignore lint/suspicious/noExplicitAny: To avoid bundle errors, we use any for sqlite database reference
	private db: any;

	constructor(filename = "local.db") {
		try {
			// 変数経由でrequireすることで、Cloudflare Workersのビルド(esbuild)によるバンドル解決を回避する
			const mod = "bun:sqlite";
			// biome-ignore lint/suspicious/noExplicitAny: require return value needs to be bypassed to avoid type issues with dynamic import
			const { Database } = require(mod) as any;
			this.db = new Database(filename);
			this.initialize();
		} catch (e) {
			console.warn("bun:sqlite could not be loaded.", e);
		}
	}

	private initialize() {
		if (!this.db) return;
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
					if (typeof this.db.exec === "function") {
						this.db.exec(sql);
					} else {
						this.db.run(sql);
					}
				}
				console.log("Local SQLite migrations applied successfully.");
			} else {
				console.warn("Migrations directory not found at:", migrationsDir);
			}
		} catch (error) {
			console.warn("Failed to apply migrations to local db:", error);
		}
	}

	async insertProgressSummary(summary: ProgressSummary): Promise<void> {
		if (!this.db) {
			console.warn("DB client not initialized. Skipping insert.");
			return;
		}

		const query = this.db.query(
			"INSERT INTO progress_summaries (id, user_id, target_date, progress_percent, evaluation_score, summary_text) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(user_id, target_date) DO UPDATE SET progress_percent = excluded.progress_percent, evaluation_score = excluded.evaluation_score, summary_text = excluded.summary_text",
		);
		query.run(
			summary.id,
			summary.userId,
			summary.targetDate,
			summary.progressPercent,
			summary.evaluationScore,
			summary.summaryText,
		);
	}
	async getProgressSummariesByDateRange(
		startDate: string,
		endDate: string,
	): Promise<ProgressSummary[]> {
		if (!this.db) {
			console.warn("DB client not initialized. Returning empty array.");
			return [];
		}

		const query = this.db.query(
			"SELECT id, user_id as userId, target_date as targetDate, progress_percent as progressPercent, evaluation_score as evaluationScore, summary_text as summaryText FROM progress_summaries WHERE target_date >= ? AND target_date <= ? ORDER BY target_date ASC",
		);
		const results = query.all(startDate, endDate) as ProgressSummary[];
		return results || [];
	}
}
