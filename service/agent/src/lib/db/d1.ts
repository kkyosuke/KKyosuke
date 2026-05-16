import type { D1Database } from "@cloudflare/workers-types";
import type { DatabaseClient, ProgressSummary } from "./client";

export class D1DatabaseClient implements DatabaseClient {
	constructor(private db: D1Database) {}

	async insertProgressSummary(summary: ProgressSummary): Promise<void> {
		await this.db
			.prepare(
				"INSERT INTO progress_summaries (id, user_id, target_date, progress_percent, evaluation_score, summary_text) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.bind(
				summary.id,
				summary.userId,
				summary.targetDate,
				summary.progressPercent,
				summary.evaluationScore,
				summary.summaryText,
			)
			.run();
	}
}
