export interface ProgressSummary {
	id: string;
	userId: string;
	targetDate: string;
	progressPercent: number;
	evaluationScore: number;
	summaryText: string;
}

export interface DatabaseClient {
	insertProgressSummary(summary: ProgressSummary): Promise<void>;
}
