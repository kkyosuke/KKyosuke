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
			reviewResult,
		);

		// 5. 「💬 Q」の該当行にインラインコメントを追加する
		const lines = reviewResult.split("\n");
		let inTable = false;
		let headerParsed = false;
		let colPathIdx = -1, colLineIdx = -1, colSeverityIdx = -1, colSummaryIdx = -1, colReasonIdx = -1;

		for (const line of lines) {
			if (line.trim().startsWith("|")) {
				const cells = line.split("|").map((c) => c.trim()).slice(1, -1);
				if (!inTable) {
					inTable = true;
					colPathIdx = cells.findIndex((c) => c.includes("対象"));
					colLineIdx = cells.findIndex((c) => c.includes("該当行"));
					colReasonIdx = cells.findIndex((c) => c.includes("指摘理由"));
					colSeverityIdx = cells.findIndex((c) => c.includes("対応度"));
					colSummaryIdx = cells.findIndex((c) => c.includes("概要"));
				} else if (!headerParsed) {
					if (cells.some((c) => c.includes("---"))) {
						headerParsed = true;
					}
				} else {
					if (
						colPathIdx !== -1 &&
						colLineIdx !== -1 &&
						colSeverityIdx !== -1 &&
						cells.length >= Math.max(colPathIdx, colLineIdx, colSeverityIdx)
					) {
						const path = cells[colPathIdx];
						const lineStr = cells[colLineIdx];
						const severity = cells[colSeverityIdx];
						const summary = colSummaryIdx !== -1 ? cells[colSummaryIdx] : "";
						const reason = colReasonIdx !== -1 ? cells[colReasonIdx] : "";

						if (severity.includes("Q") && path && lineStr) {
							const match = lineStr.match(/\d+/);
							if (match && pr.head?.sha) {
								const lineNum = parseInt(match[0], 10);
								try {
									await createReviewComment(
										env,
										installationId,
										owner,
										repo,
										pullNumber,
										pr.head.sha,
										path,
										lineNum,
										`**💬 Q: 質問や意図の確認**\n\n**概要:** ${summary}\n\n**指摘理由:** ${reason}`
									);
									console.log(`[ReviewAgent] Created inline comment for ${path}:${lineNum}`);
								} catch (err: any) {
									console.error(`[ReviewAgent] Failed to create inline comment for ${path}:${lineNum}:`, err.message);
								}
							}
						}
					}
				}
			} else {
				inTable = false;
				headerParsed = false;
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
