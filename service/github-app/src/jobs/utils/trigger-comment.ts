import { updateComment, updateReview } from "../../lib/github";
import {
	RE_REVIEW_CHECKBOX_UNCHECKED,
	RE_REVIEW_CHECKBOX_CHECKED_PATTERN,
	RE_REVIEW_CHECKBOX_COMPLETED,
} from "../constants";

export async function updateTriggerCommentState(
	env: Record<string, string | undefined>,
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
		} catch (err: any) {
			console.warn(
				`[TriggerComment] Failed to update trigger comment ${triggerCommentId}:`,
				err.message,
			);
		}
	}
}
