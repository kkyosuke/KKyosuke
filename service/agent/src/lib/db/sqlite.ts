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
		this.db.run(`
			CREATE TABLE IF NOT EXISTS progress_summaries (
				id TEXT PRIMARY KEY,
				user_id TEXT,
				target_date TEXT,
				progress_percent INTEGER,
				evaluation_score INTEGER,
				summary_text TEXT
			)
		`);
	}

	async insertProgressSummary(summary: ProgressSummary): Promise<void> {
		if (!this.db) {
			console.warn("DB client not initialized. Skipping insert.");
			return;
		}

		const query = this.db.query(
			"INSERT INTO progress_summaries (id, user_id, target_date, progress_percent, evaluation_score, summary_text) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
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
}
