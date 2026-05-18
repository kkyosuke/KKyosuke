import type { CustomAppEnv } from "../../../config/env";
import { createReview, getReviewThreads } from "../../../lib/github";
import { REVIEW_MODEL_NAME } from "../../../lib/llm";
import instruction from "../../../prompts/re-review/instruction.md" with {
	type: "text",
};
import template from "../../../prompts/re-review/template.md" with {
	type: "text",
};
import { formatTemplate } from "../../common/utils/format";
import { withKvLock } from "../../common/utils/lock";
import {
	getUnresolvedThreadsSkippedReport,
	type ProgressStep,
} from "../constants";
import { postInlineComments } from "../utils/comments";
import {
	buildInstructionWithGuidelines,
	fetchReviewContext,
} from "../utils/context";
import { ReviewProgressManager } from "../utils/progress";
import { updateTriggerCommentState } from "../utils/trigger-comment";
import { performFullReReview } from "./full-review";
import { processReviewThreads } from "./threads";

/**
 * PRの再レビュー処理をバックグラウンドで実行します。
 *
 * @param env - 環境変数
 * @param installationId - GitHub AppのインストールID
 * @param owner - リポジトリのオーナー名
 * @param repo - リポジトリ名
 * @param pullNumber - PR番号
 * @param botName - ボット名
 * @param sender - イベントをトリガーしたユーザー
 * @param triggerCommentId - トリガーとなったコメントID
 * @param triggerCommentBody - トリガーとなったコメントの本文
 * @param isReviewSummary - レビューサマリからのトリガーかどうか
 */
export async function runReReviewAgent(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	botName: string,
	sender: string,
	triggerCommentId?: number,
	triggerCommentBody?: string,
	isReviewSummary?: boolean,
) {
	const lockKey = `lock-rereview-${owner}-${repo}-${pullNumber}`;

	await withKvLock(env, lockKey, 600, async () => {
		const steps: ProgressStep[] = [
			{ name: "PRの情報を取得中", status: "pending" },
			{ name: "過去の指摘事項を確認中", status: "pending" },
			{ name: "AIによる全体再レビューを生成中", status: "pending" },
			{ name: "レビュー結果を投稿中", status: "pending" },
		];

		const progress = new ReviewProgressManager(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
			"Re-Review in Progress",
			steps,
			REVIEW_MODEL_NAME,
		);

		try {
			console.log(
				`[ReReviewAgent] Starting re-review for ${owner}/${repo}#${pullNumber}`,
			);

			await progress.start();

			const { pr, diff, guidelines } = await fetchReviewContext(
				env,
				installationId,
				owner,
				repo,
				pullNumber,
			);

			// 過去のコメントスレッドの取得と処理
			await progress.update(0, 1);

			const reviewThreads = await getReviewThreads(
				env,
				installationId,
				owner,
				repo,
				pullNumber,
			);

			let totalCost = await processReviewThreads(
				env,
				installationId,
				owner,
				repo,
				pullNumber,
				diff,
				reviewThreads,
				guidelines,
			);

			// 未解決のBotスレッドがあるか確認
			const unresolvedBotThreads = (reviewThreads || []).filter((thread) => {
				if (thread.isResolved || !thread.comments?.nodes?.length) return false;
				const firstCommentAuthor =
					thread.comments?.nodes?.[0]?.author?.login?.toLowerCase() || "";
				return (
					firstCommentAuthor.includes("bot") ||
					firstCommentAuthor.includes("ai")
				);
			});
			const hasUnresolvedBotThreads = unresolvedBotThreads.length > 0;

			let nextStepsSection = "";
			let overallStatus = "";
			let summarySection = "### 📝 サマリ\n\nなし\n";
			let resolvedAndHandoffSection = "### 💡 解決項目と申し送り\n\nなし\n";
			let newFeedbackSection = "### 🚨 新たな懸念点\n\nなし\n";
			let requiresAction = false;
			let newFeedbacks: Array<{
				path: string;
				line: number;
				reason: string;
				severity: string;
				summary: string;
			}> = [];

			if (hasUnresolvedBotThreads) {
				// 未解決がある場合は全体レビューをスキップ
				console.log(
					`[ReReviewAgent] Skipping full re-review due to unresolved threads for ${owner}/${repo}#${pullNumber}`,
				);
				const skippedReport = getUnresolvedThreadsSkippedReport();
				overallStatus = skippedReport.overallStatus;
				summarySection = skippedReport.summarySection;
				nextStepsSection = skippedReport.nextStepsSection;
				requiresAction = skippedReport.requiresAction;

				await progress.update(2, 3);
				await progress.checkCancellation();
			} else {
				// 全体の再レビュー
				await progress.update(1, 2);
				await progress.checkCancellation();

				console.log(
					`[ReReviewAgent] Requesting LLM for ${owner}/${repo}#${pullNumber}`,
				);

				if (guidelines) {
					console.log(`[ReReviewAgent] Found repository guidelines`);
				}
				const finalInstruction = buildInstructionWithGuidelines(
					instruction,
					guidelines,
					"以下のルールを必ず守ってレビューしてください：",
				);

				const fullReviewResult = await performFullReReview(
					env,
					pr,
					diff,
					finalInstruction,
					template,
					hasUnresolvedBotThreads,
				);

				totalCost += fullReviewResult.cost;
				newFeedbacks = fullReviewResult.newFeedbacks;
				nextStepsSection = fullReviewResult.nextStepsSection;
				requiresAction = fullReviewResult.requiresAction;
				summarySection = fullReviewResult.summarySection;
				resolvedAndHandoffSection = fullReviewResult.resolvedAndHandoffSection;
				newFeedbackSection = fullReviewResult.newFeedbackSection;
				overallStatus = fullReviewResult.overallStatus;

				await progress.update(2, 3);
				await progress.checkCancellation();
			}

			// Markdown生成

			const markdownReport = formatTemplate(template, {
				botName,
				nextStepsSection,
				overallStatus: overallStatus,
				summarySection,
				resolvedAndHandoffSection,
				newFeedbackSection,
			});

			let targetMention = sender;
			if (triggerCommentBody) {
				const match = triggerCommentBody.trim().match(/^@([a-zA-Z0-9_-]+)/);
				if (match?.[1]) {
					targetMention = match[1];
				}
			}

			const finalReport = `@${targetMention}\n\n${markdownReport}`;

			console.log(
				`[ReReviewAgent] Submitting review for ${owner}/${repo}#${pullNumber}`,
			);

			await createReview(
				env,
				installationId,
				owner,
				repo,
				pullNumber,
				finalReport,
				requiresAction ? "REQUEST_CHANGES" : "APPROVE",
			);

			await progress.finish(totalCost);

			// 新規インラインコメントの投稿
			if (pr.head?.sha) {
				await postInlineComments(
					env,
					installationId,
					owner,
					repo,
					pullNumber,
					pr.head.sha,
					newFeedbacks,
					"再レビューでの新規指摘",
				);
			}

			// トリガーとなったコメントの更新（チェックボックスを押せないようにする）
			await updateTriggerCommentState(
				env,
				installationId,
				owner,
				repo,
				pullNumber,
				triggerCommentId,
				triggerCommentBody,
				isReviewSummary,
				"completed",
			);

			console.log(
				`[ReReviewAgent] Completed re-review for ${owner}/${repo}#${pullNumber}`,
			);
		} catch (error: unknown) {
			if (error instanceof Error && error.message === "CANCELLED") {
				console.log(
					`[ReReviewAgent] Re-review cancelled for ${owner}/${repo}#${pullNumber}`,
				);
				await progress.cancel();
				// キャンセル時はチェックボックスを元に戻す
				await updateTriggerCommentState(
					env,
					installationId,
					owner,
					repo,
					pullNumber,
					triggerCommentId,
					triggerCommentBody,
					isReviewSummary,
					"reverted",
				);
				return;
			}

			console.error(`[ReReviewAgent] Error in re-review process:`, error);
			await progress.error(
				error instanceof Error ? error : new Error(String(error)),
				"再レビュー処理中にエラーが発生しました。",
			);

			// エラー時はチェックボックスを元に戻し、再試行できるようにする
			await updateTriggerCommentState(
				env,
				installationId,
				owner,
				repo,
				pullNumber,
				triggerCommentId,
				triggerCommentBody,
				isReviewSummary,
				"reverted",
			);
		}
	});
}
