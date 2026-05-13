import {
	createPlaceholderComment,
	createReview,
	createReviewComment,
	deleteComment,
	getIssueComments,
	getPullRequest,
	getPullRequestDiff,
	updateComment,
} from "../../lib/github";
import { generateCodeReview, REVIEW_MODEL_NAME } from "../../lib/llm";
import instruction from "../../prompts/review/instruction.md" with {
	type: "text",
};
import template from "../../prompts/review/template.md" with { type: "text" };
import { getInProgressComment, type ProgressStep } from "../constants";

export async function runReviewAgent(
	env: Record<string, string | undefined>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	botName: string,
) {
	let placeholderCommentId: number | null = null;

	const steps: [ProgressStep, ProgressStep, ProgressStep] = [
		{ name: "PRの情報を取得中", status: "pending" },
		{ name: "AIによるレビューを生成中", status: "pending" },
		{ name: "レビュー結果を投稿中", status: "pending" },
	];

	const updateProgress = async () => {
		if (placeholderCommentId) {
			await updateComment(
				env,
				installationId,
				owner,
				repo,
				placeholderCommentId,
				getInProgressComment("Review in Progress", steps, REVIEW_MODEL_NAME),
			).catch((e) => console.error("Failed to update progress:", e));
		}
	};

	try {
		// 1. プレースホルダーの投稿
		console.log(
			`[ReviewAgent] Starting review for ${owner}/${repo}#${pullNumber}`,
		);
		steps[0].status = "in_progress";
		const placeholder = await createPlaceholderComment(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
			getInProgressComment("Review in Progress", steps, REVIEW_MODEL_NAME),
		);
		placeholderCommentId = placeholder.id;

		// 2. コンテキストとプロンプトの収集
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
		const commentsRaw = await getIssueComments(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
		);

		// コメントは読みやすいように整形
		const comments = commentsRaw
			.map((c) => `@${c.user?.login}: ${c.body}`)
			.join("\n\n");

		// 3. レビュー結果の生成 (LLM)
		steps[0].status = "done";
		steps[1].status = "in_progress";
		await updateProgress();

		console.log(
			`[ReviewAgent] Requesting LLM for ${owner}/${repo}#${pullNumber}`,
		);
		const reviewResult = await generateCodeReview(env, {
			title: pr.title,
			body: pr.body,
			diff: diff,
			comments: comments,
			instruction: instruction,
			template: template,
		});

		// 制限: 指摘事項は最大10個まで
		const feedbacks = reviewResult.feedback.slice(0, 10);

		// ファイルと行番号が特定できる指摘はインラインコメントにするため一覧からは除外
		const generalFeedback = feedbacks.filter(
			(f) => !(f.path && f.path !== "-" && f.line > 0),
		);

		const feedbackTable =
			generalFeedback.length > 0
				? generalFeedback
						.map(
							(f) =>
								`| ${f.path} | ${f.line > 0 ? f.line : "-"} | ${f.reason} | ${f.severity} | ${f.summary} |`,
						)
						.join("\n")
				: "| - | - | - | - | 特に指摘事項はありません |";

		const hasIssues = feedbacks.length > 0;

		const nextStepsSection = hasIssues
			? `\n**【次のステップ】**\n- [ ] \`🔴 must\` の指摘事項を修正する\n- [ ] \`🟡 want\` の指摘事項を修正する、または対応を見送る理由を返信する\n- [ ] ※ 修正対応やコメントの返信が終わりましたら、\`@${botName} 再レビューして\` とメンションして再度レビューを依頼してください。`
			: "";

		const markdownReport = template
			.replaceAll("{{botName}}", botName)
			.replaceAll("{{nextStepsSection}}", nextStepsSection)
			.replaceAll("{{overallEvaluation}}", reviewResult.overallEvaluation)
			.replaceAll("{{summary}}", reviewResult.summary)
			.replaceAll("{{feedbackTable}}", feedbackTable)
			.replaceAll(
				"{{score_functionality}}",
				String(reviewResult.scores.functionality.score),
			)
			.replaceAll(
				"{{comment_functionality}}",
				reviewResult.scores.functionality.comment,
			)
			.replaceAll(
				"{{score_security}}",
				String(reviewResult.scores.security.score),
			)
			.replaceAll("{{comment_security}}", reviewResult.scores.security.comment)
			.replaceAll(
				"{{score_maintainability}}",
				String(reviewResult.scores.maintainability.score),
			)
			.replaceAll(
				"{{comment_maintainability}}",
				reviewResult.scores.maintainability.comment,
			)
			.replaceAll(
				"{{score_performance}}",
				String(reviewResult.scores.performance.score),
			)
			.replaceAll(
				"{{comment_performance}}",
				reviewResult.scores.performance.comment,
			)
			.replaceAll(
				"{{score_testQuality}}",
				String(reviewResult.scores.testQuality.score),
			)
			.replaceAll(
				"{{comment_testQuality}}",
				reviewResult.scores.testQuality.comment,
			)
			.replaceAll(
				"{{score_architecture}}",
				String(reviewResult.scores.architecture.score),
			)
			.replaceAll(
				"{{comment_architecture}}",
				reviewResult.scores.architecture.comment,
			)
			.replaceAll(
				"{{score_documentation}}",
				String(reviewResult.scores.documentation.score),
			)
			.replaceAll(
				"{{comment_documentation}}",
				reviewResult.scores.documentation.comment,
			);

		// 4. 結果の更新
		steps[1].status = "done";
		steps[2].status = "in_progress";
		await updateProgress();

		console.log(
			`[ReviewAgent] Submitting review for ${owner}/${repo}#${pullNumber}`,
		);

		await createReview(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
			markdownReport,
			hasIssues ? "REQUEST_CHANGES" : "APPROVE",
		);

		if (placeholderCommentId) {
			console.log(
				`[ReviewAgent] Deleting placeholder comment for ${owner}/${repo}#${pullNumber}`,
			);
			await deleteComment(
				env,
				installationId,
				owner,
				repo,
				placeholderCommentId,
			);
		}

		// 5. 該当行にインラインコメントを追加する
		for (const item of feedbacks) {
			if (item.path && item.path !== "-" && item.line > 0) {
				if (pr.head?.sha) {
					try {
						await createReviewComment(
							env,
							installationId,
							owner,
							repo,
							pullNumber,
							pr.head.sha,
							item.path,
							item.line,
							`**${item.severity}**\n\n**概要:** ${item.summary}\n\n**指摘理由:** ${item.reason}`,
						);
						console.log(
							`[ReviewAgent] Created inline comment for ${item.path}:${item.line}`,
						);
						await new Promise((resolve) => setTimeout(resolve, 500));
					} catch (err: any) {
						console.error(
							`[ReviewAgent] Failed to create inline comment for ${item.path}:${item.line}:`,
							err.message,
						);
					}
				}
			}
		}

		console.log(
			`[ReviewAgent] Completed review for ${owner}/${repo}#${pullNumber}`,
		);
	} catch (error: any) {
		console.error(`[ReviewAgent] Error in review process:`, error);
		if (placeholderCommentId) {
			const errorMessage = `⚠️ レビュー処理中にエラーが発生しました。\n\`\`\`\n${error.message}\n\`\`\``;
			await updateComment(
				env,
				installationId,
				owner,
				repo,
				placeholderCommentId,
				errorMessage,
			).catch((e) => console.error("Failed to update error message:", e));
		}
	}
}
