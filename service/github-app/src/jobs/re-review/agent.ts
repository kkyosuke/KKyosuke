import {
	createPlaceholderComment,
	createReviewComment,
	getIssueComments,
	getPullRequest,
	getPullRequestDiff,
	getReviewComments,
	updateComment,
} from "../../lib/github";
import { generateReReview } from "../../lib/llm";
import instruction from "../../prompts/re-review/instruction.md" with { type: "text" };
import template from "../../prompts/re-review/template.md" with { type: "text" };

export async function runReReviewAgent(
	env: Record<string, string | undefined>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
) {
	let placeholderCommentId: number | null = null;

	try {
		console.log(
			`[ReReviewAgent] Starting re-review for ${owner}/${repo}#${pullNumber}`,
		);
		const placeholder = await createPlaceholderComment(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
			"👀 過去の指摘事項と最新の差分を確認しています... (LLM Re-Review Agent 稼働中)",
		);
		placeholderCommentId = placeholder.id;

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
		
		// 過去のコメントの取得
		const issueCommentsRaw = await getIssueComments(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
		);
		const reviewCommentsRaw = await getReviewComments(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
		);

		// Bot自身のコメントを抽出
		const botIssueComments = issueCommentsRaw
			.filter(c => c.user?.type === "Bot" || c.user?.login?.toLowerCase().includes("bot") || c.user?.login?.includes("ai"))
			.map(c => `[PR全体へのコメント]\n${c.body}`);
			
		const botReviewComments = reviewCommentsRaw
			.filter(c => c.user?.type === "Bot" || c.user?.login?.toLowerCase().includes("bot") || c.user?.login?.includes("ai"))
			.map(c => `[ファイル: ${c.path}, 行: ${c.line}]\n${c.body}`);

		const previousComments = [...botIssueComments, ...botReviewComments].join("\n\n---\n\n");

		console.log(
			`[ReReviewAgent] Requesting LLM for ${owner}/${repo}#${pullNumber}`,
		);
		const result = await generateReReview(env, {
			title: pr.title,
			body: pr.body,
			diff: diff,
			previousComments: previousComments,
			instruction: instruction,
			template: template,
		});

		// 過去の指摘ステータステーブルの作成
		const previousFeedbackTable = result.previousFeedbackStatus.length > 0
			? result.previousFeedbackStatus
					.map((f) => `| ${f.summary} | ${f.status} | ${f.comment} |`)
					.join("\n")
			: "| - | - | 過去の指摘事項が見つかりませんでした |";

		// 新規の指摘事項セクションの作成
		const newFeedbacks = result.newFeedback.slice(0, 10);
		const generalNewFeedback = newFeedbacks.filter(
			(f) => !(f.path && f.path !== "-" && f.line > 0),
		);

		let newFeedbackSection = "";
		if (generalNewFeedback.length > 0) {
			newFeedbackSection = "## 🚨 新たな懸念点\n\n| 対象 (ファイル等) | 該当行 | 指摘理由 | 対応度 | 概要 |\n| :--- | :--- | :--- | :--- | :--- |\n";
			newFeedbackSection += generalNewFeedback
				.map((f) => `| ${f.path} | ${f.line > 0 ? f.line : "-"} | ${f.reason} | ${f.severity} | ${f.summary} |`)
				.join("\n");
		}

		// Markdown生成
		const markdownReport = template
			.replaceAll("{{overallStatus}}", result.overallStatus)
			.replaceAll("{{summary}}", result.summary)
			.replaceAll("{{previousFeedbackTable}}", previousFeedbackTable)
			.replaceAll("{{newFeedbackSection}}", newFeedbackSection);

		console.log(
			`[ReReviewAgent] Updating comment for ${owner}/${repo}#${pullNumber}`,
		);
		await updateComment(
			env,
			installationId,
			owner,
			repo,
			placeholderCommentId,
			markdownReport,
		);

		// 新規インラインコメントの投稿
		for (const item of newFeedbacks) {
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
							`**${item.severity} (再レビューでの新規指摘)**\n\n**概要:** ${item.summary}\n\n**指摘理由:** ${item.reason}`,
						);
						console.log(
							`[ReReviewAgent] Created inline comment for ${item.path}:${item.line}`,
						);
						await new Promise((resolve) => setTimeout(resolve, 500));
					} catch (err: any) {
						console.error(
							`[ReReviewAgent] Failed to create inline comment for ${item.path}:${item.line}:`,
							err.message,
						);
					}
				}
			}
		}

		console.log(
			`[ReReviewAgent] Completed re-review for ${owner}/${repo}#${pullNumber}`,
		);
	} catch (error: any) {
		console.error(`[ReReviewAgent] Error in re-review process:`, error);
		if (placeholderCommentId) {
			const errorMessage = `⚠️ 再レビュー処理中にエラーが発生しました。\n\`\`\`\n${error.message}\n\`\`\``;
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
