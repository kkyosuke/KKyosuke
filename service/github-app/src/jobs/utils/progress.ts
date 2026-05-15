import { createPlaceholderComment, updateComment } from "../../lib/github";
import { getInProgressComment, type ProgressStep } from "../constants";

export class ReviewProgressManager {
	private placeholderCommentId: number | null = null;

	constructor(
		private env: Record<string, string | undefined>,
		private installationId: number,
		private owner: string,
		private repo: string,
		private pullNumber: number,
		private title: string,
		private steps: ProgressStep[],
		private modelName?: string,
	) {}

	async start() {
		if (this.steps[0]) {
			this.steps[0].status = "in_progress";
		}
		const placeholder = await createPlaceholderComment(
			this.env,
			this.installationId,
			this.owner,
			this.repo,
			this.pullNumber,
			getInProgressComment(this.title, this.steps, this.modelName),
		);
		this.placeholderCommentId = placeholder.id;
	}

	async update(stepIndexToComplete: number, stepIndexToStart?: number) {
		if (this.steps[stepIndexToComplete]) {
			this.steps[stepIndexToComplete].status = "done";
		}
		if (stepIndexToStart !== undefined && this.steps[stepIndexToStart]) {
			this.steps[stepIndexToStart].status = "in_progress";
		}
		if (this.placeholderCommentId) {
			await updateComment(
				this.env,
				this.installationId,
				this.owner,
				this.repo,
				this.placeholderCommentId,
				getInProgressComment(this.title, this.steps, this.modelName),
			).catch((e) => console.error("Failed to update progress:", e));
		}
	}

	async finish(cost: number) {
		if (this.placeholderCommentId) {
			await updateComment(
				this.env,
				this.installationId,
				this.owner,
				this.repo,
				this.placeholderCommentId,
				`💸 **LLM Cost**: $${cost.toFixed(5)}`,
			).catch((e) => console.error("Failed to update cost:", e));
		}
	}

	async error(error: any, customMessage: string) {
		if (this.placeholderCommentId) {
			const errorMessage = `⚠️ ${customMessage}\n\`\`\`\n${error.message}\n\`\`\``;
			await updateComment(
				this.env,
				this.installationId,
				this.owner,
				this.repo,
				this.placeholderCommentId,
				errorMessage,
			).catch((e) => console.error("Failed to update error message:", e));
		}
	}
}
