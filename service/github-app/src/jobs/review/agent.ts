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
import { generateCodeReview } from "../../lib/llm";
import instruction from "../../prompts/review/instruction.md" with {
	type: "text",
};
import template from "../../prompts/review/template.md" with { type: "text" };

export async function runReviewAgent(
	env: Record<string, string | undefined>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
) {
	let placeholderCommentId: number | null = null;

	try {
		// 1. プレースホルダーの投稿
		console.log(
			`[ReviewAgent] Starting review for ${owner}/${repo}#${pullNumber}`,
		);
		const placeholder = await createPlaceholderComment(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
			"👀 コードを読み込んでいます... (LLM Review Agent 稼働中)",
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

		const markdownReport = template
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
		console.log(
			`[ReviewAgent] Submitting review for ${owner}/${repo}#${pullNumber}`,
		);

		const hasIssues = feedbacks.length > 0;
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
