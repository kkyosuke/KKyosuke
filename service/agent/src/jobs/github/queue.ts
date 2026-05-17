export type ReviewQueueMessage = {
	type: "route-comment" | "re-review" | "reply";
	payload: {
		installationId: number;
		owner: string;
		repo: string;
		issueNumber: number;
		commentBody: string;
		commentId?: number;
		isReviewSummary?: boolean;
		sender: string;
	};
};
