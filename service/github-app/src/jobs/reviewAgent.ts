import {
	getPullRequest,
	getPullRequestDiff,
	getIssueComments,
	createPlaceholderComment,
	updateComment,
} from "../lib/github";
import { generateCodeReview } from "../lib/llm";
import { join } from "node:path";

export async function runReviewAgent(installationId: number, owner: string, repo: string, pullNumber: number) {
	let placeholderCommentId: number | null = null;

	try {
		// 1. プレースホルダーの投稿
		console.log(`[ReviewAgent] Starting review for ${owner}/${repo}#${pullNumber}`);
		const placeholder = await createPlaceholderComment(
			installationId,
			owner,
			repo,
			pullNumber,
			"👀 コードを読み込んでいます... (LLM Review Agent 稼働中)",
		);
		placeholderCommentId = placeholder.id;

		// 2. コンテキストとプロンプトの収集
		const pr = await getPullRequest(installationId, owner, repo, pullNumber);
		const diff = await getPullRequestDiff(installationId, owner, repo, pullNumber);
		const commentsRaw = await getIssueComments(installationId, owner, repo, pullNumber);

		// src/prompts からシンボリックリンク経由で md ファイルを読み込む
		const instruction = await Bun.file(join(import.meta.dir, "../prompts/instruction.md")).text();
		const template = await Bun.file(join(import.meta.dir, "../prompts/template.md")).text();

		// コメントは読みやすいように整形
		const comments = commentsRaw
			.map((c) => `@${c.user?.login}: ${c.body}`)
			.join("\n\n");

		// 3. レビュー結果の生成 (LLM)
		console.log(`[ReviewAgent] Requesting LLM for ${owner}/${repo}#${pullNumber}`);
		const reviewResult = await generateCodeReview({
			title: pr.title,
			body: pr.body,
			diff: diff,
			comments: comments,
			instruction: instruction,
			template: template,
		});

		// 4. 結果の更新
		console.log(`[ReviewAgent] Updating comment for ${owner}/${repo}#${pullNumber}`);
		await updateComment(installationId, owner, repo, placeholderCommentId, reviewResult);
		console.log(`[ReviewAgent] Completed review for ${owner}/${repo}#${pullNumber}`);
	} catch (error: any) {
		console.error(`[ReviewAgent] Error in review process:`, error);
		if (placeholderCommentId) {
			const errorMessage = `⚠️ レビュー処理中にエラーが発生しました。\n\`\`\`\n${error.message}\n\`\`\``;
			await updateComment(installationId, owner, repo, placeholderCommentId, errorMessage).catch((e) =>
				console.error("Failed to update error message:", e),
			);
		}
	}
}
