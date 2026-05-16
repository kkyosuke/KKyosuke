import { createReview, getIssueComments } from "../../../lib/github";
import {
	calculateCost,
	generateCodeReview,
	REVIEW_MODEL_NAME,
} from "../../../lib/llm";
import instruction from "../../../prompts/review/instruction.md" with {
	type: "text",
};
import template from "../../../prompts/review/template.md" with {
	type: "text",
};
import { createFeedbackTable, formatTemplate } from "../../common/utils/format";
import { getNextStepsSection, type ProgressStep } from "../constants";
import { postInlineComments } from "../utils/comments";
import {
	buildInstructionWithGuidelines,
	fetchReviewContext,
} from "../utils/context";
import { ReviewProgressManager } from "../utils/progress";

/**
 * PRのレビュー処理をバックグラウンドで実行します。
 *
 * @param env - 環境変数
 * @param installationId - GitHub AppのインストールID
 * @param owner - リポジトリのオーナー名
 * @param repo - リポジトリ名
 * @param pullNumber - PR番号
 * @param botName - ボット名
 * @param sender - イベントをトリガーしたユーザー
 */
export async function runReviewAgent(
	env: Record<string, string | undefined>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	botName: string,
	sender: string,
) {
	const steps: ProgressStep[] = [
		{ name: "PRの情報を取得中", status: "pending" },
		{ name: "AIによるレビューを生成中", status: "pending" },
		{ name: "レビュー結果を投稿中", status: "pending" },
	];

	const progress = new ReviewProgressManager(
		env,
		installationId,
		owner,
		repo,
		pullNumber,
		"Review in Progress",
		steps,
		REVIEW_MODEL_NAME,
	);

	try {
		console.log(
			`[ReviewAgent] Starting review for ${owner}/${repo}#${pullNumber}`,
		);
		await progress.start();

		// 1. コンテキストの収集
		const { pr, diff, guidelines } = await fetchReviewContext(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
		);
		const commentsRaw = await getIssueComments(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
		);

		const commentsText = commentsRaw
			.map((c) => `@${c.user?.login}: ${c.body}`)
			.join("\n\n");

		if (guidelines) {
			console.log(`[ReviewAgent] Found repository guidelines`);
		}
		const finalInstruction = buildInstructionWithGuidelines(
			instruction,
			guidelines,
			"以下のルールを必ず守ってレビューしてください：",
		);

		// 2. レビュー結果の生成 (LLM)
		await progress.update(0, 1);
		await progress.checkCancellation();

		console.log(
			`[ReviewAgent] Requesting LLM for ${owner}/${repo}#${pullNumber}`,
		);
		const { output: reviewResult, usage } = await generateCodeReview(env, {
			title: pr.title,
			body: pr.body,
			diff: diff,
			comments: commentsText,
			instruction: finalInstruction,
			template: template,
		});

		// 制限: 指摘事項は最大10個まで
		const feedbacks = reviewResult.feedback.slice(0, 10);
		const feedbackTable = createFeedbackTable(feedbacks);

		const { nextStepsSection, requiresAction } = getNextStepsSection(feedbacks);

		const markdownReport = formatTemplate(template, {
			botName,
			nextStepsSection,
			overallEvaluation: reviewResult.overallEvaluation,
			summary: reviewResult.summary,
			feedbackTable,
			score_functionality: String(reviewResult.scores.functionality.score),
			comment_functionality: reviewResult.scores.functionality.comment,
			score_security: String(reviewResult.scores.security.score),
			comment_security: reviewResult.scores.security.comment,
			score_maintainability: String(reviewResult.scores.maintainability.score),
			comment_maintainability: reviewResult.scores.maintainability.comment,
			score_performance: String(reviewResult.scores.performance.score),
			comment_performance: reviewResult.scores.performance.comment,
			score_testQuality: String(reviewResult.scores.testQuality.score),
			comment_testQuality: reviewResult.scores.testQuality.comment,
			score_architecture: String(reviewResult.scores.architecture.score),
			comment_architecture: reviewResult.scores.architecture.comment,
			score_documentation: String(reviewResult.scores.documentation.score),
			comment_documentation: reviewResult.scores.documentation.comment,
		});

		// 3. 結果の投稿
		await progress.update(1, 2);
		await progress.checkCancellation();

		console.log(
			`[ReviewAgent] Submitting review for ${owner}/${repo}#${pullNumber}`,
		);
		const cost = calculateCost(usage, REVIEW_MODEL_NAME);
		const finalReport = `@${sender}\n\n${markdownReport}`;

		await createReview(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
			finalReport,
			requiresAction ? "REQUEST_CHANGES" : "APPROVE",
		);

		await progress.finish(cost);

		// 4. インラインコメントの追加
		if (pr.head?.sha) {
			await postInlineComments(
				env,
				installationId,
				owner,
				repo,
				pullNumber,
				pr.head.sha,
				feedbacks,
			);
		}

		console.log(
			`[ReviewAgent] Completed review for ${owner}/${repo}#${pullNumber}`,
		);
	} catch (error: unknown) {
		if (error instanceof Error && error.message === "CANCELLED") {
			console.log(
				`[ReviewAgent] Review cancelled for ${owner}/${repo}#${pullNumber}`,
			);
			await progress.cancel();
		} else {
			console.error(`[ReviewAgent] Error in review process:`, error);
			await progress.error(
				error instanceof Error ? error : new Error(String(error)),
				"レビュー処理中にエラーが発生しました。",
			);
		}
	}
}
