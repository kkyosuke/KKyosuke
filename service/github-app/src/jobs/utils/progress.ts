import { createPlaceholderComment, updateComment } from "../../lib/github";
import { getInProgressComment, type ProgressStep } from "../constants";

/**
 * レビューの進捗状況をコメントで管理します。
 */
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
		if (this.steps.length > 0) {
			const lastStepIndex = this.steps.length - 1;
			if (this.steps[lastStepIndex]) {
				this.steps[lastStepIndex].status = "done";
			}
		}

		if (this.placeholderCommentId) {
			const progressComment = getInProgressComment(
				this.title,
				this.steps,
				this.modelName,
			);
			const finishedComment = progressComment.replace(
				"現在処理を実行中です。完了まで少々お待ちください！",
				"処理が完了しました。",
			);
			const finalComment = `${finishedComment}\n> \n> 💸 **LLM Cost**: $${cost.toFixed(5)}`;

			await updateComment(
				this.env,
				this.installationId,
				this.owner,
				this.repo,
				this.placeholderCommentId,
				finalComment,
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

	async checkCancellation() {
		const kv = (this.env as any).KKYOSUKE_GITHUB_APP_KV;
		if (!kv) return;

		const cancelKey = `cancel-review-${this.owner}-${this.repo}-${this.pullNumber}`;
		const isCancelled = await kv.get(cancelKey);
		if (isCancelled) {
			console.log(
				`[ProgressManager] Cancellation signal detected for ${cancelKey}`,
			);
			throw new Error("CANCELLED");
		}
	}

	async cancel() {
		if (this.placeholderCommentId) {
			const progressComment = getInProgressComment(
				this.title,
				this.steps,
				this.modelName,
			);
			const cancelledComment = progressComment.replace(
				"現在処理を実行中です。完了まで少々お待ちください！",
				"新しいコミットがPushされたため、処理をキャンセルしました。新しいコミットに対する処理を待つか、再度レビューを依頼してください。",
			);

			await updateComment(
				this.env,
				this.installationId,
				this.owner,
				this.repo,
				this.placeholderCommentId,
				cancelledComment,
			).catch((e) =>
				console.error("Failed to update cancellation message:", e),
			);
		}
	}
}
