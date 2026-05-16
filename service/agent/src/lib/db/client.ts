export interface ProgressSummary {
	id: string;
	userId: string;
	targetDate: string;
	progressPercent: number;
	evaluationScore: number;
	summaryText: string;
}

export interface UserToken {
	id: string;
	userId: string;
	type: string;
	token: string;
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface DatabaseClient {
	insertProgressSummary(summary: ProgressSummary): Promise<void>;
	getProgressSummariesByDateRange(
		startDate: string,
		endDate: string,
	): Promise<ProgressSummary[]>;
	getUserToken(userId: string, type: string): Promise<UserToken | null>;
}
