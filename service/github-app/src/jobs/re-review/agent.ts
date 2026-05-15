import {
	createReview,
	getPullRequest,
	getPullRequestDiff,
	getRepositoryFile,
	getReviewThreads,
	updateComment,
} from "../../lib/github";
import { REPOSITORY_GUIDELINES_PATH } from "../../config";
import {
	calculateCost,
	generateReReview,
	REVIEW_MODEL_NAME,
} from "../../lib/llm";
import instruction from "../../prompts/re-review/instruction.md" with {
	type: "text",
};
import template from "../../prompts/re-review/template.md" with {
	type: "text",
};
import {
	getNextStepsSection,
	getUnresolvedThreadsSkippedReport,
	type ProgressStep,
	RE_REVIEW_CHECKBOX_UNCHECKED,
	RE_REVIEW_CHECKBOX_CHECKED_PATTERN,
	RE_REVIEW_CHECKBOX_COMPLETED,
} from "../constants";
import { ReviewProgressManager } from "../utils/progress";
import { withKvLock } from "../utils/lock";
import { processReviewThreads } from "./threads";
import { formatTemplate } from "../utils/format";
import { postInlineComments } from "../utils/comments";

export async function runReReviewAgent(
	env: Record<string, string | undefined>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	botName: string,
	sender: string,
	triggerCommentId?: number,
	triggerCommentBody?: string,
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

			const pr = await getPullRequest(
				env,
				installationId,
				owner,
				repo,
				pullNumber,
			);
			const diff = await getPullRequestDiff(
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

			const guidelines = await getRepositoryFile(
				env,
				installationId,
				owner,
				repo,
				REPOSITORY_GUIDELINES_PATH,
				pr.head?.sha,
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
			const unresolvedBotThreads = (reviewThreads || []).filter((thread: any) => {
				if (thread.isResolved || !thread.comments?.nodes?.length) return false;
				const firstCommentAuthor = thread.comments.nodes[0].author?.login?.toLowerCase() || "";
				return firstCommentAuthor.includes("bot") || firstCommentAuthor.includes("ai");
			});
			const hasUnresolvedBotThreads = unresolvedBotThreads.length > 0;

			let nextStepsSection = "";
			let overallStatus = "";
			let summarySection = "### 📝 サマリ\n\nなし\n";
			let resolvedAndHandoffSection = "### 💡 解決項目と申し送り\n\nなし\n";
			let newFeedbackSection = "### 🚨 新たな懸念点\n\nなし\n";
			let requiresAction = false;
			let newFeedbacks: any[] = [];

			if (hasUnresolvedBotThreads) {
				// 未解決がある場合は全体レビューをスキップ
				console.log(`[ReReviewAgent] Skipping full re-review due to unresolved threads for ${owner}/${repo}#${pullNumber}`);
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

				let finalInstruction = instruction;
				if (guidelines) {
					console.log(`[ReReviewAgent] Found repository guidelines`);
					finalInstruction += `\n\n## リポジトリ固有のガイドライン\n以下のルールを必ず守ってレビューしてください：\n\n${guidelines}`;
				}

				const { output: result, usage: reReviewUsage } = await generateReReview(
					env,
					{
						title: pr.title,
						body: pr.body,
						diff: diff,
						instruction: finalInstruction,
						template: template,
					},
				);

				totalCost += calculateCost(reReviewUsage, REVIEW_MODEL_NAME);

				// 新規の指摘事項セクションの作成
				newFeedbacks = result.newFeedback.slice(0, 10);
				const generalNewFeedback = newFeedbacks.filter(
					(f) => !(f.path && f.path !== "-" && f.line > 0),
				);

				if (generalNewFeedback.length > 0) {
					newFeedbackSection =
						"### 🚨 新たな懸念点\n\n| 対象 (ファイル等) | 該当行 | 指摘理由 | 対応度 | 概要 |\n| :--- | :--- | :--- | :--- | :--- |\n";
					newFeedbackSection +=
						generalNewFeedback
							.map(
								(f) =>
									`| ${f.path} | ${f.line > 0 ? f.line : "-"} | ${f.reason} | ${f.severity} | ${f.summary} |`,
							)
							.join("\n") + "\n";
				}

				const nextSteps = getNextStepsSection(
					newFeedbacks,
					botName,
					hasUnresolvedBotThreads,
				);
				nextStepsSection = nextSteps.nextStepsSection;
				requiresAction = nextSteps.requiresAction;

				if (result.summary && result.summary.length > 0) {
					summarySection =
						"### 📝 サマリ\n\n" +
						result.summary.map((s) => `- ${s}`).join("\n") +
						"\n";
				}

				if (result.resolvedAndHandoff && result.resolvedAndHandoff.length > 0) {
					resolvedAndHandoffSection =
						"### 💡 解決項目と申し送り\n\n" +
						result.resolvedAndHandoff.map((i) => `- ${i}`).join("\n") +
						"\n";
				}
				overallStatus = result.overallStatus;

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

			const finalReport = `@${sender}\n\n` + markdownReport;

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
			if (triggerCommentId && triggerCommentBody) {
				const updatedBody = triggerCommentBody.replace(
					RE_REVIEW_CHECKBOX_CHECKED_PATTERN,
					RE_REVIEW_CHECKBOX_COMPLETED,
				);
				if (updatedBody !== triggerCommentBody) {
					try {
						await updateComment(
							env,
							installationId,
							owner,
							repo,
							triggerCommentId,
							updatedBody,
						);
						console.log(
							`[ReReviewAgent] Updated trigger comment ${triggerCommentId}`,
						);
					} catch (err: any) {
						console.warn(
							`[ReReviewAgent] Failed to update trigger comment ${triggerCommentId}:`,
							err.message,
						);
					}
				}
			}

			console.log(
				`[ReReviewAgent] Completed re-review for ${owner}/${repo}#${pullNumber}`,
			);
		} catch (error: any) {
			if (error.message === "CANCELLED") {
				console.log(`[ReReviewAgent] Re-review cancelled for ${owner}/${repo}#${pullNumber}`);
				await progress.cancel();
				// キャンセル時はチェックボックスを元に戻す
				if (triggerCommentId && triggerCommentBody) {
					const revertedBody = triggerCommentBody.replace(
						RE_REVIEW_CHECKBOX_CHECKED_PATTERN,
						RE_REVIEW_CHECKBOX_UNCHECKED,
					);
					if (revertedBody !== triggerCommentBody) {
						try {
							await updateComment(env, installationId, owner, repo, triggerCommentId, revertedBody);
						} catch (err: any) {
							console.warn("[ReReviewAgent] Failed to revert trigger comment:", err.message);
						}
					}
				}
				return;
			}

			console.error(`[ReReviewAgent] Error in re-review process:`, error);
			await progress.error(error, "再レビュー処理中にエラーが発生しました。");

			// エラー時はチェックボックスを元に戻し、再試行できるようにする
			if (triggerCommentId && triggerCommentBody) {
				const revertedBody = triggerCommentBody.replace(
					RE_REVIEW_CHECKBOX_CHECKED_PATTERN,
					RE_REVIEW_CHECKBOX_UNCHECKED,
				);
				if (revertedBody !== triggerCommentBody) {
					try {
						await updateComment(
							env,
							installationId,
							owner,
							repo,
							triggerCommentId,
							revertedBody,
						);
					} catch (err: any) {
						console.warn(
							"[ReReviewAgent] Failed to revert trigger comment:",
							err.message,
						);
					}
				}
			}
		}
	});
}
