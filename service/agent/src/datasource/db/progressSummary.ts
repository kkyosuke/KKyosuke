import { asc, and, gte, lte } from "drizzle-orm";
import type { DBClient } from "../../lib/db";
import { progressSummaries } from "../../lib/db/schema";

export type InsertProgressSummaryParams = {
	id: string;
	userId: string;
	targetDate: string;
	progressPercent: number;
	evaluationScore: number;
	summaryText: string;
};

export async function saveProgressSummary(db: DBClient, data: InsertProgressSummaryParams) {
	await db.insert(progressSummaries).values(data).onConflictDoUpdate({
		target: [progressSummaries.userId, progressSummaries.targetDate],
		set: {
			progressPercent: data.progressPercent,
			evaluationScore: data.evaluationScore,
			summaryText: data.summaryText,
		}
	});
}

export async function getProgressSummariesByDateRange(db: DBClient, startDate: string, endDate: string) {
	return await db
		.select()
		.from(progressSummaries)
		.where(and(
			gte(progressSummaries.targetDate, startDate),
			lte(progressSummaries.targetDate, endDate)
		))
		.orderBy(asc(progressSummaries.targetDate));
}
