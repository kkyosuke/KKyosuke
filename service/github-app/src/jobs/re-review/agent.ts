import {
	createPlaceholderComment,
	createReplyForReviewComment,
	createReview,
	createReviewComment,
	deleteComment,
	getPullRequest,
	getPullRequestDiff,
	getReviewThreads,
	resolveReviewThread,
	updateComment,
} from "../../lib/github";
import { evaluateReviewThread, generateReReview } from "../../lib/llm";
import instruction from "../../prompts/re-review/instruction.md" with {
	type: "text",
};
import template from "../../prompts/re-review/template.md" with {
	type: "text",
};
import threadInstruction from "../../prompts/re-review/thread-instruction.md" with {
	type: "text",
};
import { IN_PROGRESS_PLACEHOLDER_COMMENT } from "../constants";

export async function runReReviewAgent(
	env: Record<string, string | undefined>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	botName: string,
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
			IN_PROGRESS_PLACEHOLDER_COMMENT,
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

		// 過去のコメントスレッドの取得と処理
		const reviewThreads = await getReviewThreads(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
		);

		await Promise.all(
			reviewThreads.map(async (thread: any) => {
				if (thread.isResolved || !thread.comments?.nodes?.length) return;

				const comments = thread.comments.nodes;
				const firstCommentAuthor =
					comments[0].author?.login?.toLowerCase() || "";
				const isBotThread =
					firstCommentAuthor.includes("bot") ||
					firstCommentAuthor.includes("ai");

				if (!isBotThread) return;

				const lastCommentAuthor =
					comments[comments.length - 1].author?.login?.toLowerCase() || "";
				const isLastCommentFromBot =
					lastCommentAuthor.includes("bot") || lastCommentAuthor.includes("ai");

				// 最後のコメントがBotでない場合（ユーザーからの返信がある場合）に対応
				if (!isLastCommentFromBot) {
					console.log(`[ReReviewAgent] Evaluating thread ${thread.id}`);
					const threadCommentsText = comments
						.map((c: any) => `@${c.author?.login}: ${c.body}`)
						.join("\n\n---\n\n");

					const evalResult = await evaluateReviewThread(env, {
						threadComments: `[ファイル: ${thread.path}, 行: ${thread.line}]\n\n${threadCommentsText}`,
						diff,
						instruction: threadInstruction,
					});

					console.log(
						`[ReReviewAgent] Thread ${thread.id} action: ${evalResult.action}`,
					);

					if (
						(evalResult.action === "REPLY" ||
							evalResult.action === "REPLY_AND_RESOLVE") &&
						evalResult.replyBody
					) {
						try {
							await createReplyForReviewComment(
								env,
								installationId,
								owner,
								repo,
								pullNumber,
								comments[0].databaseId,
								evalResult.replyBody,
							);
						} catch (e: any) {
							console.warn(
								`[ReReviewAgent] Failed to reply to thread ${thread.id}:`,
								e.message,
							);
						}
					}

					if (
						evalResult.action === "RESOLVE" ||
						evalResult.action === "REPLY_AND_RESOLVE"
					) {
						try {
							await resolveReviewThread(env, installationId, thread.id);
							thread.isResolved = true; // Mark as resolved in memory
						} catch (e: any) {
							console.warn(
								`[ReReviewAgent] Failed to resolve thread ${thread.id}:`,
								e.message,
							);
						}
					}
				}
			}),
		);

		// 未解決のBotスレッドが残っているかチェック (スレッド対応は別エージェントに任せる方針のため、再レビューの全体ステータス判定には使用しない)
		const remainingUnresolvedThreads = reviewThreads.filter((t: any) => {
			if (t.isResolved || !t.comments?.nodes?.length) return false;
			const author = t.comments.nodes[0].author?.login?.toLowerCase() || "";
			return author.includes("bot") || author.includes("ai");
		});

		// 全体の再レビュー
		console.log(
			`[ReReviewAgent] Requesting LLM for ${owner}/${repo}#${pullNumber}`,
		);
		const result = await generateReReview(env, {
			title: pr.title,
			body: pr.body,
			diff: diff,
			instruction: instruction,
			template: template,
		});

		// 新規の指摘事項セクションの作成
		const newFeedbacks = result.newFeedback.slice(0, 10);
		const generalNewFeedback = newFeedbacks.filter(
			(f) => !(f.path && f.path !== "-" && f.line > 0),
		);

		let newFeedbackSection = "### 🚨 新たな懸念点\n\nなし\n";
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

		const hasIssues = newFeedbacks.length > 0;

		const nextStepsSection = hasIssues
			? `\n**【次のステップ】**\n- [ ] \`🔴 must\` の指摘事項を修正する\n- [ ] \`🟡 want\` の指摘事項を修正する、または対応を見送る理由を返信する\n- [ ] ※ 修正対応やコメントの返信が終わりましたら、\`@${botName} 再レビューして\` とメンションして再度レビューを依頼してください。`
			: "";

		let summarySection = "### 📝 サマリ\n\nなし\n";
		if (result.summary && result.summary.length > 0) {
			summarySection =
				"### 📝 サマリ\n\n" +
				result.summary.map((s) => `- ${s}`).join("\n") +
				"\n";
		}

		let resolvedAndHandoffSection = "### 💡 解決項目と申し送り\n\nなし\n";
		if (result.resolvedAndHandoff && result.resolvedAndHandoff.length > 0) {
			resolvedAndHandoffSection =
				"### 💡 解決項目と申し送り\n\n" +
				result.resolvedAndHandoff.map((i) => `- ${i}`).join("\n") +
				"\n";
		}

		// Markdown生成
		const markdownReport = template
			.replaceAll("{{botName}}", botName)
			.replaceAll("{{nextStepsSection}}", nextStepsSection)
			.replaceAll("{{overallStatus}}", result.overallStatus)
			.replaceAll("{{summarySection}}", summarySection)
			.replaceAll("{{resolvedAndHandoffSection}}", resolvedAndHandoffSection)
			.replaceAll("{{newFeedbackSection}}", newFeedbackSection);

		console.log(
			`[ReReviewAgent] Submitting review for ${owner}/${repo}#${pullNumber}`,
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
				`[ReReviewAgent] Deleting placeholder comment for ${owner}/${repo}#${pullNumber}`,
			);
			await deleteComment(
				env,
				installationId,
				owner,
				repo,
				placeholderCommentId,
			);
		}

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
