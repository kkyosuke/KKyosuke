import {
	createPlaceholderComment,
	createReviewComment,
	getIssueComments,
	getPullRequest,
	getPullRequestDiff,
	updateComment,
} from "../lib/github";
import { generateCodeReview } from "../lib/llm";
import instruction from "../prompts/instruction.md";
import template from "../prompts/template.md";

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

		const markdownReport = `※ [コードレビューの観点](https://kyosuke.dev/ja/code/review.html) を参考にしています。

## 📝 サマリ

> [!NOTE]
> **総合評価: ${reviewResult.overallEvaluation}**

${reviewResult.summary}

## 💡 指摘点一覧

| 対象 (ファイル等) | 該当行 | 指摘理由 | 対応度 | 概要 |
| :--- | :--- | :--- | :--- | :--- |
${reviewResult.feedback.map((f) => `| ${f.path} | ${f.line > 0 ? f.line : "-"} | ${f.reason} | ${f.severity} | ${f.summary} |`).join("\n")}

**【対応方針】**
- \`🔴 must\` / \`🟡 want\`: 修正対応をお願いします。
- \`💬 Q\`: 回答をお願いします。
- \`🟢 nits\`: 対応は任意です。

## 📊 評価スコア詳細

| 評価観点 | スコア (各10点満点) | コメント（任意） |
| :--- | :--- | :--- |
| 機能の正確性・バグのリスク | ${reviewResult.scores.functionality.score} / 10 | ${reviewResult.scores.functionality.comment} |
| セキュリティ | ${reviewResult.scores.security.score} / 10 | ${reviewResult.scores.security.comment} |
| 保守性・可読性 | ${reviewResult.scores.maintainability.score} / 10 | ${reviewResult.scores.maintainability.comment} |
| パフォーマンス | ${reviewResult.scores.performance.score} / 10 | ${reviewResult.scores.performance.comment} |
| テスト品質 | ${reviewResult.scores.testQuality.score} / 10 | ${reviewResult.scores.testQuality.comment} |
| 設計・アーキテクチャ | ${reviewResult.scores.architecture.score} / 10 | ${reviewResult.scores.architecture.comment} |
| PR要件・ドキュメント | ${reviewResult.scores.documentation.score} / 10 | ${reviewResult.scores.documentation.comment} |
`;

		// 4. 結果の更新
		console.log(
			`[ReviewAgent] Updating comment for ${owner}/${repo}#${pullNumber}`,
		);
		await updateComment(
			env,
			installationId,
			owner,
			repo,
			placeholderCommentId,
			markdownReport,
		);

		// 5. 「💬 Q」などの該当行にインラインコメントを追加する
		for (const item of reviewResult.feedback) {
			if (item.severity.includes("Q") && item.path && item.line > 0) {
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
							`**${item.severity}: 質問や意図の確認**\n\n**概要:** ${item.summary}\n\n**指摘理由:** ${item.reason}`,
						);
						console.log(
							`[ReviewAgent] Created inline comment for ${item.path}:${item.line}`,
						);
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
