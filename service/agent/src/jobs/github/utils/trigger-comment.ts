import type { CustomAppEnv } from "../../../config/env";
import { updateComment, updateReview } from "../../../lib/github";
import {
	RE_REVIEW_CHECKBOX_CHECKED_PATTERN,
	RE_REVIEW_CHECKBOX_COMPLETED,
	RE_REVIEW_CHECKBOX_UNCHECKED,
} from "../constants";

/**
 * トリガーとなったコメントのチェックボックス状態を更新します。
 */
export async function updateTriggerCommentState(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	triggerCommentId: number | undefined,
	triggerCommentBody: string | undefined,
	isReviewSummary: boolean | undefined,
	state: "completed" | "reverted",
) {
	if (!triggerCommentId || !triggerCommentBody) return;

	const replacement =
		state === "completed"
			? RE_REVIEW_CHECKBOX_COMPLETED
			: RE_REVIEW_CHECKBOX_UNCHECKED;
	const updatedBody = triggerCommentBody.replace(
		RE_REVIEW_CHECKBOX_CHECKED_PATTERN,
		replacement,
	);

	if (updatedBody !== triggerCommentBody) {
		try {
			if (isReviewSummary) {
				await updateReview(
					env,
					installationId,
					owner,
					repo,
					pullNumber,
					triggerCommentId,
					updatedBody,
				);
			} else {
				await updateComment(
					env,
					installationId,
					owner,
					repo,
					triggerCommentId,
					updatedBody,
				);
			}
			console.log(
				`[TriggerComment] Updated trigger comment ${triggerCommentId} to ${state}`,
			);
		} catch (err: unknown) {
			console.warn(
				`[TriggerComment] Failed to update trigger comment ${triggerCommentId}:`,
				err instanceof Error ? err.message : String(err),
			);
		}
	}
}
